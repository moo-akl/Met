// Stable BLE identifiers for Met. Changing any value here is a
// PROTOCOL-BREAKING change — older clients won't see newer
// advertisements and vice versa. Bump the service UUID's last 2 bytes
// (the "version" tail) only.
//
// The 128-bit Met service UUID is what scanners filter on, and what
// peripherals advertise. The first 4 bytes spell "MET\0" in ASCII so
// it's easy to recognise in packet captures.

/**
 * Met service UUID (128-bit). Filter scans on this UUID, advertise it
 * from peripherals.
 */
export const MET_SERVICE_UUID = "4d455400-7770-4ac2-9b3d-000000000001";

/**
 * Lowercase no-dashes form, used by some BLE libraries (especially the
 * Android side).
 */
export const MET_SERVICE_UUID_RAW = MET_SERVICE_UUID.replace(/-/g, "");

/**
 * Local-name prefix advertised when running on iOS, where service-data
 * payloads are sometimes stripped. Format: `met:<16-hex-chars>`.
 */
export const MET_LOCAL_NAME_PREFIX = "met:";

/**
 * Read-only characteristic on the Met GATT service that returns the
 * 8-byte identity hash. Used as the "GATT-on-detection" fallback for
 * iOS↔iOS background pairs, where iOS strips serviceData/localName
 * from a backgrounded peripheral's advertisement and only the service
 * UUID survives. The scanner connects, reads this characteristic, and
 * then feeds the hash into the normal `/api/ble/resolve` pipeline.
 *
 * Last byte of the UUID bumps to `02` to keep the protocol-versioning
 * scheme from `MET_SERVICE_UUID` consistent.
 */
export const MET_HASH_CHARACTERISTIC_UUID =
  "4d455400-7770-4ac2-9b3d-000000000002";
