package `in`.leadschool.appshare

import android.content.Context
import android.net.Uri
import android.os.Environment
import android.provider.OpenableColumns
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import kotlinx.coroutines.flow.MutableStateFlow
import java.io.File
import java.io.FileOutputStream

/** A device found by Nearby Connections discovery. */
data class Peer(val endpointId: String, val name: String, val connected: Boolean = false)

data class TransferState(
    val status: String = "Idle",
    val progress: Float = 0f,
    val busy: Boolean = false
)

/**
 * Wraps Google Nearby Connections (P2P_POINT_TO_POINT strategy).
 * Underneath it uses Bluetooth for discovery/handshake and upgrades to
 * Wi-Fi Direct / Wi-Fi Aware / hotspot for the actual bytes.
 */
class NearbyTransfer(private val context: Context, private val deviceName: String) {

    companion object {
        const val SERVICE_ID = "in.leadschool.appshare.SERVICE"
        private val STRATEGY = Strategy.P2P_POINT_TO_POINT
    }

    private val client = Nearby.getConnectionsClient(context)

    val peers = MutableStateFlow<List<Peer>>(emptyList())
    val state = MutableStateFlow(TransferState())

    /** Uri of the APK the user picked for sending. */
    var pendingFile: Uri? = null
    var pendingFileName: String = "app.apk"

    // ---------------- receiver side ----------------

    fun startAdvertising(onError: (String) -> Unit = {}) {
        val options = AdvertisingOptions.Builder().setStrategy(STRATEGY).build()
        client.startAdvertising(deviceName, SERVICE_ID, connectionLifecycle, options)
            .addOnSuccessListener { state.value = state.value.copy(status = "Visible as \"$deviceName\" - waiting for sender") }
            .addOnFailureListener { onError(it.message ?: "Could not start advertising") }
    }

    fun stopAdvertising() {
        client.stopAdvertising()
    }

    // ---------------- sender side ----------------

    fun startDiscovery(onError: (String) -> Unit = {}) {
        peers.value = emptyList()
        val options = DiscoveryOptions.Builder().setStrategy(STRATEGY).build()
        client.startDiscovery(SERVICE_ID, endpointCallback, options)
            .addOnSuccessListener { state.value = state.value.copy(status = "Scanning for nearby devices...") }
            .addOnFailureListener { onError(it.message ?: "Could not start discovery") }
    }

    fun refresh(onError: (String) -> Unit = {}) {
        client.stopDiscovery()
        startDiscovery(onError)
    }

    fun stopDiscovery() = client.stopDiscovery()

    fun connect(peer: Peer, onError: (String) -> Unit = {}) {
        state.value = state.value.copy(status = "Connecting to ${peer.name}...", busy = true)
        client.requestConnection(deviceName, peer.endpointId, connectionLifecycle)
            .addOnFailureListener {
                state.value = state.value.copy(busy = false)
                onError(it.message ?: "Connection failed")
            }
    }

    fun disconnect(peer: Peer) {
        client.disconnectFromEndpoint(peer.endpointId)
        peers.value = peers.value.map { if (it.endpointId == peer.endpointId) it.copy(connected = false) else it }
        state.value = TransferState(status = "Disconnected")
    }

    fun send(peer: Peer, uri: Uri, onError: (String) -> Unit = {}) {
        try {
            val name = displayName(uri)
            // Send the filename first so the receiver can save with the right name.
            client.sendPayload(peer.endpointId, Payload.fromBytes("NAME:$name".toByteArray()))
            val pfd = context.contentResolver.openFileDescriptor(uri, "r")
                ?: return onError("Could not open the selected file")
            val payload = Payload.fromFile(pfd)
            state.value = TransferState(status = "Sending $name to ${peer.name}...", busy = true)
            client.sendPayload(peer.endpointId, payload)
        } catch (e: Exception) {
            onError(e.message ?: "Send failed")
        }
    }

    private fun displayName(uri: Uri): String {
        context.contentResolver.query(uri, null, null, null, null)?.use { c ->
            val idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (idx >= 0 && c.moveToFirst()) return c.getString(idx)
        }
        return uri.lastPathSegment ?: "app.apk"
    }

    fun shutdown() {
        client.stopAllEndpoints()
        client.stopDiscovery()
        client.stopAdvertising()
    }

    // ---------------- callbacks ----------------

    private val endpointCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(id: String, info: DiscoveredEndpointInfo) {
            if (peers.value.none { it.endpointId == id }) {
                peers.value = peers.value + Peer(id, info.endpointName)
            }
        }

        override fun onEndpointLost(id: String) {
            peers.value = peers.value.filterNot { it.endpointId == id && !it.connected }
        }
    }

    private val connectionLifecycle = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(id: String, info: ConnectionInfo) {
            if (peers.value.none { it.endpointId == id }) {
                peers.value = peers.value + Peer(id, info.endpointName)
            }
            // Auto-accept: both sides already chose each other in the UI.
            client.acceptConnection(id, payloadCallback)
            state.value = state.value.copy(status = "Pairing with ${info.endpointName}...")
        }

        override fun onConnectionResult(id: String, result: ConnectionResolution) {
            if (result.status.isSuccess) {
                peers.value = peers.value.map { if (it.endpointId == id) it.copy(connected = true) else it }
                state.value = TransferState(status = "Connected - ready to send")
                client.stopDiscovery()
                pendingFile?.let { uri ->
                    peers.value.firstOrNull { it.endpointId == id }?.let { send(it, uri) }
                }
            } else {
                state.value = TransferState(status = "Connection rejected or failed")
            }
        }

        override fun onDisconnected(id: String) {
            peers.value = peers.value.map { if (it.endpointId == id) it.copy(connected = false) else it }
            state.value = TransferState(status = "Disconnected")
        }
    }

    private var incomingName: String = "received.apk"
    private val incoming = HashMap<Long, Payload>()

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(id: String, payload: Payload) {
            when (payload.type) {
                Payload.Type.BYTES -> {
                    val text = String(payload.asBytes() ?: ByteArray(0))
                    if (text.startsWith("NAME:")) incomingName = text.removePrefix("NAME:")
                }
                Payload.Type.FILE -> {
                    incoming[payload.id] = payload
                    state.value = TransferState(status = "Receiving $incomingName...", busy = true)
                }
            }
        }

        override fun onPayloadTransferUpdate(id: String, update: PayloadTransferUpdate) {
            val total = update.totalBytes
            val progress = if (total > 0) update.bytesTransferred.toFloat() / total else 0f
            when (update.status) {
                PayloadTransferUpdate.Status.IN_PROGRESS ->
                    state.value = state.value.copy(progress = progress, busy = true)
                PayloadTransferUpdate.Status.SUCCESS -> {
                    val payload = incoming.remove(update.payloadId)
                    if (payload != null) {
                        val saved = savePayload(payload, incomingName)
                        state.value = TransferState(status = "Saved to $saved", progress = 1f)
                    } else {
                        state.value = TransferState(status = "Sent successfully", progress = 1f)
                    }
                }
                PayloadTransferUpdate.Status.FAILURE ->
                    state.value = TransferState(status = "Transfer failed")
                PayloadTransferUpdate.Status.CANCELED ->
                    state.value = TransferState(status = "Transfer cancelled")
            }
        }
    }

    private fun savePayload(payload: Payload, name: String): String {
        val downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        val target = File(downloads, name)
        payload.asFile()?.asParcelFileDescriptor()?.let { pfd ->
            java.io.FileInputStream(pfd.fileDescriptor).use { input ->
                FileOutputStream(target).use { output -> input.copyTo(output) }
            }
        }
        return target.absolutePath
    }
}
