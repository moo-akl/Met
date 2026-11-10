import { Router } from "express";
import { and, count, desc, eq, isNull, lt, lte } from "drizzle-orm";
import {
  db,
  notificationInboxTable,
} from "@workspace/db";
import {
  GetNotificationInboxQueryParams,
  GetNotificationInboxResponse,
  MarkAllNotificationsReadResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
  SaveLocalEventReminderBody,
  SaveLocalEventReminderResponse,
  DeleteLocalEventReminderParams,
  DeleteLocalEventReminderResponse,
} from "@workspace/api-zod";
import { requireUid } from "../middlewares/requireUid";

const router = Router();

async function getUnreadCount(uid: string): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(notificationInboxTable)
    .where(and(
      eq(notificationInboxTable.uid, uid),
      isNull(notificationInboxTable.readAt),
        lte(notificationInboxTable.createdAt, new Date()),
    ));
  return Number(result?.value ?? 0);
}

router.get("/notifications", requireUid, async (req, res): Promise<void> => {
  const parsed = GetNotificationInboxQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid notification page." });
    return;
  }

  const uid = req.uid!;
  const beforeId = parsed.data.beforeId;
  const [rows, unreadCount] = await Promise.all([
    db
      .select()
      .from(notificationInboxTable)
      .where(and(
        eq(notificationInboxTable.uid, uid),
        beforeId ? lt(notificationInboxTable.id, beforeId) : undefined,
        lte(notificationInboxTable.createdAt, new Date()),
      ))
      .orderBy(desc(notificationInboxTable.id))
      .limit(parsed.data.limit + 1),
    getUnreadCount(uid),
  ]);
  const hasMore = rows.length > parsed.data.limit;
  const items = rows.slice(0, parsed.data.limit);
  const lastItem = items[items.length - 1];

  res.setHeader("Cache-Control", "no-store");
  res.json(GetNotificationInboxResponse.parse({
    items: items.map((item) => ({
      ...item,
      data: item.data ?? {},
    })),
    unreadCount,
    nextCursor: hasMore && lastItem ? lastItem.id : null,
  }));
});

router.patch(
  "/notifications/:notificationId/read",
  requireUid,
  async (req, res): Promise<void> => {
    const parsed = MarkNotificationReadParams.safeParse({
      notificationId: req.params.notificationId,
    });
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid notification id." });
      return;
    }

    const uid = req.uid!;
    const [notification] = await db
      .select({ id: notificationInboxTable.id })
      .from(notificationInboxTable)
      .where(and(
        eq(notificationInboxTable.id, parsed.data.notificationId),
        eq(notificationInboxTable.uid, uid),
      ))
      .limit(1);
    if (!notification) {
      res.status(404).json({ message: "Notification not found." });
      return;
    }

    await db
      .update(notificationInboxTable)
      .set({ readAt: new Date() })
      .where(and(
        eq(notificationInboxTable.id, parsed.data.notificationId),
        eq(notificationInboxTable.uid, uid),
        isNull(notificationInboxTable.readAt),
      ));

    res.json(MarkNotificationReadResponse.parse({
      read: true,
      unreadCount: await getUnreadCount(uid),
    }));
  },
);

router.post(
  "/notifications/read-all",
  requireUid,
  async (req, res): Promise<void> => {
    const updated = await db
      .update(notificationInboxTable)
      .set({ readAt: new Date() })
      .where(and(
        eq(notificationInboxTable.uid, req.uid!),
        isNull(notificationInboxTable.readAt),
      ))
      .returning({ id: notificationInboxTable.id });

    res.json(MarkAllNotificationsReadResponse.parse({
      readCount: updated.length,
      unreadCount: await getUnreadCount(req.uid!),
    }));
  },
);

router.put(
  "/notifications/local-event-reminder",
  requireUid,
  async (req, res): Promise<void> => {
    const parsed = SaveLocalEventReminderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid event reminder." });
      return;
    }
    const { eventType, eventId, title, body, scheduledFor } = parsed.data;
    const sourceKey = `event-reminder:${eventType}:${eventId}`;
    await db
      .insert(notificationInboxTable)
      .values({
        uid: req.uid!,
        title,
        body,
        data: {
          type: "event_reminder",
          eventType,
          eventId: String(eventId),
        },
        sourceKey,
        createdAt: scheduledFor,
        readAt: null,
      })
      .onConflictDoUpdate({
        target: [
          notificationInboxTable.uid,
          notificationInboxTable.sourceKey,
        ],
        set: {
          title,
          body,
          data: {
            type: "event_reminder",
            eventType,
            eventId: String(eventId),
          },
          createdAt: scheduledFor,
          readAt: null,
        },
      });

    res.json(SaveLocalEventReminderResponse.parse({ saved: true }));
  },
);

router.delete(
  "/notifications/local-event-reminder/:eventType/:eventId",
  requireUid,
  async (req, res): Promise<void> => {
    const parsed = DeleteLocalEventReminderParams.safeParse({
      eventType: req.params.eventType,
      eventId: req.params.eventId,
    });
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid event reminder." });
      return;
    }
    const sourceKey =
      `event-reminder:${parsed.data.eventType}:${parsed.data.eventId}`;
    const deleted = await db
      .delete(notificationInboxTable)
      .where(and(
        eq(notificationInboxTable.uid, req.uid!),
        eq(notificationInboxTable.sourceKey, sourceKey),
      ))
      .returning({ id: notificationInboxTable.id });

    res.json(DeleteLocalEventReminderResponse.parse({
      deleted: deleted.length > 0,
    }));
  },
);

export default router;
