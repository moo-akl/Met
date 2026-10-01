// MetBleService — Android foreground service that keeps the BLE
// scan + advertise alive when the app is backgrounded.
//
// Android suspends background apps aggressively. Without a foreground
// service, our BluetoothLeAdvertiser and BluetoothLeScanner callbacks
// stop firing within seconds of the user leaving the app, which
// breaks proximity detection. Promoting the BLE work to a foreground
// service (with the user-visible "Met is detecting nearby people"
// notification) lets the OS keep us scheduled.
//
// The service does NOT own the BLE radio resources directly — it
// only signals the OS that this process is doing user-visible work.
// MetBleModule.kt continues to call BluetoothLeAdvertiser/Scanner,
// but those calls are now allowed to run while backgrounded because
// the process is in the foreground service tier.

package expo.modules.metble

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class MetBleService : Service() {
  companion object {
    private const val CHANNEL_ID = "met_ble_proximity"
    private const val CHANNEL_NAME = "Proximity detection"
    private const val NOTIFICATION_ID = 4242

    fun start(ctx: Context) {
      val intent = Intent(ctx, MetBleService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ctx.startForegroundService(intent)
      } else {
        ctx.startService(intent)
      }
    }

    fun stop(ctx: Context) {
      val intent = Intent(ctx, MetBleService::class.java)
      ctx.stopService(intent)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    ensureChannel()
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    // START_STICKY: if the system kills this service under memory pressure,
    // Android will recreate it (with a null intent). On restart we check
    // SharedPreferences for a persisted owner uid — if found we keep the
    // foreground notification alive so the process stays in the foreground-
    // service tier while the JS bridge reinitialises and restarts BLE.
    // If no uid is found (user explicitly stopped BLE), we tear down
    // immediately so no zombie notification appears.
    if (intent == null) {
      val ctx = applicationContext
      val prefs = ctx.getSharedPreferences("MetBle", android.content.Context.MODE_PRIVATE)
      val hasSession = prefs.getString("ownerUid", null) != null
      if (!hasSession) {
        stopForeground(true)
        stopSelf()
        return START_NOT_STICKY
      }
    }
    return START_STICKY
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      CHANNEL_NAME,
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Keeps Met detecting nearby people while the app is in the background."
      setShowBadge(false)
    }
    nm.createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification {
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Met")
      .setContentText("Detecting nearby people")
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build()
  }
}
