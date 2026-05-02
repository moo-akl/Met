// Stable BLE identifiers for Met. Changing any value here is a
// PROTOCOL-BREAKING change — older clients won't see newer
// advertisements and vice versa.
//
// We currently run TWO advertising/scanning paths in parallel:
//
//   1. iBeacon (primary, since v1.1) — same scheme the original Flutter
//      MVP shipped with: every device broadcasts <UUID, major, minor=1>
//      where `major = stableHash(uid) mod 65535`. This works
//      cross-platform out of the box and is detected via CoreLocation
//      ranging on iOS and a manufacturer-data scan on Android. It's
//      also the only path that works when the app is backgrounded
//      with the screen off (iOS region monitoring wakes the app).
//
//   2. GATT (legacy, kept for backwards compat) — a custom 128-bit
//      service UUID with the user's 8-byte SHA-256 hash carried in the
//      service-data field. Older builds in the wild still rely on this.
//      The server's `/api/ble/resolve` endpoint accepts both `hashes`
//      and `majors` so a single resolve covers both pipelines.

/**
 * Met iBeacon proximity UUID (128-bit). Matches the original Flutter
 * MVP UUID byte-for-byte so installs that bridge between versions
 * still cross-detect during the migration window.
 */
export const MET_IBEACON_UUID = "eb2a1103-b8c5-4384-9549-c18428511674";

/** Constant minor value broadcast in every Met iBeacon packet. */
export const MET_IBEACON_MINOR = 1;

/** Human-readable region identifier passed to CoreLocation. */
export const MET_IBEACON_REGION_ID = "MetBeaconRegion";

/**
 * Met service UUID (128-bit) for the legacy GATT pipeline. Kept for
 * older clients in the wild that haven't received the iBeacon update.
 * The first 4 bytes spell "MET\0" in ASCII so it's easy to recognise
 * in packet captures.
 */
export const MET_SERVICE_UUID = "4d455400-7770-4ac2-9b3d-000000000001";

/**
 * Lowercase no-dashes form, used by some BLE libraries (especially the
 * Android side).
 */
export const MET_SERVICE_UUID_RAW = MET_SERVICE_UUID.replace(/-/g, "");

/**
 * Local-name prefix advertised when running on iOS via the legacy GATT
 * path, where service-data payloads are sometimes stripped. Format:
 * `met:<16-hex-chars>`.
 */
export const MET_LOCAL_NAME_PREFIX = "met:";
