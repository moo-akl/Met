import app from "./app";
import { logger } from "./lib/logger";
import { runDueVenueEventReminders } from "./lib/eventNotifications";

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
    void runDueVenueEventReminders().catch((error: unknown) => {
      logger.error({ error }, "Venue event reminder sweep failed");
    });
  };
  reminderSweep();
  setInterval(reminderSweep, 60_000).unref();
});
