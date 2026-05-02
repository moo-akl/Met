// BLE identity encoding helpers.
//
// Every Met user is identified on the BLE wire by a deterministic
// 8-byte hash derived from their Firebase UID. The full UID (28
// alphanumeric chars) won't fit into a single advertisement, so we
// truncate the SHA-256 digest. 64 bits of entropy is plenty for
// collision avoidance at MVP scale.
//
// IMPORTANT: this MUST stay byte-identical to the server-side helper
// in `artifacts/api-server/src/lib/uidHash.ts`. They are paired by the
// `/api/ble/resolve` endpoint.

import * as Crypto from "expo-crypto";
import { MET_LOCAL_NAME_PREFIX } from "./uuids";

const HEX = "0123456789abcdef";

export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    out += HEX[(b >> 4) & 0x0f]! + HEX[b & 0x0f]!;
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.toLowerCase();
  if (clean.length % 2 !== 0) {
    throw new Error(`hex string has odd length: ${clean.length}`);
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const hi = HEX.indexOf(clean[i * 2]!);
    const lo = HEX.indexOf(clean[i * 2 + 1]!);
    if (hi < 0 || lo < 0) throw new Error(`invalid hex: ${clean}`);
    out[i] = (hi << 4) | lo;
  }
  return out;
}

/**
 * Compute the BLE identity hash for a Firebase UID.
 * Returns 16 lowercase hex characters (8 bytes).
 */
export async function uidToBleHash(uid: string): Promise<string> {
  const fullHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    uid,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  return fullHex.slice(0, 16).toLowerCase();
}

/**
 * Derive the iBeacon `major` value (16-bit) for a Firebase UID using
 * the same polynomial-rolling hash the original Flutter MVP shipped:
 *
 *   `acc = (31 * acc + utf16CodeUnit(c)) % 65535`
 *
 * Returns an integer in [0, 65534]. Synchronous because there's no
 * crypto involved — it's a tiny bit of arithmetic. Callers can lean
 * on this from any context (scan callbacks, advertise setup, …).
 *
 * IMPORTANT: must stay byte-identical to `uidToMajor` in
 * `artifacts/api-server/src/lib/uidHash.ts`. They are paired by the
 * `/api/ble/resolve` endpoint.
 */
export function uidToMajor(uid: string): number {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (31 * hash + uid.charCodeAt(i)) % 65535;
  }
  return hash;
}

/** Base64 (standard) encoder for the 8 raw payload bytes. */
export function bytesToBase64(bytes: Uint8Array): string {
  // Avoid Buffer (RN/Hermes doesn't always have it) and avoid the
  // global atob/btoa polyfill loops on large inputs.
  const ALPHA =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b1 = bytes[i++]!;
    const b2 = i < bytes.length ? bytes[i++]! : -1;
    const b3 = i < bytes.length ? bytes[i++]! : -1;

    out += ALPHA[b1 >> 2]!;
    out += ALPHA[((b1 & 0x03) << 4) | (b2 >= 0 ? b2 >> 4 : 0)]!;
    out += b2 >= 0 ? ALPHA[((b2 & 0x0f) << 2) | (b3 >= 0 ? b3 >> 6 : 0)]! : "=";
    out += b3 >= 0 ? ALPHA[b3 & 0x3f]! : "=";
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  const ALPHA =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Int8Array(128).fill(-1);
  for (let i = 0; i < ALPHA.length; i++) lookup[ALPHA.charCodeAt(i)] = i;
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const padding = (b64.match(/=+$/)?.[0]?.length ?? 0);
  const len = (clean.length * 6) / 8 - padding;
  const out = new Uint8Array(Math.max(0, Math.floor(len)));

  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c1 = lookup[clean.charCodeAt(i)] ?? 0;
    const c2 = lookup[clean.charCodeAt(i + 1)] ?? 0;
    const c3 = lookup[clean.charCodeAt(i + 2)] ?? 0;
    const c4 = lookup[clean.charCodeAt(i + 3)] ?? 0;

    if (p < out.length) out[p++] = (c1 << 2) | (c2 >> 4);
    if (p < out.length) out[p++] = ((c2 & 0x0f) << 4) | (c3 >> 2);
    if (p < out.length) out[p++] = ((c3 & 0x03) << 6) | c4;
  }
  return out;
}

/**
 * Try to extract a Met identity hash from a scanned advertisement.
 * Sources, in priority order:
 *
 *   1. Service data for our service UUID (8 raw bytes → 16 hex chars).
 *   2. The local name, if it begins with `met:` and is followed by 16
 *      hex characters. iOS-to-iOS may be limited to this fallback.
 *
 * Returns null if neither source yields a valid hash.
 */
export function extractHash(opts: {
  serviceData: Record<string, string> | null | undefined; // base64 keyed by UUID
  serviceDataKeys?: string[]; // UUIDs to try, lowercased
  localName: string | null | undefined;
}): string | null {
  const { serviceData, serviceDataKeys = [], localName } = opts;
  if (serviceData) {
    for (const key of serviceDataKeys) {
      // ble-plx normalises UUID keys to lowercase 128-bit form.
      const b64 = serviceData[key];
      if (typeof b64 === "string" && b64.length > 0) {
        try {
          const bytes = base64ToBytes(b64);
          if (bytes.length >= 8) {
            return bytesToHex(bytes.slice(0, 8));
          }
        } catch {
          // Fall through to the next source.
        }
      }
    }
  }
  if (typeof localName === "string" && localName.startsWith(MET_LOCAL_NAME_PREFIX)) {
    const tail = localName.slice(MET_LOCAL_NAME_PREFIX.length);
    if (/^[0-9a-fA-F]{16}/.test(tail)) {
      return tail.slice(0, 16).toLowerCase();
    }
  }
  return null;
}
