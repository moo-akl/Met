---
name: Android BLE foreground service
description: MetBleService (foreground service for background BLE scanning) used to only start when GATT advertising succeeded; setBackgroundMode() decouples it
---

The `MetBleService` Android foreground service keeps the process in the foreground-service tier so react-native-ble-plx scanning continues in background. Originally it was only started when GATT advertising (`startGattAdvertisingImpl`) or iBeacon advertising (`startBeaconAdvertisingImpl`) succeeded — meaning devices where advertising fails (chipset limitations, permission issues) never got the foreground service and background BLE scanning was throttled/killed by Android.

**The fix:** Added `setBackgroundMode(active: Boolean)` to `MetBleModule.kt` which manages a `fgBackground` flag alongside the existing `fgAdvertising` and `fgScanning` flags. `ensureForegroundService()` and `maybeStopForegroundService()` check all three. The JS side calls `setBackgroundMode(true)` at the start of `startBleProximity()` — before advertising is even attempted — so the foreground service is always guaranteed for the entire session.

**Why:** GPS proximity is intentionally foreground-only (no ACCESS_BACKGROUND_LOCATION). BLE is the only background detection path. If BLE background scanning doesn't work, encounters only trigger when the app is open.

**How to apply:** Any future BLE session lifecycle code should call `setBackgroundMode(true)` when BLE activity begins and `setBackgroundMode(false)` when it ends. The native side is reference-counted — the service only stops when ALL three flags are false.

**Important:** This is a native module change — requires a new EAS build to reach devices.
