import { adminStorage } from "./firebaseAdmin";
import { logger } from "./logger";

// Only delete objects under these known venue-generated Storage prefixes.
// This prevents a crafted URL value from triggering deletion of an unrelated
// object in the default bucket.
const ALLOWED_PREFIXES = ["venue-profile-photos/", "venue-event-images/"];

/**
 * Best-effort deletion of Storage files referenced by a venue profile.
 *
 * Two safety checks are applied to every URL before a delete is attempted:
 *   1. The URL must resolve to the configured default Storage bucket.
 *   2. The object path must begin with a known venue-generated prefix.
 *
 * URLs that fail either check are silently skipped — this guards against a
 * venue owner supplying a crafted URL that would delete an unrelated object.
 * Individual delete errors are logged but do not propagate so that a single
 * failing file never aborts the surrounding account-deletion flow.
 */
export async function deleteVenueStorageFiles(
  urls: (string | null | undefined)[],
  logCtx: Record<string, unknown> = {},
): Promise<void> {
  const bucket = adminStorage().bucket();
  const bucketName = bucket.name;

  for (const url of urls) {
    if (!url) continue;
    const path = resolveVenueStoragePath(url, bucketName);
    if (!path) continue;
    try {
      await bucket.file(path).delete({ ignoreNotFound: true });
    } catch (err) {
      logger.warn(
        { err, url, ...logCtx },
        "venue storage cleanup: failed to delete file (non-fatal)",
      );
    }
  }
}

/**
 * Returns the GCS object path only when the URL targets `expectedBucket` AND
 * the path begins with a known venue-generated prefix. Returns null otherwise.
 *
 * Exported for unit testing; callers should use `deleteVenueStorageFiles`.
 *
 * Handles both URL forms produced by the server:
 *   https://storage.googleapis.com/<bucket>/<path>
 *   https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encoded-path>?...
 */
export function resolveVenueStoragePath(
  url: string,
  expectedBucket: string,
): string | null {
  let bucket: string | null = null;
  let rawPath: string | null = null;

  // https://storage.googleapis.com/<bucket>/<path>
  const gcsMatch = url.match(/^https:\/\/storage\.googleapis\.com\/([^/]+)\/(.+)$/);
  if (gcsMatch) {
    bucket = gcsMatch[1];
    rawPath = gcsMatch[2];
  }

  if (!rawPath) {
    // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encoded-path>?...
    const fbMatch = url.match(
      /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?]+)/,
    );
    if (fbMatch) {
      bucket = fbMatch[1];
      rawPath = fbMatch[2];
    }
  }

  if (!rawPath || !bucket) return null;
  if (bucket !== expectedBucket) return null;

  let path: string;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    // Malformed percent-encoding (e.g. %ZZ) — skip silently.
    return null;
  }

  if (!ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;

  return path;
}
