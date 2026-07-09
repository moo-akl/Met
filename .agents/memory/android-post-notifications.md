---
name: Android POST_NOTIFICATIONS runtime permission
description: Android 13+ (API 33) requires explicit runtime request for POST_NOTIFICATIONS or foreground service notification is silently hidden
---

## Rule
On Android 13+ (API 33), `POST_NOTIFICATIONS` must be requested at runtime via `PermissionsAndroid.request()` before starting the foreground service. Without this, the persistent notification is silently suppressed even if the service is running.

**Why:** Android 13 made notification permission opt-in at runtime (like camera/location). The manifest entry alone is not enough.

**How to apply:**
- In `lib/ble/index.ts` `startBleProximity()`, check `Platform.OS === "android" && Platform.Version >= 33` and call `PermissionsAndroid.request(PERMISSIONS.POST_NOTIFICATIONS)` before `setBackgroundMode(true)`.
- `POST_NOTIFICATIONS` is already declared in `app.json` android permissions array.
