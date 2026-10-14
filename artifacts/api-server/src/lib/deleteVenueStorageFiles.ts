import { adminStorage } from "./firebaseAdmin";
import { logger } from "./logger";
import { ObjectNotFoundError, ObjectStorageService } from "./objectStorage";

// Only delete objects under these known venue-generated Storage prefixes.
// This prevents a crafted URL value from triggering deletion of an unrelated
// object in the default bucket.
const ALLOWED_PREFIXES = [
  "venue-profile-photos/", "venue-event-images/",
  "venue-announcement-images/", "venue-verification-docs/",
];
const venueObjectPath = /^\/api\/storage(\/objects\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Best-effort deletion of Storage files referenced by a venue profile.
 *
 * Two safety checks are applied to every URL before a delete is attempted:
 *   1. The URL must resolve to the configured default Storage bucket.
 *   2. The object path must begin with a known venue-generated prefix.
 *
 * URLs that fail either check are silently skipped — this guards against a
 * venue owner supplying a crafted URL that would delete an unrelated object.
 * Individual delete errors are logged. Account deletion remains best-effort;
 * admin venue deletion sets requireComplete so failed cleanup rolls back its
 * DB transaction and the stored references remain available for a retry.
 */
export async function deleteVenueStorageFiles(
  urls: (string | null | undefined)[],
  logCtx: Record<string, unknown> = {},
  options: { requireComplete?: boolean } = {},
): Promise<void> {
  let failures = 0;
  // Callers supply exclusively referenced URLs from the deletion transaction.
  // Never interpret arbitrary absolute URLs as private App Storage paths.
  for (const url of new Set(urls)) {
    if (!url) continue;
    try {
      const appObject = venueObjectPath.exec(url);
      if (appObject) {
        const file = await new ObjectStorageService().getObjectEntityFile(appObject[1]);
        await file.delete({ ignoreNotFound: true });
        continue;
      }
      if (!/^https:\/\/(?:storage\.googleapis\.com|firebasestorage\.googleapis\.com)\//.test(url)) continue;
      const bucket = adminStorage().bucket();
      const path = resolveVenueStoragePath(url, bucket.name);
      if (!path) continue;
      await bucket.file(path).delete({ ignoreNotFound: true });
    } catch (err) {
      if (err instanceof ObjectNotFoundError) continue;
      failures += 1;
      logger.warn(
        { err, ...logCtx },
        "venue storage cleanup: failed to delete file (non-fatal)",
      );
    }
  }
  if (options.requireComplete && failures) {
    throw new Error("Venue file cleanup could not finish.");
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
