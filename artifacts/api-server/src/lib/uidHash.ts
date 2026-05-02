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
