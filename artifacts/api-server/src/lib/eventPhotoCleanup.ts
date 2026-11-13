import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import {
  communityEventsTable,
  db,
  venueEventsTable,
} from "@workspace/db";
import { adminStorage } from "./firebaseAdmin";
import { logger } from "./logger";
import { ObjectStorageService } from "./objectStorage";

const cleanupBatchSize = 100;
const retryDelayMs = 15 * 60 * 1000;
const adminImageStorage = new ObjectStorageService();

function isMissingStorageObject(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const statusCode = "statusCode" in error ? String(error.statusCode) : "";
  return code === "404" || statusCode === "404";
}

function getEventImageObjectPath(rawUrl: string, bucketName: string): string | null {
  try {
    const url = new URL(rawUrl);
    let objectPath: string | null = null;
    if (url.hostname === "storage.googleapis.com") {
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments[0] !== bucketName) return null;
      objectPath = segments.slice(1).map(decodeURIComponent).join("/");
    } else if (url.hostname === "firebasestorage.googleapis.com") {
      const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (!match || decodeURIComponent(match[1]!) !== bucketName) return null;
      objectPath = decodeURIComponent(match[2]!);
    }
    if (
      !objectPath ||
      !objectPath.startsWith("venue-event-images/") ||
      objectPath.split("/").some((part) => part === "..")
    ) {
      return null;
    }
    return objectPath;
  } catch {
    return null;
  }
}

async function deleteStoredImages(urls: string[]): Promise<string[]> {
  const failedUrls: string[] = [];
  const bucket = adminStorage().bucket();
  for (const url of urls) {
    try {
      const parsedUrl = new URL(url, "https://met.local");
      const adminPath = parsedUrl.pathname.startsWith("/api/storage/objects/uploads/")
        ? parsedUrl.pathname.replace(/^\/api\/storage/, "")
        : null;
      if (adminPath && /^\/objects\/uploads\/[0-9a-f-]{36}$/i.test(adminPath)) {
        try {
          const file = await adminImageStorage.getObjectEntityFile(adminPath);
          await file.delete();
        } catch (error) {
          if (!isMissingStorageObject(error)) {
            logger.warn({ error, adminPath }, "Expired admin event photo could not be removed");
            failedUrls.push(url);
          }
        }
        continue;
      }
    } catch {
      // External URLs are removed from the event record but cannot be deleted by this app.
    }
    const objectPath = getEventImageObjectPath(url, bucket.name);
    if (!objectPath) continue;
    try {
      await bucket.file(objectPath).delete();
    } catch (error) {
      if (!isMissingStorageObject(error)) {
        logger.warn({ error, objectPath }, "Expired event photo could not be removed");
        failedUrls.push(url);
      }
    }
  }
  return failedUrls;
}

export async function cleanupExpiredEventPhotos(now = new Date()): Promise<number> {
  const venueExpired = await db
    .select({
      id: venueEventsTable.id,
      imageUrl: venueEventsTable.imageUrl,
      galleryPhotos: venueEventsTable.galleryPhotos,
    })
    .from(venueEventsTable)
    .where(or(
      lte(venueEventsTable.photosExpireAt, now),
      and(
        isNull(venueEventsTable.photosExpireAt),
        sql`(
          ${venueEventsTable.imageUrl} IS NOT NULL OR
          cardinality(${venueEventsTable.galleryPhotos}) > 0
        )`,
        sql`COALESCE(${venueEventsTable.endsAt}, ${venueEventsTable.startsAt} + INTERVAL '4 hours')
          + INTERVAL '12 hours' <= ${now}`,
      ),
    ))
    .limit(cleanupBatchSize);
  const communityExpired = await db
    .select({
      id: communityEventsTable.id,
      imageUrl: communityEventsTable.imageUrl,
      galleryPhotos: communityEventsTable.galleryPhotos,
    })
    .from(communityEventsTable)
    .where(or(
      lte(communityEventsTable.photosExpireAt, now),
      and(
        isNull(communityEventsTable.photosExpireAt),
        sql`(
          ${communityEventsTable.imageUrl} IS NOT NULL OR
          cardinality(${communityEventsTable.galleryPhotos}) > 0
        )`,
        sql`COALESCE(${communityEventsTable.endsAt}, ${communityEventsTable.startsAt} + INTERVAL '4 hours')
          + INTERVAL '12 hours' <= ${now}`,
      ),
    ))
    .limit(cleanupBatchSize);

  let cleaned = 0;
  for (const [eventType, rows] of [
    ["venue", venueExpired],
    ["community", communityExpired],
  ] as const) {
    for (const event of rows) {
      const urls = [...new Set([
        event.imageUrl,
        ...(event.galleryPhotos ?? []),
      ].filter((url): url is string => Boolean(url)))];
      const failedUrls = new Set(await deleteStoredImages(urls));
      const retainedPhotos = (event.galleryPhotos ?? []).filter((url) =>
        failedUrls.has(url),
      );
      const retainedImage = event.imageUrl && failedUrls.has(event.imageUrl)
        ? event.imageUrl
        : null;
      const set = {
        imageUrl: retainedImage,
        galleryPhotos: retainedPhotos,
        photosExpireAt: failedUrls.size
          ? new Date(now.getTime() + retryDelayMs)
          : null,
      };
      if (eventType === "venue") {
        await db
          .update(venueEventsTable)
          .set(set)
          .where(eq(venueEventsTable.id, event.id));
      } else {
        await db
          .update(communityEventsTable)
          .set(set)
          .where(eq(communityEventsTable.id, event.id));
      }
      cleaned += 1;
    }
  }
  return cleaned;
}
