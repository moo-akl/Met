// MetBleModule — Android iBeacon advertise + scan for the Met app.
//
// We broadcast and detect using Apple's iBeacon manufacturer-data
// format. iBeacon advertisements have a fixed 23-byte payload after
// the 2-byte Apple company ID:
//
//   [0x02, 0x15,        // iBeacon prefix
//    UUID  (16 bytes),  // proximity UUID (big-endian)
//    major (2 bytes),   // big-endian unsigned 16-bit
//    minor (2 bytes),   // big-endian unsigned 16-bit
//    txPower (1 byte)]  // signed measured-power-at-1m (calibration)
//
// Apple's iBeacon protocol is technically reserved by Apple, but
// every major BLE chipset in the wild accepts the manufacturer-data
// frame, and CoreLocation on iOS will parse it just like any
// "official" iBeacon. This is what the original Flutter MVP shipped
// (via flutterBeacon) and it interoperates cleanly with iPhones.
//
// API levels:
//   - BluetoothLeAdvertiser is API 21+
//   - BluetoothLeScanner is API 21+
//   - Runtime BLE permissions changed at API 31 (Android 12) — the
//     JS side prompts via PermissionsAndroid in `permissions.tsx`.

package expo.modules.metble

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.ParcelUuid
import android.util.Log
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue as FirestoreFieldValue
import com.google.firebase.firestore.FirebaseFirestore

private const val TAG = "MetBleModule"
private val MET_SERVICE_UUID: UUID = UUID.fromString("4d455400-7770-4ac2-9b3d-000000000001")
private val MET_HASH_CHARACTERISTIC_UUID: UUID =
  UUID.fromString("4d455400-7770-4ac2-9b3d-000000000002")
private const val APPLE_COMPANY_ID = 0x004C
private const val IBEACON_TYPE: Byte = 0x02
private const val IBEACON_LENGTH: Byte = 0x15
private const val DEFAULT_TX_POWER: Byte = -59 // matches CoreLocation default at 1m

class MetBleModule : Module() {
  // ----- Legacy GATT advertiser (kept exported for older JS code).
  private var advertiser: BluetoothLeAdvertiser? = null
  private var callback: AdvertiseCallback? = null

  // ----- GATT server for the on-detection fallback. Symmetric with
  // the iOS side: a peer scanner that sees our service UUID but no
  // extractable hash will connect, discover services, and read this
  // characteristic to get the 8-byte identity hash. Android peers
  // already include the hash in serviceData so they normally don't
  // need this path — but exposing the server makes the protocol
  // symmetric and helps if serviceData is ever stripped (some OEM
  // ROMs do it under low-power conditions).
  private var gattServer: BluetoothGattServer? = null
  private var gattServerCallback: BluetoothGattServerCallback? = null
  private var currentHashBytes: ByteArray? = null

  // ----- iBeacon advertiser.
  private var beaconAdvertiser: BluetoothLeAdvertiser? = null
  private var beaconCallback: AdvertiseCallback? = null

  // ----- iBeacon scanner. One scanner instance shared across all UUIDs;
  // the scan callback dispatches per-UUID events to JS.
  private var scanner: BluetoothLeScanner? = null
  private var scanCallback: ScanCallback? = null
  private val rangingUuids: MutableSet<UUID> = mutableSetOf()

  // ----- Foreground-service refcount. We start the foreground service
  // when ANY BLE activity (advertise, scan, or explicit JS request)
  // begins and stop it when ALL activity ends. Using simple booleans
  // per kind keeps this simple — Android's startForegroundService is
  // idempotent.
  private var fgAdvertising = false
  private var fgScanning = false
  // Explicit JS-requested background mode. Set by setBackgroundMode()
  // so the scanner (react-native-ble-plx, a separate JS library that
  // doesn't go through this module) can keep the foreground service
  // alive for the duration of BLE proximity detection even if
  // advertising is not available on the device.
  private var fgBackground = false

  // ── Background peer-detection context ───────────────────────────────────
  // Captured when startAdvertising is called so the native background
  // scanner can fill the Firestore doc's observerUid / observerHash fields
  // without requiring an active JS bridge.
  private var ownerUid: String? = null
  private var ownerHashHex: String? = null

  // Per-peer native cooldown: peerHashHex → last-detection epoch-ms.
  // Prevents the same pair from flooding Firestore within 30 minutes,
  // matching the encounter dedup window used by the Cloud Function.
  private val detectionCooldowns = HashMap<String, Long>()
  private val DETECTION_COOLDOWN_MS = 30L * 60L * 1000L

  // Background BLE scanner — runs alongside the GATT advertiser and is
  // filtered to MET_SERVICE_UUID so we only wake up for Met peers.
  private var bgScanner: BluetoothLeScanner? = null
  private var bgScanCallback: ScanCallback? = null

  // Active GATT client connections used to read the hash characteristic
  // from backgrounded iOS peers (which strip serviceData / localName and
  // only keep the service UUID in their advertisement). Keyed by device
  // Bluetooth address. Capped at MAX_PENDING_GATT to avoid exhausting
  // the OS connection slot limit.
  private val pendingGattReads = HashMap<String, android.bluetooth.BluetoothGatt>()
  private val MAX_PENDING_GATT = 3

  private fun ensureForegroundService() {
    val ctx = context() ?: return
    if (fgAdvertising || fgScanning || fgBackground) {
      MetBleService.start(ctx)
    }
  }

  private fun maybeStopForegroundService() {
    val ctx = context() ?: return
    if (!fgAdvertising && !fgScanning && !fgBackground) {
      MetBleService.stop(ctx)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoMetBle")

    // Per-UUID ranged-beacon batches. Payload shape:
    //   { uuid: string,
    //     beacons: [{ major: int, minor: int, rssi: int,
    //                 accuracy: number, proximity: int }] }
    Events("onBeaconRanged")

    // ----- Legacy GATT (unchanged).
    AsyncFunction("startAdvertising") { uid: String, hashHex: String ->
      ownerUid = uid
      ownerHashHex = hashHex
      saveOwnerToPrefs(uid, hashHex)
      return@AsyncFunction startGattAdvertisingImpl(hashHex)
    }

    AsyncFunction("stopAdvertising") {
      stopGattAdvertisingImpl()
    }

    AsyncFunction("isAvailable") {
      return@AsyncFunction isGattAvailableImpl()
    }

    // ----- iBeacon advertise.
    AsyncFunction("startBeaconAdvertising") {
      uuidString: String, major: Int, minor: Int ->
      return@AsyncFunction startBeaconAdvertisingImpl(uuidString, major, minor)
    }

    AsyncFunction("stopBeaconAdvertising") {
      stopBeaconAdvertisingImpl()
    }

    AsyncFunction("isBeaconAdvertisingAvailable") {
      return@AsyncFunction isBeaconAdvertisingAvailableImpl()
    }

    // ----- Explicit background-mode control. Called by JS when BLE
    // proximity starts/stops so the foreground service stays alive
    // even when GATT advertising is unavailable on the device.
    AsyncFunction("setBackgroundMode") { active: Boolean ->
      setBackgroundModeImpl(active)
    }

    // ----- iBeacon range (scan).
    AsyncFunction("startBeaconRanging") { uuidString: String ->
      return@AsyncFunction startBeaconRangingImpl(uuidString)
    }

    AsyncFunction("stopBeaconRanging") { uuidString: String ->
      stopBeaconRangingImpl(uuidString)
    }

    AsyncFunction("stopAllBeaconRanging") {
      stopAllBeaconRangingImpl()
    }

    OnDestroy {
      stopGattAdvertisingImpl()
      stopBeaconAdvertisingImpl()
      stopAllBeaconRangingImpl()
    }
  }

  // ===== Helpers =====

  private fun context(): Context? = appContext.reactContext?.applicationContext

  private fun saveOwnerToPrefs(uid: String, hashHex: String) {
    context()?.getSharedPreferences("MetBle", Context.MODE_PRIVATE)
      ?.edit()
      ?.putString("ownerUid", uid)
      ?.putString("ownerHash", hashHex)
      ?.apply()
  }

  private fun clearOwnerFromPrefs() {
    context()?.getSharedPreferences("MetBle", Context.MODE_PRIVATE)
      ?.edit()
      ?.remove("ownerUid")
      ?.remove("ownerHash")
      ?.apply()
  }

  private fun bluetoothAdapter(): BluetoothAdapter? {
    val ctx = context() ?: return null
    val manager = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    return manager?.adapter
  }

  private fun hasAdvertisePermission(): Boolean {
    val ctx = context() ?: return false
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      ContextCompat.checkSelfPermission(
        ctx, Manifest.permission.BLUETOOTH_ADVERTISE,
      ) == PackageManager.PERMISSION_GRANTED
    } else {
      true
    }
  }

  private fun hasScanPermission(): Boolean {
    val ctx = context() ?: return false
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      ContextCompat.checkSelfPermission(
        ctx, Manifest.permission.BLUETOOTH_SCAN,
      ) == PackageManager.PERMISSION_GRANTED
    } else {
      // Pre-Android 12: BLE scan was tied to ACCESS_FINE_LOCATION.
      ContextCompat.checkSelfPermission(
        ctx, Manifest.permission.ACCESS_FINE_LOCATION,
      ) == PackageManager.PERMISSION_GRANTED
    }
  }

  private fun hexToBytes(hex: String): ByteArray {
    val clean = hex.lowercase()
    require(clean.length % 2 == 0) { "hex string has odd length" }
    val out = ByteArray(clean.length / 2)
    for (i in out.indices) {
      val hi = Character.digit(clean[i * 2], 16)
      val lo = Character.digit(clean[i * 2 + 1], 16)
      require(hi >= 0 && lo >= 0) { "invalid hex" }
      out[i] = ((hi shl 4) or lo).toByte()
    }
    return out
  }

  // ===== Background mode =====

  private fun setBackgroundModeImpl(active: Boolean) {
    fgBackground = active
    if (active) {
      ensureForegroundService()
    } else {
      maybeStopForegroundService()
    }
  }

  // ===== Legacy GATT =====

  private fun isGattAvailableImpl(): Boolean {
    val adapter = bluetoothAdapter() ?: return false
    if (!adapter.isEnabled) return false
    if (!adapter.isMultipleAdvertisementSupported) return false
    if (!hasAdvertisePermission()) return false
    return adapter.bluetoothLeAdvertiser != null
  }

  @Suppress("MissingPermission")
  private fun startGattAdvertisingImpl(hashHex: String): Boolean {
    if (!isGattAvailableImpl()) {
      Log.w(TAG, "BLE GATT advertising not available")
      return false
    }
    val adapter = bluetoothAdapter() ?: return false
    val adv = adapter.bluetoothLeAdvertiser ?: return false

    callback?.let { try { adv.stopAdvertising(it) } catch (_: Exception) {} }

    // Connectable (true) so iOS peers can perform GATT-on-detection
    // when their backgrounded scanner sees us. Android-to-Android
    // proximity still works via serviceData without ever connecting.
    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
      .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
      .setConnectable(true)
      .setTimeout(0)
      .build()

    val payload = try {
      hexToBytes(hashHex).copyOf(8)
    } catch (e: Exception) {
      Log.w(TAG, "invalid hashHex: $hashHex", e)
      return false
    }
    currentHashBytes = payload
    ensureGattServer(payload)

    val parcelUuid = ParcelUuid(MET_SERVICE_UUID)
    val data = AdvertiseData.Builder()
      .setIncludeDeviceName(false)
      .setIncludeTxPowerLevel(false)
      .addServiceUuid(parcelUuid)
      .addServiceData(parcelUuid, payload)
      .build()

    val cb = object : AdvertiseCallback() {
      override fun onStartFailure(errorCode: Int) {
        Log.w(TAG, "GATT advertising failed: $errorCode")
      }
    }
    callback = cb
    advertiser = adv

    return try {
      adv.startAdvertising(settings, data, cb)
      fgAdvertising = true
      ensureForegroundService()
      // Start the background scanner so peers are detected even when the
      // JS thread is suspended (foreground service keeps us alive on Android).
      startBackgroundScannerImpl()
      true
    } catch (e: SecurityException) {
      Log.w(TAG, "GATT advertising denied", e)
      false
    } catch (e: Exception) {
      Log.w(TAG, "GATT advertising threw", e)
      false
    }
  }

  @Suppress("MissingPermission")
  private fun stopGattAdvertisingImpl() {
    val adv = advertiser ?: return
    val cb = callback ?: return
    try {
      adv.stopAdvertising(cb)
    } catch (e: Exception) {
      Log.w(TAG, "stopAdvertising threw", e)
    }
    callback = null
    advertiser = null
    fgAdvertising = false
    maybeStopForegroundService()
    teardownGattServer()
    currentHashBytes = null
    stopBackgroundScannerImpl()
    closeAllPendingGattReads()
    ownerUid = null
    ownerHashHex = null
    clearOwnerFromPrefs()
  }

  // ===== GATT server (for iOS GATT-on-detection) =====

  @Suppress("MissingPermission")
  private fun ensureGattServer(hashBytes: ByteArray) {
    val ctx = context() ?: return
    if (gattServer != null) {
      // Server already running — just refresh the characteristic
      // value in case the hash changed (different uid).
      val service = gattServer?.getService(MET_SERVICE_UUID)
      val ch = service?.getCharacteristic(MET_HASH_CHARACTERISTIC_UUID)
      if (ch != null) {
        ch.value = hashBytes.copyOf(8)
      }
      return
    }
    val mgr = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager ?: return

    val cb = object : BluetoothGattServerCallback() {
      override fun onConnectionStateChange(
        device: BluetoothDevice?, status: Int, newState: Int
      ) {
        // No-op. We don't track connections — Android handles the
        // pairing and we only respond to characteristic reads.
        if (newState == BluetoothProfile.STATE_DISCONNECTED) {
          Log.d(TAG, "GATT server: peer disconnected")
        }
      }

      override fun onCharacteristicReadRequest(
        device: BluetoothDevice?,
        requestId: Int,
        offset: Int,
        characteristic: BluetoothGattCharacteristic?
      ) {
        val server = gattServer ?: return
        val value = currentHashBytes ?: ByteArray(8)
        val uuid = characteristic?.uuid
        try {
          if (uuid == MET_HASH_CHARACTERISTIC_UUID && offset <= value.size) {
            val slice = value.copyOfRange(offset, value.size)
            server.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, slice)
          } else {
            server.sendResponse(
              device, requestId, BluetoothGatt.GATT_READ_NOT_PERMITTED, 0, null
            )
          }
        } catch (e: SecurityException) {
          Log.w(TAG, "GATT server respond denied", e)
        } catch (e: Exception) {
          Log.w(TAG, "GATT server respond threw", e)
        }
      }
    }

    val server = try {
      mgr.openGattServer(ctx, cb)
    } catch (e: SecurityException) {
      Log.w(TAG, "openGattServer denied", e)
      return
    } catch (e: Exception) {
      Log.w(TAG, "openGattServer threw", e)
      return
    } ?: return

    val characteristic = BluetoothGattCharacteristic(
      MET_HASH_CHARACTERISTIC_UUID,
      BluetoothGattCharacteristic.PROPERTY_READ,
      BluetoothGattCharacteristic.PERMISSION_READ,
    )
    characteristic.value = hashBytes.copyOf(8)
    val service = BluetoothGattService(
      MET_SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY
    )
    service.addCharacteristic(characteristic)
    try {
      server.addService(service)
    } catch (e: Exception) {
      Log.w(TAG, "addService threw", e)
    }

    gattServer = server
    gattServerCallback = cb
  }

  @Suppress("MissingPermission")
  private fun teardownGattServer() {
    val server = gattServer ?: return
    try {
      server.clearServices()
      server.close()
    } catch (e: Exception) {
      Log.w(TAG, "GATT server close threw", e)
    }
    gattServer = null
    gattServerCallback = null
  }

  // ===== iBeacon advertise =====

  private fun isBeaconAdvertisingAvailableImpl(): Boolean {
    val adapter = bluetoothAdapter() ?: return false
    if (!adapter.isEnabled) return false
    if (!adapter.isMultipleAdvertisementSupported) return false
    if (!hasAdvertisePermission()) return false
    return adapter.bluetoothLeAdvertiser != null
  }

  // Build the 23-byte iBeacon manufacturer-data payload that follows
  // the 2-byte Apple company ID (which AdvertiseData.Builder prepends
  // automatically when `addManufacturerData(0x004C, payload)` is used).
  private fun buildBeaconPayload(uuid: UUID, major: Int, minor: Int): ByteArray {
    val buf = ByteBuffer.allocate(23).order(ByteOrder.BIG_ENDIAN)
    buf.put(IBEACON_TYPE)
    buf.put(IBEACON_LENGTH)
    // UUID — most-significant bits first (big-endian).
    buf.putLong(uuid.mostSignificantBits)
    buf.putLong(uuid.leastSignificantBits)
    // Major / minor — unsigned 16-bit, big-endian.
    buf.putShort((major and 0xFFFF).toShort())
    buf.putShort((minor and 0xFFFF).toShort())
    buf.put(DEFAULT_TX_POWER)
    return buf.array()
  }

  @Suppress("MissingPermission")
  private fun startBeaconAdvertisingImpl(uuidString: String, major: Int, minor: Int): Boolean {
    if (!isBeaconAdvertisingAvailableImpl()) {
      Log.w(TAG, "iBeacon advertising not available")
      return false
    }
    val uuid = try {
      UUID.fromString(uuidString)
    } catch (e: Exception) {
      Log.w(TAG, "invalid iBeacon UUID: $uuidString", e)
      return false
    }
    val adapter = bluetoothAdapter() ?: return false
    val adv = adapter.bluetoothLeAdvertiser ?: return false

    beaconCallback?.let { try { adv.stopAdvertising(it) } catch (_: Exception) {} }

    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
      .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
      .setConnectable(false)
      .setTimeout(0)
      .build()

    val payload = buildBeaconPayload(uuid, major, minor)
    // Apple iBeacon: company ID 0x004C followed by the 23-byte payload.
    // The system serializes as: 0xFF (manufacturer-data type) +
    // 0x4C 0x00 (LE company ID) + 23 bytes payload.
    val data = AdvertiseData.Builder()
      .setIncludeDeviceName(false)
      .setIncludeTxPowerLevel(false)
      .addManufacturerData(APPLE_COMPANY_ID, payload)
      .build()

    val cb = object : AdvertiseCallback() {
      override fun onStartFailure(errorCode: Int) {
        Log.w(TAG, "iBeacon advertising failed: $errorCode")
      }
    }
    beaconCallback = cb
    beaconAdvertiser = adv

    return try {
      adv.startAdvertising(settings, data, cb)
      // iBeacon advertise shares the same foreground-service refcount
      // as legacy GATT — only one of the two advertise paths is active
      // at a time today, but routing both through `fgAdvertising`
      // keeps the service lifecycle correct if a future caller mixes
      // them.
      fgAdvertising = true
      ensureForegroundService()
      true
    } catch (e: SecurityException) {
      Log.w(TAG, "iBeacon advertising denied", e)
      false
    } catch (e: Exception) {
      Log.w(TAG, "iBeacon advertising threw", e)
      false
    }
  }

  @Suppress("MissingPermission")
  private fun stopBeaconAdvertisingImpl() {
    val adv = beaconAdvertiser ?: return
    val cb = beaconCallback ?: return
    try {
      adv.stopAdvertising(cb)
    } catch (e: Exception) {
      Log.w(TAG, "stopBeaconAdvertising threw", e)
    }
    beaconCallback = null
    beaconAdvertiser = null
    fgAdvertising = false
    maybeStopForegroundService()
  }

  // ===== iBeacon scan =====

  @Suppress("MissingPermission")
  private fun startBeaconRangingImpl(uuidString: String): Boolean {
    if (!hasScanPermission()) {
      Log.w(TAG, "iBeacon scan denied — missing BLE/location permission")
      return false
    }
    val uuid = try {
      UUID.fromString(uuidString)
    } catch (e: Exception) {
      Log.w(TAG, "invalid iBeacon scan UUID: $uuidString", e)
      return false
    }
    val adapter = bluetoothAdapter() ?: return false
    if (!adapter.isEnabled) {
      Log.w(TAG, "BT off — cannot scan")
      return false
    }
    val s = adapter.bluetoothLeScanner ?: return false

    rangingUuids.add(uuid)

    // (Re)start the scan with no filters. We can't filter on
    // manufacturer data prefix reliably across vendors, so we accept
    // every BLE advertisement and parse iBeacon frames in the callback.
    // SCAN_MODE_LOW_LATENCY gives us ~1 second discovery latency at
    // some battery cost; matches CoreLocation ranging cadence.
    scanCallback?.let { try { s.stopScan(it) } catch (_: Exception) {} }
    val settings = ScanSettings.Builder()
      .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
      .setReportDelay(0)
      .build()
    val cb = object : ScanCallback() {
      override fun onScanResult(callbackType: Int, result: ScanResult) {
        handleScanResult(result)
      }

      override fun onBatchScanResults(results: MutableList<ScanResult>) {
        for (r in results) handleScanResult(r)
      }

      override fun onScanFailed(errorCode: Int) {
        Log.w(TAG, "iBeacon scan failed: $errorCode")
      }
    }
    scanCallback = cb
    scanner = s
    return try {
      s.startScan(emptyList<ScanFilter>(), settings, cb)
      fgScanning = true
      ensureForegroundService()
      true
    } catch (e: SecurityException) {
      Log.w(TAG, "iBeacon scan denied", e)
      rangingUuids.remove(uuid)
      false
    } catch (e: Exception) {
      Log.w(TAG, "iBeacon scan threw", e)
      rangingUuids.remove(uuid)
      false
    }
  }

  @Suppress("MissingPermission")
  private fun stopBeaconRangingImpl(uuidString: String) {
    val uuid = try {
      UUID.fromString(uuidString)
    } catch (e: Exception) {
      return
    }
    rangingUuids.remove(uuid)
    if (rangingUuids.isEmpty()) {
      stopAllBeaconRangingImpl()
    }
  }

  @Suppress("MissingPermission")
  private fun stopAllBeaconRangingImpl() {
    val s = scanner ?: return
    val cb = scanCallback ?: return
    try { s.stopScan(cb) } catch (_: Exception) {}
    scanner = null
    scanCallback = null
    rangingUuids.clear()
    fgScanning = false
    maybeStopForegroundService()
  }

  // Parse iBeacon frame from a scan result and emit the matching
  // event if its UUID is one we're ranging. Rough RSSI→accuracy
  // estimator mirrors CoreLocation's: free-space path-loss with a
  // per-iBeacon calibrated 1-meter reference (the txPower byte).
  private fun handleScanResult(result: ScanResult) {
    val record = result.scanRecord ?: return
    val mfrData = record.getManufacturerSpecificData(APPLE_COMPANY_ID) ?: return
    if (mfrData.size < 23) return
    if (mfrData[0] != IBEACON_TYPE || mfrData[1] != IBEACON_LENGTH) return

    val buf = ByteBuffer.wrap(mfrData, 2, 21).order(ByteOrder.BIG_ENDIAN)
    val msb = buf.long
    val lsb = buf.long
    val uuid = UUID(msb, lsb)
    if (!rangingUuids.contains(uuid)) return

    val major = buf.short.toInt() and 0xFFFF
    val minor = buf.short.toInt() and 0xFFFF
    val txPower = buf.get().toInt()
    val rssi = result.rssi
    val accuracy = estimateAccuracy(txPower, rssi)
    // Match CLProximity raw values: 0=unknown, 1=immediate (<0.5m),
    // 2=near (<3m), 3=far (>=3m).
    val proximity = when {
      accuracy < 0 -> 0
      accuracy < 0.5 -> 1
      accuracy < 3.0 -> 2
      else -> 3
    }

    val payload = listOf(
      mapOf(
        "major" to major,
        "minor" to minor,
        "rssi" to rssi,
        "accuracy" to accuracy,
        "proximity" to proximity,
      ),
    )
    sendEvent(
      "onBeaconRanged",
      mapOf(
        "uuid" to uuid.toString().lowercase(),
        "beacons" to payload,
      ),
    )
  }

  private fun estimateAccuracy(txPower: Int, rssi: Int): Double {
    if (rssi == 0) return -1.0
    val ratio = rssi.toDouble() / txPower.toDouble()
    return if (ratio < 1.0) {
      Math.pow(ratio, 10.0)
    } else {
      0.89976 * Math.pow(ratio, 7.7095) + 0.111
    }
  }

  // ===== Background peer-detection scanner =====
  //
  // Runs alongside the GATT advertiser (started in startGattAdvertisingImpl).
  // Filtered to MET_SERVICE_UUID so the scan callback only wakes us for
  // actual Met peers — minimal battery impact compared to an unfiltered scan.
  //
  // On Android, the foreground service (MetBleService) keeps the process in
  // the foreground-service tier, so this scanner continues even when the
  // app's Activity is destroyed and the JS thread is suspended.

  @Suppress("MissingPermission")
  private fun startBackgroundScannerImpl() {
    if (bgScanner != null) return // already running
    if (!hasScanPermission()) {
      Log.w(TAG, "Background scanner: missing scan permission")
      return
    }
    val adapter = bluetoothAdapter() ?: return
    if (!adapter.isEnabled) return
    val s = adapter.bluetoothLeScanner ?: return

    // Filter to our service UUID so we don't process every BLE device in
    // the vicinity — important at crowded venues.
    val filter = ScanFilter.Builder()
      .setServiceUuid(ParcelUuid(MET_SERVICE_UUID))
      .build()
    // SCAN_MODE_LOW_POWER gives ~5s discovery latency, which is acceptable
    // for encounter logging. LOW_LATENCY would drain battery too fast in
    // background.
    val settings = ScanSettings.Builder()
      .setScanMode(ScanSettings.SCAN_MODE_LOW_POWER)
      .setReportDelay(0)
      .build()

    val cb = object : ScanCallback() {
      override fun onScanResult(callbackType: Int, result: ScanResult) {
        handleBackgroundScanResult(result)
      }
      override fun onBatchScanResults(results: MutableList<ScanResult>) {
        for (r in results) handleBackgroundScanResult(r)
      }
      override fun onScanFailed(errorCode: Int) {
        Log.w(TAG, "Background scanner failed: $errorCode")
        bgScanner = null
        bgScanCallback = null
      }
    }

    try {
      s.startScan(listOf(filter), settings, cb)
      bgScanner = s
      bgScanCallback = cb
      Log.d(TAG, "Background BLE scanner started")
    } catch (e: SecurityException) {
      Log.w(TAG, "Background scanner denied", e)
    } catch (e: Exception) {
      Log.w(TAG, "Background scanner threw", e)
    }
  }

  @Suppress("MissingPermission")
  private fun stopBackgroundScannerImpl() {
    val s = bgScanner ?: return
    val cb = bgScanCallback ?: return
    try { s.stopScan(cb) } catch (_: Exception) {}
    bgScanner = null
    bgScanCallback = null
    Log.d(TAG, "Background BLE scanner stopped")
  }

  // Called for every advertisement that matches MET_SERVICE_UUID. We try
  // three sources for the peer's 8-byte identity hash, in priority order:
  //
  //   1. GATT serviceData (Android GATT advertising, full 8-byte hash).
  //   2. Local name with "met:" prefix (iOS in foreground, full 8-byte hash).
  //   3. Service UUID only → initiate GATT connect to read hash characteristic
  //      (iOS in background strips everything except the service UUID).
  private fun handleBackgroundScanResult(result: ScanResult) {
    val record = result.scanRecord ?: return
    var peerHash: String? = null

    // ── Source 1: GATT serviceData ────────────────────────────────────────
    val serviceDataMap = record.serviceData
    val parcelUuid = ParcelUuid(MET_SERVICE_UUID)
    val hashData = serviceDataMap?.get(parcelUuid)
    if (hashData != null && hashData.size >= 8) {
      peerHash = hashData.take(8).joinToString("") { byte -> "%02x".format(byte) }
    }

    // ── Source 2: local name ("met:" + 16 hex chars) ──────────────────────
    if (peerHash == null) {
      val localName = record.deviceName
      if (localName != null &&
        localName.length >= 20 &&
        localName.startsWith("met:")
      ) {
        val tail = localName.substring(4)
        if (tail.matches(Regex("[0-9a-fA-F]{16}.*"))) {
          peerHash = tail.substring(0, 16).lowercase()
        }
      }
    }

    if (peerHash != null) {
      // Hash found directly — run cooldown check then write.
      processDetectedHash(peerHash, result.rssi)
    } else {
      // ── Source 3: GATT connect (iOS in background) ────────────────────
      // No hash in advertisement — the peer is a backgrounded iOS device.
      // Connect to it and read the MET_HASH_CHARACTERISTIC_UUID value.
      val device = result.device ?: return
      initiateGattHashRead(device)
    }
  }

  private fun processDetectedHash(peerHash: String, rssi: Int) {
    val myUid = ownerUid ?: return
    val myHash = ownerHashHex ?: return
    if (peerHash == myHash) return // self-detection

    // Check and update cooldown
    val now = System.currentTimeMillis()
    val lastTime = detectionCooldowns[peerHash]
    if (lastTime != null && now - lastTime < DETECTION_COOLDOWN_MS) return
    detectionCooldowns[peerHash] = now

    writeDetectionToFirestore(myUid, myHash, peerHash, rssi)
  }

  @Suppress("MissingPermission")
  private fun initiateGattHashRead(device: android.bluetooth.BluetoothDevice) {
    val addr = device.address
    // Skip if already connecting to this device or at connection limit
    if (pendingGattReads.containsKey(addr)) return
    if (pendingGattReads.size >= MAX_PENDING_GATT) return
    // Quick-exit if we already know the hash for this peer
    // (not stored, so just proceed)

    val ctx = context() ?: return

    val gattCallback = object : android.bluetooth.BluetoothGattCallback() {
      override fun onConnectionStateChange(
        gatt: android.bluetooth.BluetoothGatt, status: Int, newState: Int
      ) {
        when (newState) {
          android.bluetooth.BluetoothProfile.STATE_CONNECTED -> {
            try { gatt.discoverServices() } catch (e: SecurityException) {
              Log.w(TAG, "GATT discoverServices denied", e)
              cleanupGattRead(gatt)
            }
          }
          android.bluetooth.BluetoothProfile.STATE_DISCONNECTED -> {
            cleanupGattRead(gatt)
          }
        }
      }

      override fun onServicesDiscovered(
        gatt: android.bluetooth.BluetoothGatt, status: Int
      ) {
        if (status != android.bluetooth.BluetoothGatt.GATT_SUCCESS) {
          cleanupGattRead(gatt)
          return
        }
        val service = gatt.getService(MET_SERVICE_UUID)
        if (service == null) { cleanupGattRead(gatt); return }
        val ch = service.getCharacteristic(MET_HASH_CHARACTERISTIC_UUID)
        if (ch == null) { cleanupGattRead(gatt); return }
        try {
          val ok = gatt.readCharacteristic(ch)
          if (!ok) cleanupGattRead(gatt)
        } catch (e: SecurityException) {
          Log.w(TAG, "GATT readCharacteristic denied", e)
          cleanupGattRead(gatt)
        }
      }

      // API 33+ (Android 13+): system calls this overload exclusively when
      // compileSdk >= 33. The freshly-read bytes are passed as `value` so we
      // don't rely on the deprecated `characteristic.value` cache.
      override fun onCharacteristicRead(
        gatt: android.bluetooth.BluetoothGatt,
        characteristic: android.bluetooth.BluetoothGattCharacteristic,
        value: ByteArray,
        status: Int
      ) {
        try {
          handleHashRead(gatt, characteristic, value, status)
        } finally {
          cleanupGattRead(gatt)
        }
      }

      // Pre-API 33 fallback. On API 33+ the default BluetoothGattCallback
      // base implementation of the new overload calls this one, but we keep
      // it explicit for clarity and for any older device that reaches here.
      @Suppress("DEPRECATION")
      override fun onCharacteristicRead(
        gatt: android.bluetooth.BluetoothGatt,
        characteristic: android.bluetooth.BluetoothGattCharacteristic,
        status: Int
      ) {
        try {
          handleHashRead(gatt, characteristic, characteristic.value, status)
        } finally {
          cleanupGattRead(gatt)
        }
      }

      private fun handleHashRead(
        gatt: android.bluetooth.BluetoothGatt,
        characteristic: android.bluetooth.BluetoothGattCharacteristic,
        value: ByteArray?,
        status: Int
      ) {
        if (status == android.bluetooth.BluetoothGatt.GATT_SUCCESS &&
          characteristic.uuid == MET_HASH_CHARACTERISTIC_UUID &&
          value != null && value.size >= 8
        ) {
          val hashHex = value.take(8).joinToString("") { "%02x".format(it) }
          processDetectedHash(hashHex, 0)
        }
      }
    }

    try {
      val gatt = device.connectGatt(
        ctx, false, gattCallback,
        android.bluetooth.BluetoothDevice.TRANSPORT_LE
      )
      if (gatt != null) {
        pendingGattReads[addr] = gatt
      }
    } catch (e: SecurityException) {
      Log.w(TAG, "connectGatt denied", e)
    } catch (e: Exception) {
      Log.w(TAG, "connectGatt threw", e)
    }
  }

  @Suppress("MissingPermission")
  private fun cleanupGattRead(gatt: android.bluetooth.BluetoothGatt) {
    val addr = gatt.device?.address ?: return
    pendingGattReads.remove(addr)
    try { gatt.disconnect() } catch (_: Exception) {}
    try { gatt.close() } catch (_: Exception) {}
  }

  @Suppress("MissingPermission")
  private fun closeAllPendingGattReads() {
    for ((_, gatt) in pendingGattReads) {
      try { gatt.disconnect() } catch (_: Exception) {}
      try { gatt.close() } catch (_: Exception) {}
    }
    pendingGattReads.clear()
  }

  // Write a ble_detections doc to Firestore. The Cloud Function
  // onBleDetectionCreated will resolve the hashes, write the Postgres
  // encounter, mirror to met_people, and send push notifications.
  //
  // This is called from the scan/GATT callback threads; Firebase's SDK
  // is thread-safe so no dispatch to main is required.
  private fun writeDetectionToFirestore(
    observerUid: String,
    observerHash: String,
    observedHash: String,
    rssi: Int
  ) {
    try {
      val currentUser = FirebaseAuth.getInstance().currentUser
      if (currentUser == null) {
        Log.w(TAG, "writeDetectionToFirestore: no authenticated user — skipping")
        return
      }
      val doc = hashMapOf(
        "observerUid" to observerUid,
        "observerHash" to observerHash,
        "observedHash" to observedHash,
        "rssi" to rssi,
        "timestamp" to FirestoreFieldValue.serverTimestamp(),
        "processed" to false,
      )
      FirebaseFirestore.getInstance()
        .collection("ble_detections")
        .add(doc)
        .addOnSuccessListener { ref ->
          Log.d(TAG, "BLE detection written: ${ref.id} observedHash=$observedHash")
        }
        .addOnFailureListener { e ->
          Log.w(TAG, "BLE detection write failed: ${e.message}")
        }
    } catch (e: Exception) {
      Log.w(TAG, "writeDetectionToFirestore threw", e)
    }
  }
}
