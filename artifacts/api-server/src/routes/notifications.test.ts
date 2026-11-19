import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  notificationInboxTable,
  profilesTable,
} from "@workspace/db";

vi.mock("../middlewares/requireUid", () => ({
  requireUid: (
    req: {
      uid?: string;
      header: (name: string) => string | undefined;
    },
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: () => void,
  ) => {
    const uid = req.header("x-test-uid");
    if (!uid) {
      res.status(401).json({ message: "Sign in." });
      return;
    }
    req.uid = uid;
    next();
  },
}));

import router from "./notifications";

const uid = `notification-inbox-${randomUUID()}`;
const app = express().use(express.json()).use("/api", router);

async function clearInbox() {
  await db
    .delete(notificationInboxTable)
    .where(eq(notificationInboxTable.uid, uid));
}

describe("notification inbox", () => {
  beforeAll(async () => {
    await db.insert(profilesTable).values({
      uid,
      displayName: "Inbox test",
    });
  });

  beforeEach(clearInbox);

  afterAll(async () => {
    await clearInbox();
    await db.delete(profilesTable).where(eq(profilesTable.uid, uid));
  });

  it("keeps chat alerts out of the general inbox and unread count", async () => {
    const earlier = new Date(Date.now() - 60_000);
    const later = new Date(Date.now() - 1_000);
    const newest = new Date(Date.now() - 500);
    await db.insert(notificationInboxTable).values([
      {
        uid,
        title: "Earlier general notification",
        body: "Earlier body",
        data: { type: "reveal_request", fromUid: "peer-a" },
        createdAt: earlier,
      },
      {
        uid,
        title: "Later general notification",
        body: "Later body",
        data: { type: "event_reminder", eventId: "42" },
        createdAt: later,
        readAt: later,
      },
      {
        uid,
        title: "Direct message",
        body: "A new message",
        data: { type: "chat_message", chatPeerUid: "peer-a" },
        createdAt: newest,
      },
      {
        uid,
        title: "Plan chat message",
        body: "A new plan message",
        data: { type: "event_plan_message", eventId: "42" },
        createdAt: new Date(newest.getTime() + 1),
      },
    ]);

    const firstPage = await request(app)
      .get("/api/notifications?limit=1")
      .set("x-test-uid", uid);
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.items[0].title).toBe("Later general notification");
    expect(firstPage.body.unreadCount).toBe(1);
    expect(firstPage.body.nextCursor).toEqual(expect.any(Number));

    const secondPage = await request(app)
      .get(`/api/notifications?limit=1&beforeId=${firstPage.body.nextCursor}`)
      .set("x-test-uid", uid);
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.items[0].title).toBe("Earlier general notification");
    expect(secondPage.body.nextCursor).toBeNull();

    const directMessage = await db
      .select({ id: notificationInboxTable.id })
      .from(notificationInboxTable)
      .where(and(
        eq(notificationInboxTable.uid, uid),
        eq(notificationInboxTable.title, "Direct message"),
      ))
      .limit(1);
    const hiddenChatNotification = await request(app)
      .patch(`/api/notifications/${directMessage[0]!.id}/read`)
      .set("x-test-uid", uid);
    expect(hiddenChatNotification.status).toBe(404);
  });

  it("marks only general notifications as read", async () => {
    const [first, second] = await db.insert(notificationInboxTable).values([
      {
        uid,
        title: "One",
        body: "First",
        data: { type: "reveal_request", fromUid: "peer-a" },
      },
      {
        uid,
        title: "Two",
        body: "Second",
        data: { type: "encounter", encounterId: "peer-b" },
      },
      {
        uid,
        title: "Chat",
        body: "Message",
        data: { type: "chat_message", chatPeerUid: "peer-c" },
      },
      {
        uid,
        title: "Plan chat",
        body: "Message",
        data: { type: "event_plan_message", eventId: "43" },
      },
    ]).returning({ id: notificationInboxTable.id });

    const single = await request(app)
      .patch(`/api/notifications/${first!.id}/read`)
      .set("x-test-uid", uid);
    expect(single.status).toBe(200);
    expect(single.body).toEqual({ read: true, unreadCount: 1 });

    const all = await request(app)
      .post("/api/notifications/read-all")
      .set("x-test-uid", uid);
    expect(all.status).toBe(200);
    expect(all.body).toEqual({ readCount: 1, unreadCount: 0 });

    const chatRows = await db
      .select({
        data: notificationInboxTable.data,
        readAt: notificationInboxTable.readAt,
      })
      .from(notificationInboxTable)
      .where(eq(notificationInboxTable.uid, uid));
    expect(chatRows.filter((row) => row.data.type === "chat_message" || row.data.type === "event_plan_message"))
      .toHaveLength(2);
    expect(chatRows.filter((row) => row.data.type === "chat_message" || row.data.type === "event_plan_message")
      .every((row) => row.readAt === null))
      .toBe(true);

    const foreign = await request(app)
      .patch(`/api/notifications/${second!.id}/read`)
      .set("x-test-uid", `other-${uid}`);
    expect(foreign.status).toBe(404);
  });

  it("keeps scheduled event reminders hidden until their fire time and removes cancellations", async () => {
    const body = {
      eventType: "member",
      eventId: 12345,
      title: "Hangout reminder",
      body: "Your hangout starts soon.",
      scheduledFor: new Date(Date.now() + 60_000).toISOString(),
    };
    const saved = await request(app)
      .put("/api/notifications/local-event-reminder")
      .set("x-test-uid", uid)
      .send(body);
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ saved: true });

    const hiddenUntilDue = await request(app)
      .get("/api/notifications")
      .set("x-test-uid", uid);
    expect(hiddenUntilDue.body.items).toHaveLength(0);
    expect(hiddenUntilDue.body.unreadCount).toBe(0);

    const due = await request(app)
      .put("/api/notifications/local-event-reminder")
      .set("x-test-uid", uid)
      .send({ ...body, scheduledFor: new Date(Date.now() - 1_000).toISOString() });
    expect(due.status).toBe(200);
    const visible = await request(app)
      .get("/api/notifications")
      .set("x-test-uid", uid);
    expect(visible.body.items).toHaveLength(1);
    expect(visible.body.items[0].data).toEqual({
      type: "event_reminder",
      eventType: "member",
      eventId: "12345",
    });

    const removed = await request(app)
      .delete("/api/notifications/local-event-reminder/member/12345")
      .set("x-test-uid", uid);
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ deleted: true });
    expect((await request(app).get("/api/notifications").set("x-test-uid", uid)).body.items)
      .toHaveLength(0);
  });
});
