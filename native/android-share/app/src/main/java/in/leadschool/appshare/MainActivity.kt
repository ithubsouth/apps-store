package `in`.leadschool.appshare

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.app.ActivityCompat
import kotlinx.coroutines.launch

/**
 * LEAD App Share — native Android sender & receiver.
 *
 * Send:   picks an APK, discovers nearby devices (Wi-Fi Direct via Nearby
 *         Connections, with Bluetooth discovery underneath) and streams it.
 * Receive: advertises itself by device name; the sender taps the name and
 *         the APK saves into Downloads — nothing else to open on the receiver.
 * Windows: "Get from PC" pulls APKs from the Windows sender over the same
 *         Wi-Fi / hotspot.
 */
class MainActivity : ComponentActivity() {

    private lateinit var transfer: NearbyTransfer

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val name = "LEAD-${Build.MODEL.take(12)}"
        transfer = NearbyTransfer(applicationContext, name)
        handleIncomingShare(intent?.let { i -> if (i.action == android.content.Intent.ACTION_SEND) i.getParcelableExtra<Uri>(android.content.Intent.EXTRA_STREAM) else null })
        setContent { MaterialTheme(colorScheme = lightColorScheme()) { App(transfer) } }
    }

    private fun handleIncomingShare(uri: Uri?) {
        uri ?: return
        transfer.pendingFile = uri
        transfer.pendingFileName = uri.lastPathSegment ?: "app.apk"
    }

    override fun onDestroy() {
        transfer.shutdown()
        super.onDestroy()
    }
}

private fun requiredPermissions(): Array<String> {
    val list = mutableListOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
    )
    if (Build.VERSION.SDK_INT >= 31) {
        list += Manifest.permission.BLUETOOTH_ADVERTISE
        list += Manifest.permission.BLUETOOTH_CONNECT
        list += Manifest.permission.BLUETOOTH_SCAN
    }
    if (Build.VERSION.SDK_INT >= 33) list += Manifest.permission.NEARBY_WIFI_DEVICES
    return list.toTypedArray()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun App(transfer: NearbyTransfer) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    val peers by transfer.peers.collectAsState()
    val state by transfer.state.collectAsState()

    var permissionsGranted by remember { mutableStateOf(false) }
    var receiving by remember { mutableStateOf(false) }
    var scanning by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var lanHost by remember { mutableStateOf("") }
    var lanFiles by remember { mutableStateOf<List<LanFile>>(emptyList()) }
    var lanStatus by remember { mutableStateOf<String?>(null) }
    var lanProgress by remember { mutableStateOf(0f) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result -> permissionsGranted = result.values.all { it } }

    LaunchedEffect(Unit) {
        val needed = requiredPermissions().filter {
            ActivityCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isEmpty()) permissionsGranted = true else permissionLauncher.launch(needed.toTypedArray())
    }

    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        transfer.pendingFile = uri
        transfer.pendingFileName = uri.lastPathSegment ?: "app.apk"
        error = "Ready — tap a device below to connect and send."
    }

    Scaffold(topBar = { TopAppBar(title = { Text("LEAD App Share", fontWeight = FontWeight.Bold) }) }) { pad ->
        Column(
            Modifier
                .padding(pad)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
                .fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (!permissionsGranted) {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Permissions needed", fontWeight = FontWeight.Bold)
                        Text(
                            "Wi-Fi Direct and Bluetooth discovery need nearby-device and location permissions.",
                            style = MaterialTheme.typography.bodySmall
                        )
                        Button(onClick = { permissionLauncher.launch(requiredPermissions()) }) {
                            Text("Grant permissions")
                        }
                    }
                }
            }

            // ---------- Receive ----------
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Download, null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.width(8.dp))
                        Text("Receive", fontWeight = FontWeight.Bold)
                    }
                    Text(
                        "Keep this screen open. The sender sees this device name and sends straight to it — the APK lands in Downloads.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Button(
                        enabled = permissionsGranted,
                        onClick = {
                            if (receiving) {
                                transfer.stopAdvertising(); receiving = false
                            } else {
                                transfer.startAdvertising { error = it }; receiving = true
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(if (receiving) Icons.Default.Close else Icons.Default.Wifi, null)
                        Spacer(Modifier.width(8.dp))
                        Text(if (receiving) "Stop receiving" else "Make this device receivable")
                    }
                }
            }

            // ---------- Send ----------
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Send, null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.width(8.dp))
                        Text("Send over Wi-Fi Direct", fontWeight = FontWeight.Bold)
                    }
                    Text(
                        transfer.pendingFile?.let { "Selected: ${transfer.pendingFileName}" }
                            ?: "Pick an APK, then tap the receiving device in the list.",
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            enabled = permissionsGranted,
                            onClick = { filePicker.launch(arrayOf("application/vnd.android.package-archive", "*/*")) },
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.UploadFile, null)
                            Spacer(Modifier.width(6.dp))
                            Text("Pick APK")
                        }
                        OutlinedButton(
                            enabled = permissionsGranted,
                            onClick = {
                                error = null
                                if (scanning) {
                                    transfer.stopDiscovery(); scanning = false
                                } else {
                                    transfer.startDiscovery { error = it }; scanning = true
                                }
                            },
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(if (scanning) Icons.Default.Close else Icons.Default.Search, null)
                            Spacer(Modifier.width(6.dp))
                            Text(if (scanning) "Stop scan" else "Find devices")
                        }
                    }

                    if (scanning) {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                if (peers.isEmpty()) "Scanning… receivers must open this app and tap “Make this device receivable”."
                                else "Nearby devices:",
                                style = MaterialTheme.typography.bodySmall
                            )
                            TextButton(onClick = { transfer.refresh { error = it } }) {
                                Icon(Icons.Default.Refresh, null, Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Refresh")
                            }
                        }
                    }

                    peers.forEach { peer ->
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = if (peer.connected) MaterialTheme.colorScheme.primaryContainer
                            else MaterialTheme.colorScheme.surfaceVariant,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .clickable(enabled = !state.busy) {
                                        if (peer.connected) transfer.disconnect(peer)
                                        else transfer.connect(peer) { error = it }
                                    }
                                    .padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    if (peer.connected) Icons.Default.CheckCircle else Icons.Default.Smartphone,
                                    null,
                                    tint = MaterialTheme.colorScheme.primary
                                )
                                Spacer(Modifier.width(10.dp))
                                Text(peer.name, Modifier.weight(1f), fontWeight = FontWeight.Medium)
                                Text(
                                    if (peer.connected) "Connected — tap to disconnect" else "Tap to connect & send",
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                        }
                    }

                    if (state.progress in 0.01f..0.99f) {
                        LinearProgressIndicator(progress = { state.progress }, modifier = Modifier.fillMaxWidth())
                    }
                    Text(state.status, style = MaterialTheme.typography.bodySmall)
                }
            }

            // ---------- Get from Windows PC ----------
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Computer, null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.width(8.dp))
                        Text("Get from a Windows PC", fontWeight = FontWeight.Bold)
                    }
                    Text(
                        "Run LEAD App Share on the PC (same Wi-Fi, or connect the phone to the PC's hotspot) and enter the address it shows, e.g. 192.168.1.20.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = lanHost,
                            onValueChange = { lanHost = it },
                            placeholder = { Text("PC address") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        Button(onClick = {
                            scope.launch {
                                lanStatus = "Looking for PC…"; lanProgress = 0f
                                runCatching { LanClient.list(lanHost) }
                                    .onSuccess { lanFiles = it; lanStatus = if (it.isEmpty()) "PC has no APKs loaded." else null }
                                    .onFailure { lanStatus = "PC not reachable at $lanHost. Same Wi-Fi? App running?" }
                            }
                        }) { Text("Find") }
                    }
                    lanFiles.forEach { f ->
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        scope.launch {
                                            lanStatus = "Receiving ${f.name}…"
                                            runCatching { LanClient.download(f) { lanProgress = it } }
                                                .onSuccess { lanStatus = "Saved to $it"; lanProgress = 1f }
                                                .onFailure { lanStatus = "Transfer failed. Try again." }
                                        }
                                    }
                                    .padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.Android, null, tint = MaterialTheme.colorScheme.primary)
                                Spacer(Modifier.width(10.dp))
                                Text(f.name, Modifier.weight(1f), fontWeight = FontWeight.Medium)
                                Text("Tap to receive", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                    if (lanProgress in 0.01f..0.99f) {
                        LinearProgressIndicator(progress = { lanProgress }, modifier = Modifier.fillMaxWidth())
                    }
                    lanStatus?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                }
            }

            error?.let {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                    Text(it, Modifier.padding(12.dp), style = MaterialTheme.typography.bodySmall)
                }
            }

            TextButton(
                onClick = {
                    context.startActivity(android.content.Intent(Settings.ACTION_WIFI_SETTINGS))
                },
                modifier = Modifier.fillMaxWidth()
            ) { Text("Open Wi-Fi settings") }

            TextButton(
                onClick = {
                    context.startActivity(android.content.Intent(Settings.ACTION_SETTINGS))
                },
                modifier = Modifier.fillMaxWidth()
            ) { Text("Open system settings") }
        }
    }
}
