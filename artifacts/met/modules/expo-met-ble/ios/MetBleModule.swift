// MetBleModule — iOS iBeacon advertise + range for the Met app.
//
// We use Apple's iBeacon protocol (CoreLocation + CoreBluetooth) as
// the primary proximity wire format. Each device broadcasts an iBeacon
// `<UUID, major, minor=1>` packet where `major = stableHash(uid)` and
// every other Met device ranges that UUID to discover peers in real
// time. iBeacon is the same scheme the original Flutter MVP shipped —
// it is well-supported across iOS↔iOS / iOS↔Android, gives sub-second
// detection, and the OS handles all the radio scheduling for us.
//
// Permissions
// -----------
// Advertising requires Bluetooth (NSBluetoothAlwaysUsageDescription).
// Ranging requires both Bluetooth AND Location-When-In-Use
// (NSLocationWhenInUseUsageDescription). The JS layer requests both
// in `app/permissions.tsx` before calling startBeaconRanging.
//
// Background: CBCentralManager (bluetooth-central UIBackgroundMode) keeps the
// UUID-filtered scan alive when the app is suspended. The restore identifier
// causes iOS to wake the app when a Met peer is detected after a system kill.
// Owner uid/hash are persisted to UserDefaults so Firestore encounter writes
// succeed during state restoration (before JS has run). Firebase Auth timing
// is handled by queuing detections until the first authenticated user arrives.

import ExpoModulesCore
import CoreBluetooth
import CoreLocation
import FirebaseAuth
import FirebaseFirestore

private let MET_SERVICE_UUID = CBUUID(string: "4d455400-7770-4ac2-9b3d-000000000001")
private let MET_HASH_CHARACTERISTIC_UUID = CBUUID(string: "4d455400-7770-4ac2-9b3d-000000000002")
private let LOCAL_NAME_PREFIX = "met:"
private let kOwnerUidKey  = "MetBleOwnerUid"
private let kOwnerHashKey = "MetBleOwnerHash"

public class MetBleModule: Module {
  // ----- Legacy GATT advertiser (kept for the local-name fallback
  // path on older client builds; new code should use iBeacon).
  private var manager: CBPeripheralManager?
  private var delegate: PeripheralDelegate?
  private var pendingHashHex: String?
  private var advertising: Bool = false

  // ----- GATT-on-detection support. We expose a single read-only
  // characteristic that returns the 8-byte identity hash. When two
  // iPhones are both backgrounded, iOS strips serviceData/localName
  // from advertisements — the scanner sees only the service UUID and
  // falls back to connecting to read this characteristic.
  //
  // `gattServiceAdded` tracks whether we've already called
  // `mgr.add(service)` so we don't double-add on power-cycle. The
  // characteristic value is set from `pendingHashHex` whenever
  // advertising (re)starts so it always matches what we broadcast.
  private var hashCharacteristic: CBMutableCharacteristic?
  private var gattService: CBMutableService?
  private var gattServiceAdded: Bool = false

  // ----- iBeacon advertiser. Reuses CBPeripheralManager but takes its
  // payload from CLBeaconRegion.peripheralData(). Only one of `iBeacon`
  // or legacy GATT can be advertising at a time per peripheral manager.
  private var beaconManager: CBPeripheralManager?
  private var beaconDelegate: BeaconPeripheralDelegate?
  private var pendingBeaconAdv: (uuid: UUID, major: UInt16, minor: UInt16)?
  private var beaconAdvertising: Bool = false

  // ----- iBeacon ranger.
  private var locationManager: CLLocationManager?
  private var locationDelegate: BeaconLocationDelegate?
  private var rangingConstraints: [String: CLBeaconIdentityConstraint] = [:]

  // ----- Background peer-detection scanner (CBCentralManager).
  // Runs alongside the peripheral advertiser. The `bluetooth-central`
  // UIBackgroundMode (already in Info.plist) allows scanning to continue
  // when the app is suspended. CBCentralManagerOptionRestoreIdentifierKey
  // ensures iOS resurrects this manager after termination.
  private var centralMgr: CBCentralManager?
  private var centralDelegate: MetCentralDelegate?

  // Owner context — captured when startAdvertising is called so the scanner
  // can fill Firestore docs without a JS round-trip.
  private var pendingUid: String?

  // Per-peer native cooldown: peerHashHex → last-detection Date.
  // 30-minute window matches the encounter dedup window on the server.
  private var detectionCooldowns: [String: Date] = [:]
  private let detectionCooldownSeconds: Double = 30.0 * 60.0

  // Connected peripherals awaiting a hash-characteristic read (iOS peers
  // that are backgrounded and only advertise their service UUID).
  // Retaining the CBPeripheral object keeps it alive until the read completes.
  private var pendingHashReads: [UUID: CBPeripheral] = [:]

  // State-restoration auth queue: detections that arrived before Firebase Auth
  // was ready (state-restoration scenario). Flushed on first auth state change
  // that delivers a non-nil user. Entries are dropped after 5 minutes.
  private var pendingDetections: [(myUid: String, myHash: String, peerHash: String, rssi: Int, queued: Date)] = []
  private var authStateHandle: AuthStateDidChangeListenerHandle? = nil

  public func definition() -> ModuleDefinition {
    Name("ExpoMetBle")

    // Single event channel for ranged beacons. Payload shape:
    //   { uuid: string, beacons: [{ major: int, minor: int, rssi: int,
    //                                accuracy: number, proximity: int }] }
    Events("onBeaconRanged")

    // ---- Legacy GATT (unchanged). The JS layer no longer calls these
    // by default — kept exported so older JS code paths still link.
    AsyncFunction("startAdvertising") { (uid: String, hashHex: String, promise: Promise) in
      DispatchQueue.main.async {
        self.startAdvertisingImpl(uid: uid, hashHex: hashHex, promise: promise)
      }
    }

    AsyncFunction("stopAdvertising") { (promise: Promise) in
      DispatchQueue.main.async {
        self.stopAdvertisingImpl()
        promise.resolve(nil)
      }
    }

    AsyncFunction("isAvailable") { (promise: Promise) in
      DispatchQueue.main.async {
        let state = self.manager?.state ?? .unknown
        promise.resolve(state == .poweredOn)
      }
    }

    // ---- iBeacon advertise.

    AsyncFunction("startBeaconAdvertising") {
      (uuidString: String, major: Int, minor: Int, promise: Promise) in
      DispatchQueue.main.async {
        self.startBeaconAdvertisingImpl(
          uuidString: uuidString, major: major, minor: minor, promise: promise)
      }
    }

    AsyncFunction("stopBeaconAdvertising") { (promise: Promise) in
      DispatchQueue.main.async {
        self.stopBeaconAdvertisingImpl()
        promise.resolve(nil)
      }
    }

    AsyncFunction("isBeaconAdvertisingAvailable") { (promise: Promise) in
      DispatchQueue.main.async {
        let state = self.beaconManager?.state ?? .unknown
        promise.resolve(state == .poweredOn)
      }
    }

    // ---- iBeacon range (scan).

    AsyncFunction("startBeaconRanging") { (uuidString: String, promise: Promise) in
      DispatchQueue.main.async {
        self.startBeaconRangingImpl(uuidString: uuidString, promise: promise)
      }
    }

    AsyncFunction("stopBeaconRanging") { (uuidString: String, promise: Promise) in
      DispatchQueue.main.async {
        self.stopBeaconRangingImpl(uuidString: uuidString)
        promise.resolve(nil)
      }
    }

    AsyncFunction("stopAllBeaconRanging") { (promise: Promise) in
      DispatchQueue.main.async {
        self.stopAllBeaconRangingImpl()
        promise.resolve(nil)
      }
    }

    OnDestroy {
      DispatchQueue.main.async {
        self.stopAdvertisingImpl()
        self.stopBeaconAdvertisingImpl()
        self.stopAllBeaconRangingImpl()
        self.stopCentralManagerImpl()
        self.manager = nil
        self.delegate = nil
        self.beaconManager = nil
        self.beaconDelegate = nil
        self.locationManager = nil
        self.locationDelegate = nil
      }
    }
  }

  // MARK: - Legacy GATT advertise

  private func startAdvertisingImpl(uid: String, hashHex: String, promise: Promise) {
    pendingUid = uid         // store for background Firestore writes
    pendingHashHex = hashHex
    // Persist to UserDefaults so state restoration can recover the owner
    // context after iOS kills and relaunches the app for a Bluetooth wake.
    UserDefaults.standard.set(uid, forKey: kOwnerUidKey)
    UserDefaults.standard.set(hashHex, forKey: kOwnerHashKey)

    // Start the background CBCentralManager scanner alongside the peripheral.
    startCentralManagerImpl()

    if manager == nil {
      delegate = PeripheralDelegate(owner: self)
      // restoreIdentifier lets iOS resurrect this peripheral manager
      // when the app is relaunched in the background after termination.
      // Combined with the `bluetooth-peripheral` UIBackgroundMode, our
      // service-UUID advertisement keeps running while the app is
      // suspended (the OS strips localName/serviceData when the app is
      // backgrounded — only the service UUID survives, which other Met
      // apps detect via their UUID-filtered scan).
      manager = CBPeripheralManager(
        delegate: delegate,
        queue: DispatchQueue.main,
        options: [
          CBPeripheralManagerOptionShowPowerAlertKey: false,
          CBPeripheralManagerOptionRestoreIdentifierKey: "MetBlePeripheralRestore",
        ]
      )
    }

    guard let mgr = manager else {
      promise.resolve(false)
      return
    }

    if mgr.state == .poweredOn {
      doStart(mgr: mgr, hashHex: hashHex)
      promise.resolve(true)
    } else {
      promise.resolve(true)
    }
  }

  fileprivate func doStart(mgr: CBPeripheralManager, hashHex: String) {
    if mgr.isAdvertising {
      mgr.stopAdvertising()
    }
    // Make sure the GATT service exists with the latest hash bytes
    // BEFORE we start advertising — connecting peers will discover
    // services as soon as the connection is established.
    ensureGattService(mgr: mgr, hashHex: hashHex)

    let localName = LOCAL_NAME_PREFIX + hashHex
    let advData: [String: Any] = [
      CBAdvertisementDataServiceUUIDsKey: [MET_SERVICE_UUID],
      CBAdvertisementDataLocalNameKey: localName,
    ]
    mgr.startAdvertising(advData)
    advertising = true
  }

  // Build (or update) the read-only hash characteristic and add it to
  // the peripheral manager exactly once. CoreBluetooth requires the
  // characteristic value at construction time for static reads — if
  // the hash changes (different uid), we recreate the service.
  //
  // `mgr.add(service)` is asynchronous: success/failure is reported
  // via `peripheralManager(_:didAdd:error:)`. We mark the service as
  // added only when that callback succeeds — until then `gattServiceAdded`
  // stays false so a retry can happen on next `doStart`.
  fileprivate func ensureGattService(mgr: CBPeripheralManager, hashHex: String) {
    let bytes = Self.hexToData(hashHex)
    let existing = hashCharacteristic
    if let existing = existing, existing.value == bytes, gattServiceAdded {
      // Service already added with current hash — nothing to do.
      return
    }
    if let oldService = gattService {
      // Always attempt removal before re-adding. Safe even if the
      // previous add never completed; CoreBluetooth tolerates removal
      // of an unknown service as a no-op.
      mgr.remove(oldService)
      gattServiceAdded = false
    }
    let characteristic = CBMutableCharacteristic(
      type: MET_HASH_CHARACTERISTIC_UUID,
      properties: [.read],
      value: bytes,
      permissions: [.readable]
    )
    let service = CBMutableService(type: MET_SERVICE_UUID, primary: true)
    service.characteristics = [characteristic]
    hashCharacteristic = characteristic
    gattService = service
    mgr.add(service)
    // Note: gattServiceAdded is flipped to true inside the delegate's
    // `didAdd service` callback, not here.
  }

  // Called by the peripheral delegate after `mgr.add(service)`
  // resolves. On error we clear the bookkeeping so a future `doStart`
  // call retries.
  fileprivate func handleGattServiceAdded(service: CBService, error: Error?) {
    if let error = error {
      NSLog("[MetBle] add(service) failed: %@", error.localizedDescription)
      gattServiceAdded = false
      return
    }
    if service.uuid == MET_SERVICE_UUID {
      gattServiceAdded = true
    }
  }

  // Hex string → Data. Tolerant of odd-length / non-hex input — we
  // just truncate to whatever the caller gave us, padded to 8 bytes.
  private static func hexToData(_ hex: String) -> Data {
    var data = Data(capacity: hex.count / 2)
    let chars = Array(hex.lowercased())
    var i = 0
    while i + 1 < chars.count {
      guard let hi = chars[i].hexDigitValue, let lo = chars[i + 1].hexDigitValue else {
        break
      }
      data.append(UInt8((hi << 4) | lo))
      i += 2
    }
    // Pad/truncate to exactly 8 bytes — that's the wire-format size.
    if data.count > 8 {
      return data.prefix(8)
    }
    while data.count < 8 {
      data.append(0)
    }
    return data
  }

  // Called by the peripheral delegate when a connected central reads
  // the hash characteristic. We just respond with the current value.
  fileprivate func handleHashCharacteristicRead(
    mgr: CBPeripheralManager, request: CBATTRequest
  ) {
    guard request.characteristic.uuid == MET_HASH_CHARACTERISTIC_UUID else {
      mgr.respond(to: request, withResult: .attributeNotFound)
      return
    }
    let value = hashCharacteristic?.value ?? Data(count: 8)
    if request.offset > value.count {
      mgr.respond(to: request, withResult: .invalidOffset)
      return
    }
    request.value = value.subdata(in: request.offset..<value.count)
    mgr.respond(to: request, withResult: .success)
  }

  private func stopAdvertisingImpl() {
    pendingHashHex = nil
    pendingUid = nil
    UserDefaults.standard.removeObject(forKey: kOwnerUidKey)
    UserDefaults.standard.removeObject(forKey: kOwnerHashKey)
    if let mgr = manager, mgr.isAdvertising {
      mgr.stopAdvertising()
    }
    advertising = false
    // Tear down the GATT service so a future startAdvertising call
    // for a different uid doesn't reuse a stale characteristic.
    if let mgr = manager, gattServiceAdded, let oldService = gattService {
      mgr.remove(oldService)
    }
    gattServiceAdded = false
    gattService = nil
    hashCharacteristic = nil
    stopCentralManagerImpl()
  }

  fileprivate func onPoweredOn() {
    guard let mgr = manager, let hashHex = pendingHashHex else { return }
    doStart(mgr: mgr, hashHex: hashHex)
  }

  // MARK: - iBeacon advertise

  private func startBeaconAdvertisingImpl(
    uuidString: String, major: Int, minor: Int, promise: Promise
  ) {
    guard let uuid = UUID(uuidString: uuidString) else {
      NSLog("[MetBle] startBeaconAdvertising: invalid UUID \(uuidString)")
      promise.resolve(false)
      return
    }
    let majorClamped = UInt16(clamping: major)
    let minorClamped = UInt16(clamping: minor)
    pendingBeaconAdv = (uuid, majorClamped, minorClamped)

    if beaconManager == nil {
      beaconDelegate = BeaconPeripheralDelegate(owner: self)
      beaconManager = CBPeripheralManager(
        delegate: beaconDelegate,
        queue: DispatchQueue.main,
        options: [CBPeripheralManagerOptionShowPowerAlertKey: false]
      )
    }

    guard let mgr = beaconManager else {
      promise.resolve(false)
      return
    }

    if mgr.state == .poweredOn {
      doStartBeacon(mgr: mgr, uuid: uuid, major: majorClamped, minor: minorClamped)
      promise.resolve(true)
    } else {
      // Optimistic — the delegate will retry once power is on.
      promise.resolve(true)
    }

    // Ensure the background CBCentralManager scanner is also running.
    // startCentralManagerImpl is idempotent — safe to call even if the
    // GATT advertiser already started it.
    startCentralManagerImpl()
  }

  fileprivate func doStartBeacon(
    mgr: CBPeripheralManager, uuid: UUID, major: UInt16, minor: UInt16
  ) {
    if mgr.isAdvertising {
      mgr.stopAdvertising()
    }
    let region = CLBeaconRegion(
      uuid: uuid, major: major, minor: minor, identifier: "MetBeacon"
    )
    // peripheralData(withMeasuredPower:) returns the iBeacon-formatted
    // manufacturer-data dictionary CoreBluetooth expects. Passing nil
    // for measuredPower lets CoreLocation pick the per-device default.
    let data = region.peripheralData(withMeasuredPower: nil)
    if let advData = data as? [String: Any] {
      mgr.startAdvertising(advData)
      beaconAdvertising = true
    } else {
      NSLog("[MetBle] beacon peripheralData unexpectedly nil/wrong type")
    }
  }

  private func stopBeaconAdvertisingImpl() {
    pendingBeaconAdv = nil
    if let mgr = beaconManager, mgr.isAdvertising {
      mgr.stopAdvertising()
    }
    beaconAdvertising = false
  }

  fileprivate func onBeaconPoweredOn() {
    guard let mgr = beaconManager, let pending = pendingBeaconAdv else { return }
    doStartBeacon(mgr: mgr, uuid: pending.uuid, major: pending.major, minor: pending.minor)
  }

  // MARK: - iBeacon range (scan)

  private func ensureLocationManager() -> CLLocationManager? {
    if locationManager == nil {
      let lm = CLLocationManager()
      let dlg = BeaconLocationDelegate(owner: self)
      lm.delegate = dlg
      locationManager = lm
      locationDelegate = dlg
    }
    return locationManager
  }

  private func startBeaconRangingImpl(uuidString: String, promise: Promise) {
    guard let uuid = UUID(uuidString: uuidString) else {
      NSLog("[MetBle] startBeaconRanging: invalid UUID \(uuidString)")
      promise.resolve(false)
      return
    }
    guard let lm = ensureLocationManager() else {
      promise.resolve(false)
      return
    }

    let auth: CLAuthorizationStatus
    if #available(iOS 14.0, *) {
      auth = lm.authorizationStatus
    } else {
      auth = CLLocationManager.authorizationStatus()
    }

    // Request When-In-Use up front. Always isn't required for
    // foreground ranging; we'll prompt for it later if/when we add
    // background region monitoring.
    if auth == .notDetermined {
      lm.requestWhenInUseAuthorization()
    } else if auth == .denied || auth == .restricted {
      NSLog("[MetBle] startBeaconRanging: location permission denied")
      promise.resolve(false)
      return
    }

    // Build the constraint and start ranging. Ranging delivers
    // didRangeBeacons callbacks roughly once per second per peer in
    // range. Reusing the same constraint for the same UUID is a no-op.
    let constraint = CLBeaconIdentityConstraint(uuid: uuid)
    rangingConstraints[uuidString.lowercased()] = constraint
    lm.startRangingBeacons(satisfying: constraint)
    promise.resolve(true)
  }

  private func stopBeaconRangingImpl(uuidString: String) {
    guard let lm = locationManager else { return }
    let key = uuidString.lowercased()
    if let constraint = rangingConstraints.removeValue(forKey: key) {
      lm.stopRangingBeacons(satisfying: constraint)
    }
  }

  private func stopAllBeaconRangingImpl() {
    guard let lm = locationManager else {
      rangingConstraints.removeAll()
      return
    }
    for (_, constraint) in rangingConstraints {
      lm.stopRangingBeacons(satisfying: constraint)
    }
    rangingConstraints.removeAll()
  }

  // Called by the location delegate when beacons are ranged.
  fileprivate func emitRangedBeacons(uuid: UUID, beacons: [CLBeacon]) {
    let payload: [[String: Any]] = beacons.map { beacon in
      [
        "major": beacon.major.intValue,
        "minor": beacon.minor.intValue,
        "rssi": beacon.rssi,
        "accuracy": beacon.accuracy,
        "proximity": beacon.proximity.rawValue,
      ]
    }
    self.sendEvent("onBeaconRanged", [
      "uuid": uuid.uuidString.lowercased(),
      "beacons": payload,
    ])
  }

  // MARK: - Background peer-detection scanner (CBCentralManager)
  //
  // Runs in parallel with the CBPeripheralManager advertiser. iOS keeps it
  // alive via the `bluetooth-central` UIBackgroundMode. State restoration via
  // CBCentralManagerOptionRestoreIdentifierKey revives it after a kill.

  private func startCentralManagerImpl() {
    guard centralMgr == nil else { return }
    let dlg = MetCentralDelegate(owner: self)
    centralDelegate = dlg
    centralMgr = CBCentralManager(
      delegate: dlg,
      queue: DispatchQueue.main,
      options: [
        CBCentralManagerOptionShowPowerAlertKey: false,
        CBCentralManagerOptionRestoreIdentifierKey: "MetBleCentralRestore",
      ]
    )
  }

  private func stopCentralManagerImpl() {
    if let cm = centralMgr, cm.isScanning {
      cm.stopScan()
    }
    // Cancel all pending hash reads
    for (_, peripheral) in pendingHashReads {
      centralMgr?.cancelPeripheralConnection(peripheral)
    }
    pendingHashReads.removeAll()
    centralMgr = nil
    centralDelegate = nil
  }

  // Called by MetCentralDelegate when a Met service-UUID advertisement is seen.
  fileprivate func handlePeerDiscovered(
    peripheral: CBPeripheral,
    advertisementData: [String: Any],
    rssi: Int
  ) {
    var peerHash: String? = nil

    // ── Source 1: serviceData (Android GATT advertising) ─────────────────
    if let serviceDataDict = advertisementData[CBAdvertisementDataServiceDataKey]
        as? [CBUUID: Data],
       let data = serviceDataDict[MET_SERVICE_UUID],
       data.count >= 8
    {
      peerHash = data.prefix(8).map { String(format: "%02x", $0) }.joined()
    }

    // ── Source 2: local name "met:<16hex>" (iOS in foreground) ────────────
    if peerHash == nil,
       let localName = advertisementData[CBAdvertisementDataLocalNameKey] as? String,
       localName.hasPrefix(LOCAL_NAME_PREFIX)
    {
      let tail = String(localName.dropFirst(LOCAL_NAME_PREFIX.count))
      if tail.count >= 16 {
        let candidate = String(tail.prefix(16))
        let hexSet = CharacterSet(charactersIn: "0123456789abcdefABCDEF")
        if candidate.unicodeScalars.allSatisfy({ hexSet.contains($0) }) {
          peerHash = candidate.lowercased()
        }
      }
    }

    if let hash = peerHash {
      handlePeerHashDetected(hashHex: hash, rssi: rssi)
    } else {
      // ── Source 3: GATT connect (iOS in background) ─────────────────────
      // No hash in advertisement — peer is a backgrounded iOS device that
      // only keeps the service UUID. Connect and read the hash characteristic.
      let id = peripheral.identifier
      guard pendingHashReads[id] == nil,
            pendingHashReads.count < 3 else { return }
      pendingHashReads[id] = peripheral
      peripheral.delegate = centralDelegate
      centralMgr?.connect(peripheral, options: nil)
    }
  }

  fileprivate func handlePeerHashDetected(hashHex: String, rssi: Int) {
    guard let myUid = pendingUid,
          let myHash = pendingHashHex else { return }
    if hashHex == myHash { return } // self-detection

    // Cooldown check
    let now = Date()
    if let last = detectionCooldowns[hashHex],
       now.timeIntervalSince(last) < detectionCooldownSeconds { return }
    detectionCooldowns[hashHex] = now

    writeDetectionToFirestore(myUid: myUid, myHash: myHash, peerHash: hashHex, rssi: rssi)
  }

  fileprivate func cleanupPendingHashRead(peripheral: CBPeripheral) {
    pendingHashReads.removeValue(forKey: peripheral.identifier)
    centralMgr?.cancelPeripheralConnection(peripheral)
  }

  // Entry point from handlePeerHashDetected. If Firebase Auth is ready we
  // write immediately. If not (state-restoration scenario: app was killed and
  // relaunched by CoreBluetooth before JS / Firebase had a chance to run) we
  // queue the write and flush once the first authenticated user arrives.
  private func writeDetectionToFirestore(
    myUid: String,
    myHash: String,
    peerHash: String,
    rssi: Int
  ) {
    if Auth.auth().currentUser != nil {
      doWriteDetection(myUid: myUid, myHash: myHash, peerHash: peerHash, rssi: rssi)
    } else {
      NSLog("[MetBle] Auth not ready — queuing detection for peerHash=%@", peerHash)
      pendingDetections.append(
        (myUid: myUid, myHash: myHash, peerHash: peerHash, rssi: rssi, queued: Date())
      )
      scheduleAuthFlush()
    }
  }

  // Registers a one-shot Firebase auth state listener that flushes queued
  // detections once a user signs in. Idempotent — at most one listener at a time.
  // Queued detections older than 5 minutes are discarded to prevent stale writes.
  private func scheduleAuthFlush() {
    guard authStateHandle == nil else { return }
    authStateHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
      guard let self = self, user != nil else { return }
      let cutoff = Date().addingTimeInterval(-5 * 60)
      let queued = self.pendingDetections.filter { $0.queued >= cutoff }
      self.pendingDetections.removeAll()
      if let h = self.authStateHandle {
        Auth.auth().removeStateDidChangeListener(h)
        self.authStateHandle = nil
      }
      for d in queued {
        self.doWriteDetection(
          myUid: d.myUid, myHash: d.myHash, peerHash: d.peerHash, rssi: d.rssi
        )
      }
    }
  }

  private func doWriteDetection(myUid: String, myHash: String, peerHash: String, rssi: Int) {
    let doc: [String: Any] = [
      "observerUid": myUid,
      "observerHash": myHash,
      "observedHash": peerHash,
      "rssi": rssi,
      "timestamp": FieldValue.serverTimestamp(),
      "processed": false,
    ]
    Firestore.firestore().collection("ble_detections").addDocument(data: doc) { error in
      if let error = error {
        NSLog("[MetBle] Firestore detection write failed: %@", error.localizedDescription)
      } else {
        NSLog("[MetBle] BLE detection written, observedHash=%@", peerHash)
      }
    }
  }

  // Called by MetCentralDelegate.willRestoreState to reload the owner context
  // from UserDefaults after iOS kills and relaunches the app for a BLE wake.
  fileprivate func restoreOwnerContext() {
    guard let uid  = UserDefaults.standard.string(forKey: kOwnerUidKey),
          let hash = UserDefaults.standard.string(forKey: kOwnerHashKey) else {
      NSLog("[MetBle] restoreOwnerContext: no persisted context — encounters will be skipped")
      return
    }
    pendingUid     = uid
    pendingHashHex = hash
    NSLog("[MetBle] restoreOwnerContext: restored uid=%@", uid)
  }
}

// MARK: - Delegates

private class PeripheralDelegate: NSObject, CBPeripheralManagerDelegate {
  weak var owner: MetBleModule?

  init(owner: MetBleModule) {
    self.owner = owner
  }

  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    if peripheral.state == .poweredOn {
      owner?.onPoweredOn()
    }
  }

  func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
    if let error = error {
      NSLog("[MetBle] startAdvertising failed: %@", error.localizedDescription)
    }
  }

  // GATT-on-detection: respond to reads of the hash characteristic.
  // Triggered when another Met device's scanner connects to us.
  func peripheralManager(
    _ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest
  ) {
    owner?.handleHashCharacteristicRead(mgr: peripheral, request: request)
  }

  // Confirms the async `mgr.add(service)` call result. We rely on this
  // to flip `gattServiceAdded = true` so the JS scanner's reads have
  // a backing characteristic.
  func peripheralManager(
    _ peripheral: CBPeripheralManager,
    didAdd service: CBService,
    error: Error?
  ) {
    owner?.handleGattServiceAdded(service: service, error: error)
  }

  // CoreBluetooth state restoration: when iOS resurrects the
  // peripheral manager after termination, it hands back the services
  // we had previously published. We just need to acknowledge them so
  // the framework doesn't re-add duplicates.
  func peripheralManager(
    _ peripheral: CBPeripheralManager,
    willRestoreState dict: [String: Any]
  ) {
    NSLog("[MetBle] peripheralManager willRestoreState")
  }
}

private class BeaconPeripheralDelegate: NSObject, CBPeripheralManagerDelegate {
  weak var owner: MetBleModule?

  init(owner: MetBleModule) {
    self.owner = owner
  }

  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    if peripheral.state == .poweredOn {
      owner?.onBeaconPoweredOn()
    }
  }

  func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
    if let error = error {
      NSLog("[MetBle] startBeaconAdvertising failed: %@", error.localizedDescription)
    }
  }
}

private class BeaconLocationDelegate: NSObject, CLLocationManagerDelegate {
  weak var owner: MetBleModule?

  init(owner: MetBleModule) {
    self.owner = owner
  }

  // iOS 13+ ranging callback. Modern signature uses
  // CLBeaconIdentityConstraint; the older `in: CLBeaconRegion` shape
  // is deprecated and we don't implement it.
  func locationManager(
    _ manager: CLLocationManager,
    didRange beacons: [CLBeacon],
    satisfying beaconConstraint: CLBeaconIdentityConstraint
  ) {
    if beacons.isEmpty { return }
    owner?.emitRangedBeacons(uuid: beaconConstraint.uuid, beacons: beacons)
  }

  func locationManager(
    _ manager: CLLocationManager,
    didFailRangingFor beaconConstraint: CLBeaconIdentityConstraint,
    error: Error
  ) {
    NSLog("[MetBle] didFailRangingFor: %@", error.localizedDescription)
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    NSLog("[MetBle] location didFailWithError: %@", error.localizedDescription)
  }
}

// MARK: - MetCentralDelegate
//
// Handles both CBCentralManagerDelegate (scanning) and CBPeripheralDelegate
// (GATT reads). A single class handles both roles so it can be set as both
// centralMgr.delegate and peripheral.delegate seamlessly.
//
// Lifecycle:
//   - created in startCentralManagerImpl()
//   - starts scanning once the central reaches .poweredOn
//   - on willRestoreState, the scan is restarted in centralManagerDidUpdateState
//     (the state may not be .poweredOn yet when willRestoreState fires)

private class MetCentralDelegate: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
  weak var owner: MetBleModule?

  init(owner: MetBleModule) {
    self.owner = owner
  }

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    if central.state == .poweredOn {
      NSLog("[MetBle] CBCentralManager powered on — starting peer scan")
      central.scanForPeripherals(
        withServices: [MET_SERVICE_UUID],
        options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
      )
    } else {
      NSLog("[MetBle] CBCentralManager state changed: %d", central.state.rawValue)
    }
  }

  func centralManager(
    _ central: CBCentralManager,
    willRestoreState dict: [String: Any]
  ) {
    NSLog("[MetBle] CBCentralManager willRestoreState — restoring owner context")
    // Reload uid + hash from UserDefaults so handlePeerHashDetected can write
    // Firestore encounters without a JS round-trip after kill+restore.
    owner?.restoreOwnerContext()
    // Note: do NOT call scanForPeripherals here; the central may still be
    // transitioning to .poweredOn. centralManagerDidUpdateState handles it.
  }

  func centralManager(
    _ central: CBCentralManager,
    didDiscover peripheral: CBPeripheral,
    advertisementData: [String: Any],
    rssi RSSI: NSNumber
  ) {
    owner?.handlePeerDiscovered(
      peripheral: peripheral,
      advertisementData: advertisementData,
      rssi: RSSI.intValue
    )
  }

  func centralManager(
    _ central: CBCentralManager,
    didConnect peripheral: CBPeripheral
  ) {
    // Peripheral connected — discover the Met service to read the hash char.
    peripheral.discoverServices([MET_SERVICE_UUID])
  }

  func centralManager(
    _ central: CBCentralManager,
    didFailToConnect peripheral: CBPeripheral,
    error: Error?
  ) {
    NSLog("[MetBle] didFailToConnect: %@", error?.localizedDescription ?? "unknown")
    owner?.cleanupPendingHashRead(peripheral: peripheral)
  }

  func centralManager(
    _ central: CBCentralManager,
    didDisconnectPeripheral peripheral: CBPeripheral,
    error: Error?
  ) {
    owner?.cleanupPendingHashRead(peripheral: peripheral)
  }

  // MARK: CBPeripheralDelegate

  func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    guard error == nil,
          let service = peripheral.services?.first(where: { $0.uuid == MET_SERVICE_UUID })
    else {
      owner?.cleanupPendingHashRead(peripheral: peripheral)
      return
    }
    peripheral.discoverCharacteristics([MET_HASH_CHARACTERISTIC_UUID], for: service)
  }

  func peripheral(
    _ peripheral: CBPeripheral,
    didDiscoverCharacteristicsFor service: CBService,
    error: Error?
  ) {
    guard error == nil,
          let ch = service.characteristics?.first(where: {
            $0.uuid == MET_HASH_CHARACTERISTIC_UUID
          })
    else {
      owner?.cleanupPendingHashRead(peripheral: peripheral)
      return
    }
    peripheral.readValue(for: ch)
  }

  func peripheral(
    _ peripheral: CBPeripheral,
    didUpdateValueFor characteristic: CBCharacteristic,
    error: Error?
  ) {
    defer { owner?.cleanupPendingHashRead(peripheral: peripheral) }
    guard error == nil,
          characteristic.uuid == MET_HASH_CHARACTERISTIC_UUID,
          let data = characteristic.value,
          data.count >= 8
    else { return }
    let hashHex = data.prefix(8).map { String(format: "%02x", $0) }.joined()
    owner?.handlePeerHashDetected(hashHex: hashHex, rssi: 0)
  }
}
