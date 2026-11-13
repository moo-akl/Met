import app from "./app";
import { logger } from "./lib/logger";
import {
  runDueCommunityEventHostRatingPrompts,
  runDueVenueEventReminders,
} from "./lib/eventNotifications";
import { cleanupExpiredPlanChatMedia } from "./lib/planChatMediaCleanup";
import { advanceDueRecurringFriendPlans } from "./lib/communityEventRecurrence";
import { cleanupExpiredEventPhotos } from "./lib/eventPhotoCleanup";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  const reminderSweep = () => {
    void (async () => {
      await advanceDueRecurringFriendPlans();
      await Promise.all([
        runDueVenueEventReminders(),
        runDueCommunityEventHostRatingPrompts(),
        cleanupExpiredPlanChatMedia(),
        cleanupExpiredEventPhotos(),
      ]);
    })().catch((error: unknown) => {
      logger.error({ error }, "Notification/media cleanup sweep failed");
    });
  };
  reminderSweep();
  setInterval(reminderSweep, 60_000).unref();
});
