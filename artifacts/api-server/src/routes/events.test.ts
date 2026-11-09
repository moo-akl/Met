import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  communityEventJoinRequestsTable,
  communityEventHostRatingsTable,
  communityEventPlanMessagesTable,
  communityEventPlanNotificationPreferencesTable,
  communityEventRsvpsTable,
  communityEventsTable,
  db,
  eventAttendanceCorrectionsTable,
  eventAttendanceTable,
  reviewsTable,
} from "@workspace/db";
import { hashEventCheckinToken } from "../lib/eventCheckinLinks";
import { hashEventInviteToken } from "../lib/eventInviteLinks";

const explorerState = vi.hoisted(() => ({ uids: new Set<string>() }));

vi.mock("../lib/verifiedExplorer", () => ({
  getVerifiedExplorerStatuses: vi.fn(async (uids: readonly string[]) =>
    new Map(uids.map((uid) => [uid, {
      isVerifiedExplorer: explorerState.uids.has(uid),
      distinctVenues: explorerState.uids.has(uid) ? 5 : 0,
      positiveMeetingReviews: explorerState.uids.has(uid) ? 10 : 0,
      requirements: { distinctVenues: 5, positiveMeetingReviews: 10 },
    }] as const)),
  ),
}));

vi.mock("../lib/eventNotifications", () => ({
  notifyCommunityEventChange: vi.fn(async () => undefined),
  notifyCommunityEventJoinDecision: vi.fn(async () => undefined),
  notifyCommunityEventJoinRequest: vi.fn(async () => undefined),
  notifyCommunityEventPlanMessage: vi.fn(async () => undefined),
}));

vi.mock("../lib/firebaseAdmin", () => ({
  verifyAppCheckToken: vi.fn(async () => true),
}));

vi.mock("../middlewares/rateLimit", () => ({
  createIpRateLimiter: () =>
    (_req: unknown, _res: unknown, next: () => void) => next(),
  createUserRateLimiter: () =>
    (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../middlewares/requireUid", () => ({
  requireUid: (
    req: { uid?: string; header: (name: string) => string | undefined },
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

import router from "./events";

process.env["NODE_ENV"] = "test";

const seed = randomUUID();
const hostUid = `explorer-events-host-${seed}`;
const explorerUid = `explorer-events-member-${seed}`;
const explorerRequesterUid = `explorer-events-requester-${seed}`;
const nonExplorerUid = `explorer-events-regular-${seed}`;
const checkinToken = randomUUID().replaceAll("-", "");
const inviteToken = randomUUID().replaceAll("-", "");
const latitude = 13.7563;
const longitude = 100.5018;
const app = express().use(express.json()).use("/api", router);
let eventId: number | null = null;

async function removeFixture() {
  if (eventId == null) return;
  await db.delete(eventAttendanceCorrectionsTable).where(and(
    eq(eventAttendanceCorrectionsTable.eventType, "member"),
    eq(eventAttendanceCorrectionsTable.eventId, eventId),
  ));
  await db.delete(eventAttendanceTable).where(and(
    eq(eventAttendanceTable.eventType, "member"),
    eq(eventAttendanceTable.eventId, eventId),
  ));
  await db.delete(communityEventHostRatingsTable).where(
    eq(communityEventHostRatingsTable.eventId, eventId),
  );
  await db.delete(reviewsTable).where(and(
    eq(reviewsTable.reviewerUid, `hangout-rating-reviewer-${seed}`),
    eq(reviewsTable.receiverUid, hostUid),
  ));
  await db.delete(communityEventPlanMessagesTable).where(
    eq(communityEventPlanMessagesTable.eventId, eventId),
  );
  await db.delete(communityEventPlanNotificationPreferencesTable).where(
    eq(communityEventPlanNotificationPreferencesTable.eventId, eventId),
  );
  await db.delete(communityEventJoinRequestsTable).where(
    eq(communityEventJoinRequestsTable.eventId, eventId),
  );
  await db.delete(communityEventRsvpsTable).where(
    eq(communityEventRsvpsTable.eventId, eventId),
  );
  await db.delete(communityEventsTable).where(eq(communityEventsTable.id, eventId));
  eventId = null;
}

beforeEach(async () => {
  await removeFixture();
  explorerState.uids.clear();
  explorerState.uids.add(explorerUid);
  explorerState.uids.add(explorerRequesterUid);

  const startsAt = new Date(Date.now() + 30 * 60_000);
  const [event] = await db
    .insert(communityEventsTable)
    .values({
      ownerUid: hostUid,
      title: "Explorer-only test hangout",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * 60_000),
      location: "Bangkok test park",
      locationPlaceId: `test-place-${seed}`,
      locationLatitude: latitude,
      locationLongitude: longitude,
      visibility: "public",
      joinApprovalRequired: true,
      verifiedExplorersOnly: true,
      inviteTokenHash: hashEventInviteToken(inviteToken),
      checkinTokenHash: hashEventCheckinToken(checkinToken),
    })
    .returning({ id: communityEventsTable.id });
  eventId = event!.id;

  await db.insert(communityEventRsvpsTable).values([
    { eventId: eventId!, userUid: explorerUid, status: "going" },
    { eventId: eventId!, userUid: explorerRequesterUid, status: "going" },
    { eventId: eventId!, userUid: nonExplorerUid, status: "going" },
  ]);
  await db.insert(communityEventJoinRequestsTable).values({
    eventId: eventId!,
    userUid: explorerUid,
    status: "accepted",
  });
});

afterAll(removeFixture);

describe("event map feed", () => {
  it("includes active private events only for people with access and removes ended events", async () => {
    const now = Date.now();
    await db
      .update(communityEventsTable)
      .set({
        startsAt: new Date(now - 30 * 60_000),
        endsAt: new Date(now + 30 * 60_000),
        visibility: "invite_only",
        inviteeUids: [explorerUid],
        joinApprovalRequired: false,
        verifiedExplorersOnly: false,
      })
      .where(eq(communityEventsTable.id, eventId!));

    const ownerFeed = await request(app)
      .get("/api/events/feed?includeOngoing=true")
      .set("x-test-uid", hostUid)
      .expect(200);
    expect(ownerFeed.body.events.some((event: { id: number }) => event.id === eventId)).toBe(true);

    const inviteeFeed = await request(app)
      .get("/api/events/feed?includeOngoing=true")
      .set("x-test-uid", explorerUid)
      .expect(200);
    expect(inviteeFeed.body.events.some((event: { id: number }) => event.id === eventId)).toBe(true);

    const strangerFeed = await request(app)
      .get("/api/events/feed?includeOngoing=true")
      .set("x-test-uid", `uninvited-${seed}`)
      .expect(200);
    expect(strangerFeed.body.events.some((event: { id: number }) => event.id === eventId)).toBe(false);

    await db
      .update(communityEventsTable)
      .set({ endsAt: new Date(now - 60_000) })
      .where(eq(communityEventsTable.id, eventId!));
    const endedFeed = await request(app)
      .get("/api/events/feed?includeOngoing=true")
      .set("x-test-uid", hostUid)
      .expect(200);
    expect(endedFeed.body.events.some((event: { id: number }) => event.id === eventId)).toBe(false);
  });

  it("uses the four-hour default end time when an event has no end time", async () => {
    const now = Date.now();
    await db
      .update(communityEventsTable)
      .set({
        startsAt: new Date(now - 2 * 60 * 60_000),
        endsAt: null,
        visibility: "public",
        joinApprovalRequired: false,
        verifiedExplorersOnly: false,
      })
      .where(eq(communityEventsTable.id, eventId!));

    const activeFeed = await request(app)
      .get("/api/events/feed?includeOngoing=true")
      .set("x-test-uid", hostUid)
      .expect(200);
    expect(activeFeed.body.events.some((event: { id: number }) => event.id === eventId)).toBe(true);

    await db
      .update(communityEventsTable)
      .set({ startsAt: new Date(now - 5 * 60 * 60_000) })
      .where(eq(communityEventsTable.id, eventId!));
    const expiredFeed = await request(app)
      .get("/api/events/feed?includeOngoing=true")
      .set("x-test-uid", hostUid)
      .expect(200);
    expect(expiredFeed.body.events.some((event: { id: number }) => event.id === eventId)).toBe(false);
  });
});

describe("completed Hangout host ratings", () => {
  it("accepts only eligible guests and exposes completed-Hangout aggregates without reviewer identities", async () => {
    const futureRating = await request(app)
      .post(`/api/community-events/${eventId}/host-rating`)
      .set("x-test-uid", explorerUid)
      .send({ rating: 4 });
    expect(futureRating.status).toBe(409);

    await db
      .update(communityEventsTable)
      .set({
        startsAt: new Date(Date.now() - 2 * 60 * 60_000),
        endsAt: new Date(Date.now() - 60 * 60_000),
      })
      .where(eq(communityEventsTable.id, eventId!));

    const nonGuestRating = await request(app)
      .post(`/api/community-events/${eventId}/host-rating`)
      .set("x-test-uid", nonExplorerUid)
      .send({ rating: 1 });
    expect(nonGuestRating.status).toBe(403);

    const hostRating = await request(app)
      .post(`/api/community-events/${eventId}/host-rating`)
      .set("x-test-uid", hostUid)
      .send({ rating: 1 });
    expect(hostRating.status).toBe(404);

    await db.insert(reviewsTable).values({
      reviewerUid: `hangout-rating-reviewer-${seed}`,
      receiverUid: hostUid,
      context: "chat",
      starRating: 1,
    });

    const firstRating = await request(app)
      .post(`/api/community-events/${eventId}/host-rating`)
      .set("x-test-uid", explorerUid)
      .send({ rating: 4 });
    expect(firstRating.status).toBe(200);
    expect(firstRating.body).toEqual({
      averageRating: 4,
      reviewCount: 1,
      myRating: 4,
    });

    const updatedRating = await request(app)
      .post(`/api/community-events/${eventId}/host-rating`)
      .set("x-test-uid", explorerUid)
      .send({ rating: 5 });
    expect(updatedRating.status).toBe(200);
    expect(updatedRating.body).toEqual({
      averageRating: 5,
      reviewCount: 1,
      myRating: 5,
    });

    await db.insert(communityEventJoinRequestsTable).values({
      eventId: eventId!,
      userUid: explorerRequesterUid,
      status: "accepted",
    });
    const secondRating = await request(app)
      .post(`/api/community-events/${eventId}/host-rating`)
      .set("x-test-uid", explorerRequesterUid)
      .send({ rating: 2 });
    expect(secondRating.status).toBe(200);
    expect(secondRating.body).toEqual({
      averageRating: 3.5,
      reviewCount: 2,
      myRating: 2,
    });

    const details = await request(app)
      .get(`/api/events/member/${eventId}`)
      .set("x-test-uid", explorerUid)
      .expect(200);
    expect(details.body.hangoutHostRating).toEqual({
      averageRating: 3.5,
      reviewCount: 2,
      myRating: 5,
    });
    expect(Object.keys(details.body.hangoutHostRating).sort()).toEqual([
      "averageRating",
      "myRating",
      "reviewCount",
    ]);
    expect(JSON.stringify(details.body.hangoutHostRating))
      .not.toContain(explorerUid);
    expect(JSON.stringify(details.body.hangoutHostRating))
      .not.toContain(explorerRequesterUid);
  });
});

describe("Explorer-only community event access", () => {
  it("hides the plan from feeds and nearby search but returns it to Explorers", async () => {
    const regularFeed = await request(app)
      .get("/api/events/feed")
      .set("x-test-uid", nonExplorerUid);
    const explorerFeed = await request(app)
      .get("/api/events/feed")
      .set("x-test-uid", explorerUid);
    expect(regularFeed.status).toBe(200);
    expect(regularFeed.body.events.some((event: { id: number }) => event.id === eventId)).toBe(false);
    expect(explorerFeed.body.events).toContainEqual(expect.objectContaining({
      id: eventId,
      verifiedExplorersOnly: true,
    }));

    const query = `latitude=${latitude}&longitude=${longitude}`;
    const regularNearby = await request(app)
      .get(`/api/events/hangouts/nearby?${query}`)
      .set("x-test-uid", nonExplorerUid);
    const explorerNearby = await request(app)
      .get(`/api/events/hangouts/nearby?${query}`)
      .set("x-test-uid", explorerUid);
    expect(regularNearby.status).toBe(200);
    expect(regularNearby.body.events.some((event: { id: number }) => event.id === eventId)).toBe(false);
    expect(explorerNearby.body.events).toContainEqual(expect.objectContaining({
      id: eventId,
      verifiedExplorersOnly: true,
    }));
  });

  it("blocks direct details, RSVP, and join requests for non-Explorers", async () => {
    const regularDetails = await request(app)
      .get(`/api/events/member/${eventId}`)
      .set("x-test-uid", nonExplorerUid);
    const explorerDetails = await request(app)
      .get(`/api/events/member/${eventId}`)
      .set("x-test-uid", explorerUid);
    expect(regularDetails.status).toBe(404);
    expect(explorerDetails.status).toBe(200);

    const regularRsvp = await request(app)
      .post(`/api/community-events/${eventId}/rsvp`)
      .set("x-test-uid", nonExplorerUid)
      .send({ status: "going" });
    const explorerRsvp = await request(app)
      .post(`/api/community-events/${eventId}/rsvp`)
      .set("x-test-uid", explorerUid)
      .send({ status: "going" });
    expect(regularRsvp.status).toBe(404);
    expect(explorerRsvp.status).toBe(200);

    const regularRequest = await request(app)
      .post(`/api/community-events/${eventId}/join-requests`)
      .set("x-test-uid", nonExplorerUid)
      .send({});
    const explorerRequest = await request(app)
      .post(`/api/community-events/${eventId}/join-requests`)
      .set("x-test-uid", explorerRequesterUid)
      .send({});
    expect(regularRequest.status).toBe(404);
    expect(explorerRequest.status).toBe(201);
  });

  it("blocks plan-chat reads and writes for non-Explorers", async () => {
    const regularRead = await request(app)
      .get(`/api/community-events/${eventId}/plan-chat`)
      .set("x-test-uid", nonExplorerUid);
    const explorerRead = await request(app)
      .get(`/api/community-events/${eventId}/plan-chat`)
      .set("x-test-uid", explorerUid);
    expect(regularRead.status).toBe(404);
    expect(explorerRead.status).toBe(200);

    const regularSend = await request(app)
      .post(`/api/community-events/${eventId}/plan-chat`)
      .set("x-test-uid", nonExplorerUid)
      .send({ text: "Can I join?" });
    const explorerSend = await request(app)
      .post(`/api/community-events/${eventId}/plan-chat`)
      .set("x-test-uid", explorerUid)
      .send({ text: "See you there." });
    expect(regularSend.status).toBe(404);
    expect(explorerSend.status).toBe(201);
  });

  it("disables QR and location check-ins for Hangouts", async () => {
    const regularQr = await request(app)
      .post("/api/events/check-in/qr")
      .set("x-test-uid", nonExplorerUid)
      .send({ token: checkinToken });
    const explorerQr = await request(app)
      .post("/api/events/check-in/qr")
      .set("x-test-uid", explorerUid)
      .send({ token: checkinToken });
    expect(regularQr.status).toBe(404);
    expect(explorerQr.status).toBe(404);

    const regularLocation = await request(app)
      .post(`/api/events/member/${eventId}/check-in/location`)
      .set("x-test-uid", nonExplorerUid)
      .send({ latitude, longitude, accuracy: 5, mocked: false });
    const explorerLocation = await request(app)
      .post(`/api/events/member/${eventId}/check-in/location`)
      .set("x-test-uid", explorerRequesterUid)
      .send({ latitude, longitude, accuracy: 5, mocked: false });
    expect(regularLocation.status).toBe(404);
    expect(explorerLocation.status).toBe(404);

    const [regularAttendance] = await db
      .select({ id: eventAttendanceTable.id })
      .from(eventAttendanceTable)
      .where(and(
        eq(eventAttendanceTable.eventType, "member"),
        eq(eventAttendanceTable.eventId, eventId!),
        eq(eventAttendanceTable.userUid, nonExplorerUid),
      ));
    expect(regularAttendance).toBeUndefined();
  });

  it("keeps Explorer-only plans out of invite-link routes", async () => {
    const resolved = await request(app)
      .post("/api/event-invites/resolve")
      .send({ token: inviteToken });
    const rsvp = await request(app)
      .post("/api/event-invites/rsvp")
      .set("x-test-uid", nonExplorerUid)
      .send({ token: inviteToken, status: "going" });
    expect(resolved.status).toBe(404);
    expect(rsvp.status).toBe(404);
  });

  it("prioritizes pending Explorer requests without accepting them", async () => {
    await db
      .update(communityEventsTable)
      .set({ verifiedExplorersOnly: false })
      .where(eq(communityEventsTable.id, eventId!));
    await db
      .delete(communityEventJoinRequestsTable)
      .where(eq(communityEventJoinRequestsTable.eventId, eventId!));

    const now = Date.now();
    await db.insert(communityEventJoinRequestsTable).values([
      {
        eventId: eventId!,
        userUid: nonExplorerUid,
        status: "pending",
        createdAt: new Date(now - 30_000),
      },
      {
        eventId: eventId!,
        userUid: explorerRequesterUid,
        status: "pending",
        createdAt: new Date(now - 20_000),
      },
      {
        eventId: eventId!,
        userUid: explorerUid,
        status: "pending",
        createdAt: new Date(now - 10_000),
      },
    ]);

    const response = await request(app)
      .get(`/api/events/member/${eventId}/attendees`)
      .set("x-test-uid", hostUid);

    expect(response.status).toBe(200);
    expect(response.body.joinRequests).toEqual([
      expect.objectContaining({
        uid: explorerRequesterUid,
        status: "pending",
        isVerifiedExplorer: true,
      }),
      expect.objectContaining({
        uid: explorerUid,
        status: "pending",
        isVerifiedExplorer: true,
      }),
      expect.objectContaining({
        uid: nonExplorerUid,
        status: "pending",
        isVerifiedExplorer: false,
      }),
    ]);
  });

  it("lets the host manage their plan even after Explorer status changes", async () => {
    const hostManage = await request(app)
      .get(`/api/community-events/${eventId}/manage`)
      .set("x-test-uid", hostUid);
    const regularManage = await request(app)
      .get(`/api/community-events/${eventId}/manage`)
      .set("x-test-uid", nonExplorerUid);
    expect(hostManage.status).toBe(200);
    expect(hostManage.body.verifiedExplorersOnly).toBe(true);
    expect(regularManage.status).toBe(404);
  });
});
