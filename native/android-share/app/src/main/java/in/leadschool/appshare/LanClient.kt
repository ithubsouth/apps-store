package `in`.leadschool.appshare

import android.os.Environment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

data class LanFile(val name: String, val size: Long, val url: String)

/**
 * Pulls APKs from the Windows sender app, which serves them over HTTP on the
 * same Wi-Fi network or the phone's hotspot.
 */
object LanClient {

    suspend fun list(host: String): List<LanFile> = withContext(Dispatchers.IO) {
        val base = normalize(host)
        val json = URL("$base/files").readText()
        val array = JSONArray(json)
        (0 until array.length()).map { i ->
            val o = array.getJSONObject(i)
            LanFile(o.getString("name"), o.getLong("size"), "$base${o.getString("path")}")
        }
    }

    suspend fun download(file: LanFile, onProgress: (Float) -> Unit): String =
        withContext(Dispatchers.IO) {
            val downloads =
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            val target = File(downloads, file.name)
            val conn = URL(file.url).openConnection() as HttpURLConnection
            conn.connectTimeout = 10_000
            conn.inputStream.use { input ->
                FileOutputStream(target).use { output ->
                    val buffer = ByteArray(64 * 1024)
                    var read: Int
                    var total = 0L
                    while (input.read(buffer).also { read = it } > 0) {
                        output.write(buffer, 0, read)
                        total += read
                        if (file.size > 0) onProgress(total.toFloat() / file.size)
                    }
                }
            }
            target.absolutePath
        }

    private fun normalize(host: String): String {
        val trimmed = host.trim().removeSuffix("/")
        return if (trimmed.startsWith("http")) trimmed else "http://$trimmed:8756"
    }
}
