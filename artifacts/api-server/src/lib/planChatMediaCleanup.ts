import { inArray, lte } from "drizzle-orm";
import {
  communityEventPlanMediaUploadsTable,
  communityEventPlanMessagesTable,
  db,
} from "@workspace/db";
import { adminStorage } from "./firebaseAdmin";
import { logger } from "./logger";

const cleanupBatchSize = 100;

function isMissingStorageObject(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const statusCode = "statusCode" in error ? String(error.statusCode) : "";
  return code === "404" || statusCode === "404";
}

/**
 * Remove expired event-plan media from Firebase Storage before deleting the
 * corresponding message rows. Failed object removals remain queued for retry.
 */
export async function cleanupExpiredPlanChatMedia(
  now = new Date(),
): Promise<number> {
  const expiredUploads = await db
    .select({
      objectPath: communityEventPlanMediaUploadsTable.objectPath,
    })
    .from(communityEventPlanMediaUploadsTable)
    .where(lte(communityEventPlanMediaUploadsTable.expiresAt, now))
    .limit(cleanupBatchSize);
  const expiredUploadPaths: string[] = [];
  for (const upload of expiredUploads) {
    try {
      await adminStorage().bucket().file(upload.objectPath).delete();
      expiredUploadPaths.push(upload.objectPath);
    } catch (error) {
      if (isMissingStorageObject(error)) {
        expiredUploadPaths.push(upload.objectPath);
      } else {
        logger.warn(
          { error },
          "Expired event-plan upload could not be removed",
        );
      }
    }
  }
  if (expiredUploadPaths.length > 0) {
    await db
      .delete(communityEventPlanMediaUploadsTable)
      .where(inArray(communityEventPlanMediaUploadsTable.objectPath, expiredUploadPaths));
  }

  const expired = await db
    .select({
      id: communityEventPlanMessagesTable.id,
      mediaObjectPath: communityEventPlanMessagesTable.mediaObjectPath,
    })
    .from(communityEventPlanMessagesTable)
    .where(
      lte(communityEventPlanMessagesTable.mediaExpiresAt, now),
    )
    .limit(cleanupBatchSize);

  if (expired.length === 0) return expiredUploadPaths.length;

  const deletableIds: number[] = [];
  for (const message of expired) {
    if (message.mediaObjectPath) {
      try {
        await adminStorage().bucket().file(message.mediaObjectPath).delete();
      } catch (error) {
        if (!isMissingStorageObject(error)) {
          logger.warn(
            { error, messageId: message.id },
            "Expired event-plan media could not be removed",
          );
          continue;
        }
      }
    }
    deletableIds.push(message.id);
  }

  if (deletableIds.length > 0) {
    await db
      .delete(communityEventPlanMessagesTable)
      .where(inArray(communityEventPlanMessagesTable.id, deletableIds));
  }
  return expiredUploadPaths.length + deletableIds.length;
}
