import { and, eq, gt, inArray, lte } from "drizzle-orm";
import {
  db,
  communityEventPlanNotificationPreferencesTable,
  profilesTable,
  venueEventNotificationRunsTable,
  venueEventRsvpsTable,
  venueEventsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { sendPushWithStatus } from "./push";

export type VenueEventNotificationKind =
  | "event_update"
  | "reminder_24h"
  | "reminder_2h";

/**
 * Notify active participants when an event-scoped plan chat receives a
 * message. Lock-screen copy stays generic so private event details and
 * message text are never exposed outside Met.
 */
export async function notifyCommunityEventPlanMessage(input: {
  eventId: number;
  participantUids: string[];
  senderUid: string;
}): Promise<void> {
  const recipientUids = [
    ...new Set(
      input.participantUids.filter(
        (uid) => uid.length > 0 && uid !== input.senderUid,
      ),
    ),
  ];
  if (recipientUids.length === 0) return;

  try {
    const [recipients, mutedPreferences] = await Promise.all([
      db
        .select({
          uid: profilesTable.uid,
          pushToken: profilesTable.pushToken,
          notificationPrefs: profilesTable.notificationPrefs,
        })
        .from(profilesTable)
        .where(inArray(profilesTable.uid, recipientUids)),
      db
        .select({
          userUid: communityEventPlanNotificationPreferencesTable.userUid,
        })
        .from(communityEventPlanNotificationPreferencesTable)
        .where(
          and(
            eq(communityEventPlanNotificationPreferencesTable.eventId, input.eventId),
            inArray(
              communityEventPlanNotificationPreferencesTable.userUid,
              recipientUids,
            ),
            eq(communityEventPlanNotificationPreferencesTable.muted, true),
          ),
        ),
    ]);
    const mutedUids = new Set(mutedPreferences.map((preference) => preference.userUid));
    const eligible = recipients.filter(
      (recipient) =>
        !mutedUids.has(recipient.uid) &&
        recipient.notificationPrefs?.notifyChat !== false &&
        Boolean(recipient.pushToken),
    );
    if (eligible.length === 0) return;

    const deliveries = await Promise.all(
      eligible.map((recipient) =>
        sendPushWithStatus(recipient.pushToken, {
          title: "New message in your plan",
          body: "Open Met to view the conversation.",
          data: {
            type: "event_plan_message",
            eventId: String(input.eventId),
            eventType: "member",
          },
        }),
      ),
    );
    logger.info(
      {
        eventId: input.eventId,
        eligibleCount: eligible.length,
        sentCount: deliveries.filter((delivery) => delivery.sent).length,
      },
      "Community event plan message notifications processed",
    );
  } catch (error) {
    logger.warn(
      { error, eventId: input.eventId },
      "Could not deliver community event plan message notifications",
    );
  }
}

const REMINDER_OFFSETS: ReadonlyArray<{
  hours: 24 | 2;
  kind: "reminder_24h" | "reminder_2h";
}> = [
  { hours: 24, kind: "reminder_24h" },
  { hours: 2, kind: "reminder_2h" },
];

/**
 * Send a generic, privacy-safe event push to current positive RSVPs and record
 * provider delivery counts. Event titles and private details are intentionally
 * omitted from lock-screen copy for invite-only events.
 */
export async function notifyVenueEventRsvps(input: {
  eventId: number;
  kind: VenueEventNotificationKind;
  scheduledFor: Date;
  isCancelled?: boolean;
}): Promise<void> {
  try {
    const [run] = await db
      .insert(venueEventNotificationRunsTable)
      .values({
        eventId: input.eventId,
        kind: input.kind,
        scheduledFor: input.scheduledFor,
      })
      .onConflictDoNothing()
      .returning({ id: venueEventNotificationRunsTable.id });

    // The unique run key also prevents duplicate sends if two API processes
    // claim the same reminder at once.
    if (!run) return;

    const recipients = await db
      .select({
        uid: venueEventRsvpsTable.userUid,
        pushToken: profilesTable.pushToken,
        notificationPrefs: profilesTable.notificationPrefs,
      })
      .from(venueEventRsvpsTable)
      .leftJoin(profilesTable, eq(profilesTable.uid, venueEventRsvpsTable.userUid))
      .where(
        and(
          eq(venueEventRsvpsTable.eventId, input.eventId),
          inArray(venueEventRsvpsTable.status, ["going", "maybe"]),
        ),
      );

    const eligible = recipients.filter(
      (recipient) =>
        recipient.notificationPrefs?.notifyEventUpdates !== false &&
        Boolean(recipient.pushToken),
    );
    const skippedCount = recipients.length - eligible.length;
    const isReminder = input.kind !== "event_update";
    const offsetHours = input.kind === "reminder_24h" ? 24 : 2;
    const title = input.isCancelled
      ? "Event cancelled"
      : isReminder
        ? "Event reminder"
        : "Event updated";
    const body = input.isCancelled
      ? "An event you RSVP’d to has been cancelled. Open Met for details."
      : isReminder
        ? `An event you RSVP’d to starts in ${offsetHours} hours. Open Met for details.`
        : "An event you RSVP’d to has changed. Open Met for details.";

    const deliveries = await Promise.all(
      eligible.map((recipient) =>
        sendPushWithStatus(recipient.pushToken, {
          title,
          body,
          data: {
            type: "venue_event_notification",
            eventType: "venue",
            eventId: String(input.eventId),
            notificationKind: input.kind,
          },
        }),
      ),
    );
    const sentCount = deliveries.filter((delivery) => delivery.sent).length;
    const failedCount = deliveries.length - sentCount;
    const status =
      failedCount === 0 ? "sent" : sentCount === 0 ? "failed" : "partial";

    await db
      .update(venueEventNotificationRunsTable)
      .set({
        recipientCount: recipients.length,
        sentCount,
        skippedCount,
        failedCount,
        status,
        completedAt: new Date(),
      })
      .where(eq(venueEventNotificationRunsTable.id, run.id));
  } catch (error) {
    logger.warn(
      { error, eventId: input.eventId, kind: input.kind },
      "Could not deliver venue event notification",
    );
  }
}

/**
 * The API process runs this inexpensive sweep once a minute. It only sends
 * reminders that are less than an hour overdue, so an extended outage never
 * results in a stale notification after the event is already underway.
 */
export async function runDueVenueEventReminders(now = new Date()): Promise<void> {
  const dueWindowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const events = await db
    .select({
      id: venueEventsTable.id,
      startsAt: venueEventsTable.startsAt,
      reminderOffsetsHours: venueEventsTable.reminderOffsetsHours,
      isPublished: venueEventsTable.isPublished,
    })
    .from(venueEventsTable)
    .where(
      and(
        eq(venueEventsTable.isPublished, true),
        eq(venueEventsTable.isHidden, false),
        gt(venueEventsTable.startsAt, now),
        lte(venueEventsTable.startsAt, dueWindowEnd),
      ),
    );

  for (const event of events) {
    for (const reminder of REMINDER_OFFSETS) {
      if (!event.reminderOffsetsHours.includes(reminder.hours)) continue;
      const scheduledFor = new Date(
        event.startsAt.getTime() - reminder.hours * 60 * 60 * 1000,
      );
      const latenessMs = now.getTime() - scheduledFor.getTime();
      if (latenessMs < 0 || latenessMs >= 60 * 60 * 1000) continue;

      await notifyVenueEventRsvps({
        eventId: event.id,
        kind: reminder.kind,
        scheduledFor,
      });
    }
  }
}
