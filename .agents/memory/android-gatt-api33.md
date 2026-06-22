---
name: Android GATT characteristic read API 33+ dual-callback pattern
description: On Android 13+ (API 33), only the 4-argument onCharacteristicRead fires. Must override both signatures for full version coverage.
---

## Rule
Whenever implementing `BluetoothGattCallback.onCharacteristicRead` in an Android BLE client, override BOTH signatures:

```kotlin
// API 33+ — fires exclusively on Android 13+ when compileSdk ≥ 33
override fun onCharacteristicRead(
    gatt: BluetoothGatt,
    characteristic: BluetoothGattCharacteristic,
    value: ByteArray,
    status: Int
) { handleRead(gatt, characteristic, value, status) }

// Pre-API 33 fallback — fires on Android < 13
@Suppress("DEPRECATION")
override fun onCharacteristicRead(
    gatt: BluetoothGatt,
    characteristic: BluetoothGattCharacteristic,
    status: Int
) { handleRead(gatt, characteristic, characteristic.value, status) }
```

**Why:** The project targets compileSdkVersion=36 and targetSdkVersion=35. On API 33+ devices, the system calls only the new 4-argument overload. If you only implement the deprecated 3-argument version, hash reads from backgrounded iOS peers silently fail on all Android 13+ devices (the majority of active Android devices).

**How to apply:** Always use a private helper (e.g. `handleRead`) to avoid duplicating the business logic. Use `characteristic.value` only in the deprecated path; in the new path, use the `value: ByteArray` parameter directly (it holds the freshly-read data, not a stale cache).
