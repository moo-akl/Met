# Kill-Restore GATT Window — Manual Test Procedure

## Background

When iOS kills the Met app and later relaunches it in the background due to a
Bluetooth wake event, there is a narrow window between app launch and the first
JS execution during which a peer device may connect and attempt to read the GATT
hash characteristic.  Before the fix, `CBMutableCharacteristic` was never
re-added to the restored `CBPeripheralManager` during this window, so connecting
peers received an error and no encounter was recorded.

The fix calls `restoreAndRepublishGattService()` from
`PeripheralDelegate.peripheralManager(_:willRestoreState:)`, which reads the
hash from `UserDefaults` (persisted by `startAdvertisingImpl` before any kill)
and re-adds the GATT service immediately, before JS runs.

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Two physical iPhones | Simulator cannot simulate CBPeripheralManager state restoration |
| EAS development build | BLE advertising is not supported in Expo Go |
| Both devices on the same Apple ID or different — doesn't matter | They only need to be within ~10 m of each other |
| Console access | Use **Xcode → Devices and Simulators → Open Console** or `idevicesyslog` to stream `[MetBle]` log lines |
| Both devices have Bluetooth and Location permissions granted to Met | |

---

## Test Steps

### Step 1 — Baseline: confirm GATT is readable in the foreground

1. Launch the Met app on **Device A** (the device under test) and sign in.
2. Launch the Met app on **Device B** (the scanner peer) and sign in.
3. On Device A, verify advertising is active — console should show:
   ```
   [MetBle] doStart: advertising with hash=<hash>
   [MetBle] add(service) succeeded
   ```
4. Bring Device B within 2 m of Device A.
5. Verify Device B logs:
   ```
   [MetBle] CBCentralManager powered on — starting peer scan
   [MetBle] BLE detection written, observedHash=<hash>
   ```
6. ✅ Confirm an encounter appears in the Met app on Device B.

---

### Step 2 — Kill-restore: confirm GATT is readable after Device A is killed

> This is the primary test for the fix.

1. On Device A, ensure Met is advertising (Step 1 confirmed this).
2. Force-kill the Met app on Device A using the app switcher (swipe up).
3. Keep Device B's Met app running in the foreground (or background — BLE scan
   survives either way).
4. Wait 5–30 seconds. iOS will relaunch Device A's app in the background when
   Device B's scanner detects the Met service UUID.
5. In Device A's console, look for the following log sequence:
   ```
   [MetBle] peripheralManager willRestoreState
   [MetBle] restoreOwnerContext: restored uid=<uid>
   [MetBle] restoreAndRepublishGattService: GATT service queued for hash=<hash>
   ```
   And shortly after (once CoreBluetooth confirms the add):
   ```
   [MetBle] add(service) succeeded    ← or the didAdd delegate log line
   ```
6. On Device B's console, confirm:
   ```
   [MetBle] BLE detection written, observedHash=<hash>
   ```
7. ✅ Confirm a new encounter appears in Device B's Met app.

**Failure mode (pre-fix):** Device B would log `didFailToConnect` or no
`BLE detection written` line, because Device A had no GATT service.

---

### Step 3 — Race condition: central restores after peripheral

This step stresses the ordering between the two CoreBluetooth manager restores.

1. Repeat Step 2.
2. On Device A's console verify that `restoreAndRepublishGattService` logged
   the hash **even if** the `[MetBle] CBCentralManager willRestoreState` line
   appears **after** the peripheral willRestoreState line.
3. ✅ Encounters on Device B confirm the fix is not order-dependent — the
   peripheral delegate calls `restoreOwnerContext()` itself rather than relying
   on the central delegate to have run first.

---

### Step 4 — Cold reboot verification (optional but thorough)

1. Reboot Device A.
2. Without opening the Met app, let iOS relaunch it in the background when
   Device B scans.  This is the most extreme test of the fix because the app
   has never run in the foreground after the reboot.
3. Confirm Step 2 log sequence and encounter on Device B.

> Note: iOS may suppress background launches after a reboot until the device
> is unlocked at least once. If no relaunch occurs, unlock the device, then
> lock it again without opening Met, and repeat.

---

## Pass Criteria

| Check | Expected result |
|-------|-----------------|
| `[MetBle] restoreAndRepublishGattService` in Device A console | ✅ Present |
| `[MetBle] add(service)` succeeded in Device A console | ✅ Present (within ~1 s of willRestoreState) |
| `[MetBle] BLE detection written` in Device B console | ✅ Present |
| New encounter visible in Device B's Met app | ✅ Present |
| Device A console shows no `no hash — GATT re-publish skipped` warning | ✅ Absent |

---

## Automated Unit Tests

The `MetBleRestoreTests.swift` file in this directory contains:

- **`GattRestoreLogicTests`** — pure-logic XCTests that run on the Simulator.
  They exercise `restoreOwnerContext` and `restoreAndRepublishGattService` via a
  protocol-based spy, without touching real CoreBluetooth hardware.

- **`GattRestoreIntegrationTests`** — real-hardware XCTests that construct a
  `CBPeripheralManager` with the same restore identifier as production and assert
  that the hash characteristic is published after `willRestoreState` fires.
  These **must** run on a physical device.

See the comment block at the top of `MetBleRestoreTests.swift` for instructions
on adding the test target in Xcode.

---

## Reverting / Debugging

If encounters stop working after this change:

1. Check `[MetBle] restoreAndRepublishGattService` — if it logs
   `no hash — GATT re-publish skipped`, the UserDefaults write in
   `startAdvertisingImpl` is not happening (check `kOwnerHashKey` spelling).
2. If `add(service)` returns an error, check for duplicate-service races
   (`ensureGattService` removes the old service before adding, but a delayed
   `didAdd` callback from a previous run could arrive out of order).
3. Ensure the EAS build includes the `bluetooth-peripheral` UIBackgroundMode in
   `app.json` (required for `CBPeripheralManagerOptionRestoreIdentifierKey` to
   take effect).
