import { createHash } from "node:crypto";

/**
 * Derive the BLE identity hash from a Firebase UID.
 *
 * The hash is the first 8 bytes of SHA-256(uid), encoded as 16 lowercase
 * hex characters. We pick 8 bytes because:
 *
 *   - It fits in a single BLE service-data field on every platform
 *     (Android allows up to ~24 bytes; iOS strips service data outside
 *     the 4-byte "advertising service data" slot when foregrounded).
 *   - 64 bits of entropy gives collision probability < 1e-15 even at a
 *     million simultaneous Met users — well within MVP tolerance.
 *   - Hex (vs base64url) keeps the local-name fallback ASCII-only so it
 *     survives iOS's `localName` constraints.
 *
 * IMPORTANT: changing this scheme is a breaking BLE protocol change —
 * older clients won't be able to detect newer ones. Bump the service
 * UUID in tandem if it ever needs to change.
 */
export function uidToHash(uid: string): string {
  return createHash("sha256").update(uid).digest("hex").slice(0, 16);
}

/** A valid identity hash is exactly 16 lowercase hex chars. */
export function isValidUidHash(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{16}$/.test(value);
}

/**
 * Derive the iBeacon `major` value (16-bit) for a Firebase UID using
 * the same polynomial-rolling hash the original Flutter MVP shipped:
 *
 *   `acc = (31 * acc + utf16CodeUnit(c)) % 65535`
 *
 * Returns an integer in the range [0, 65534]. NOT cryptographic — it
 * exists only so two phones can encode/decode the same major from
 * the same uid byte-for-byte. Collisions resolve to multiple profile
 * candidates server-side and are de-duped by the client.
 *
 * IMPORTANT: must stay byte-identical to `uidToMajor` in
 * `artifacts/met/lib/ble/encode.ts`.
 */
export function uidToMajor(uid: string): number {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (31 * hash + uid.charCodeAt(i)) % 65535;
  }
  return hash;
}

/** A valid major is an integer in [0, 65534]. */
export function isValidUidMajor(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 65534
  );
}
