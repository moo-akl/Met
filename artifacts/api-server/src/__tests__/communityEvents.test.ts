import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import {
  communityEventRsvpsTable,
  communityEventJoinRequestsTable,
  communityEventPlanMessagesTable,
  communityEventPlanNotificationPreferencesTable,
  communityEventsTable,
  db,
  eventAttendanceTable,
  eventAttendanceCorrectionsTable,
  profilesTable,
  venueContentReportsTable,
} from "@workspace/db";
import eventsRouter from "../routes/events";
import reportsRouter from "../routes/reports";

const { mockSendPushWithStatus } = vi.hoisted(() => ({
  mockSendPushWithStatus: vi.fn().mockResolvedValue({ sent: true }),
}));

vi.mock("../lib/push", () => ({
  sendPush: vi.fn(),
  sendPushWithStatus: mockSendPushWithStatus,
  checkNearbyPushAllowed: vi.fn(() => true),
}));

vi.mock("../middlewares/rateLimit", () => ({
  createUserRateLimiter:
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createIpRateLimiter:
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/firebaseAdmin", () => ({
  adminAuth: () => ({
    verifyIdToken: vi.fn().mockRejectedValue(new Error("not used in these tests")),
  }),
  adminDb: () => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ create: vi.fn().mockResolvedValue(undefined) })),
    })),
  }),
  adminStorage: {},
}));

const hasDatabase = Boolean(process.env["DATABASE_URL"]);
process.env["SESSION_SECRET"] ??= "test-event-invite-session-secret";
const testPrefix = `itest-event-${process.pid}`;
const OWNER_UID = `${testPrefix}-owner`;
const INVITEE_UID = `${testPrefix}-invitee`;
const OTHER_UID = `${testPrefix}-other`;
const MUTED_UID = `${testPrefix}-muted`;
const app = express();
app.use(express.json());
app.use("/api", eventsRouter);
app.use("/api", reportsRouter);

function uidHeader(uid: string) {
  return { "X-Met-Uid": uid };
}

async function cleanup() {
  const ownedEvents = await db
    .select({ id: communityEventsTable.id })
    .from(communityEventsTable)
    .where(eq(communityEventsTable.ownerUid, OWNER_UID));

  if (ownedEvents.length) {
    await db
      .delete(communityEventJoinRequestsTable)
      .where(inArray(
        communityEventJoinRequestsTable.eventId,
        ownedEvents.map(({ id }) => id),
      ));
    await db
      .delete(communityEventPlanMessagesTable)
      .where(inArray(
        communityEventPlanMessagesTable.eventId,
        ownedEvents.map(({ id }) => id),
      ));
    await db
      .delete(communityEventPlanNotificationPreferencesTable)
      .where(
        inArray(
          communityEventPlanNotificationPreferencesTable.eventId,
          ownedEvents.map(({ id }) => id),
        ),
      );
    await db
      .delete(venueContentReportsTable)
      .where(and(
        eq(venueContentReportsTable.entityType, "community_event"),
        inArray(venueContentReportsTable.entityId, ownedEvents.map(({ id }) => id)),
      ));
    await db
      .delete(communityEventRsvpsTable)
      .where(inArray(communityEventRsvpsTable.eventId, ownedEvents.map(({ id }) => id)));
    await db
      .delete(eventAttendanceCorrectionsTable)
      .where(and(
        eq(eventAttendanceCorrectionsTable.eventType, "member"),
        inArray(eventAttendanceCorrectionsTable.eventId, ownedEvents.map(({ id }) => id)),
      ));
    await db
      .delete(eventAttendanceTable)
      .where(and(
        eq(eventAttendanceTable.eventType, "member"),
        inArray(eventAttendanceTable.eventId, ownedEvents.map(({ id }) => id)),
      ));
  }

  await db
    .delete(communityEventsTable)
    .where(eq(communityEventsTable.ownerUid, OWNER_UID));
  await db
    .delete(profilesTable)
    .where(inArray(profilesTable.uid, [OWNER_UID, INVITEE_UID, OTHER_UID, MUTED_UID]));
}

describe.runIf(hasDatabase)("community event permissions and privacy", () => {
  beforeAll(async () => {
    await cleanup();
    await db.insert(profilesTable).values([
      { uid: OWNER_UID, displayName: "Event Owner", photoUrl: "https://example.com/owner.jpg" },
      { uid: INVITEE_UID, displayName: "Event Invitee", photoUrl: "https://example.com/invitee.jpg" },
      { uid: OTHER_UID, displayName: "Other Guest", photoUrl: "https://example.com/other.jpg" },
      { uid: MUTED_UID, displayName: "Muted Guest", photoUrl: "https://example.com/muted.jpg" },
    ]);
  });

  afterAll(cleanup);

  it("searches and pages matching public hangouts beyond the old feed cap", async () => {
    await db
      .insert(communityEventsTable)
      .values([
        ...Array.from({ length: 105 }, (_, index) => ({
          ownerUid: OWNER_UID,
          title: `Nearby paging fixture ${index}`,
          startsAt: new Date(Date.UTC(2032, 5, 1, 8, index)),
          location: index === 104 ? "Target Pavilion" : `Test Place ${index}`,
          locationPlaceId: `nearby-paging-${index}`,
          locationLatitude: 13.7563 + index * 0.001,
          locationLongitude: 100.5018,
          visibility: "public",
          joinApprovalRequired: true,
        })),
        {
          ownerUid: OWNER_UID,
          title: "Nearby private plan",
          startsAt: new Date(Date.UTC(2032, 5, 1, 8, 0)),
          location: "Target Pavilion",
          visibility: "invite_only",
          joinApprovalRequired: true,
        },
        {
          ownerUid: OWNER_UID,
          title: "Nearby ordinary event",
          startsAt: new Date(Date.UTC(2032, 5, 1, 8, 0)),
          location: "Target Pavilion",
          visibility: "public",
          joinApprovalRequired: false,
        },
      ]);

    const requestPage = (offset: number) =>
      request(app)
        .get("/api/events/hangouts/nearby")
        .set(uidHeader(OTHER_UID))
        .query({
          limit: 50,
          offset,
          sortMode: "soonest",
          timePeriod: "morning",
          date: "2032-06-01",
          timeZone: "UTC",
        })
        .expect(200);

    const firstPage = await requestPage(0);
    const secondPage = await requestPage(50);
    const thirdPage = await requestPage(100);
    const pagedEvents = [
      ...firstPage.body.events,
      ...secondPage.body.events,
      ...thirdPage.body.events,
    ];
    expect(firstPage.body.nextOffset).toBe(50);
    expect(secondPage.body.nextOffset).toBe(100);
    expect(thirdPage.body.nextOffset).toBeNull();
    expect(pagedEvents).toHaveLength(105);
    expect(new Set(pagedEvents.map((event: { id: number }) => event.id)).size).toBe(105);
    expect(pagedEvents[0].title).toBe("Nearby paging fixture 0");
    expect(pagedEvents.at(-1).title).toBe("Nearby paging fixture 104");

    const locationSearch = await request(app)
      .get("/api/events/hangouts/nearby")
      .set(uidHeader(OTHER_UID))
      .query({
        locationQuery: "Target",
        date: "2032-06-01",
        timePeriod: "morning",
        timeZone: "UTC",
      })
      .expect(200);
    expect(locationSearch.body.events).toHaveLength(1);
    expect(locationSearch.body.events[0].title).toBe("Nearby paging fixture 104");

    const nearest = await request(app)
      .get("/api/events/hangouts/nearby")
      .set(uidHeader(OTHER_UID))
      .query({
        latitude: 13.7563,
        longitude: 100.5018,
        limit: 5,
        date: "2032-06-01",
        timeZone: "UTC",
      })
      .expect(200);
    expect(nearest.body.events[0].title).toBe("Nearby paging fixture 0");
  });

  it("returns the complete owner-only attendee response for a community event", async () => {
    const created = await request(app)
      .post("/api/events")
      .set(uidHeader(OWNER_UID))
      .send({
        title: "Attendee response contract",
        startsAt: "2030-06-01T12:00:00.000Z",
        visibility: "public",
        inviteeUids: [],
      })
      .expect(201);
    const eventId = created.body.id as number;
    await db.insert(communityEventRsvpsTable).values({
      eventId,
      userUid: INVITEE_UID,
      status: "going",
    });
    await db.insert(eventAttendanceTable).values({
      eventType: "member",
      eventId,
      userUid: INVITEE_UID,
      checkInMethod: "manual",
      checkedInByUid: OWNER_UID,
      manualReason: "Verified at the entrance",
    });
    await db.insert(eventAttendanceCorrectionsTable).values({
      eventType: "member",
      eventId,
      userUid: INVITEE_UID,
      actorUid: OWNER_UID,
      action: "manual_check_in",
      previousMethod: null,
      reason: "Verified at the entrance",
    });

    const response = await request(app)
      .get(`/api/events/member/${eventId}/attendees`)
      .set(uidHeader(OWNER_UID));
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toMatchObject({
      attendees: [{
        uid: INVITEE_UID,
        checkInMethod: "manual",
        checkedInByUid: OWNER_UID,
        manualReason: "Verified at the entrance",
      }],
      rsvps: [{ uid: INVITEE_UID, status: "going" }],
      corrections: [{
        uid: INVITEE_UID,
        actorUid: OWNER_UID,
        action: "manual_check_in",
        reason: "Verified at the entrance",
      }],
      notificationRuns: [],
    });

    await request(app)
      .get(`/api/events/member/${eventId}/attendees`)
      .set(uidHeader(OTHER_UID))
      .expect(404);
  });

  it("requires host approval before a public hangout can be joined", async () => {
    await request(app)
      .post("/api/events")
      .set(uidHeader(OWNER_UID))
      .send({
        title: "Hangout without a selected place",
        startsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        location: "Lumphini Park",
        visibility: "public",
        joinApprovalRequired: true,
        inviteeUids: [],
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe("Choose a place from the location search results.");
      });

    const created = await request(app)
      .post("/api/events")
      .set(uidHeader(OWNER_UID))
      .send({
        title: "Picnic by the lake",
        description: "Bring a snack and say hello.",
        startsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        location: "Lumphini Park",
        locationPlaceId: "hangout-test-place",
        latitude: 13.7563,
        longitude: 100.5018,
        visibility: "public",
        joinApprovalRequired: true,
        inviteeUids: [],
      })
      .expect(201);
    const eventId = created.body.id as number;
    expect(created.body).toMatchObject({
      joinApprovalRequired: true,
      myJoinRequestStatus: null,
    });
    await request(app)
      .get(`/api/community-events/${eventId}/manage`)
      .set(uidHeader(OWNER_UID))
      .expect(200)
      .expect(({ body }) => {
        expect(body.joinApprovalRequired).toBe(true);
      });

    await request(app)
      .put(`/api/community-events/${eventId}`)
      .set(uidHeader(OWNER_UID))
      .send({
        title: "Private version",
        startsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        visibility: "invite_only",
        inviteeUids: [INVITEE_UID],
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe("Hangout plans must remain public.");
      });

    await request(app)
      .post(`/api/community-events/${eventId}/rsvp`)
      .set(uidHeader(OTHER_UID))
      .send({ status: "going" })
      .expect(403);

    const joinRequest = await request(app)
      .post(`/api/community-events/${eventId}/join-requests`)
      .set(uidHeader(OTHER_UID))
      .expect(201);
    expect(joinRequest.body).toMatchObject({ success: true, status: "pending" });
    const requestId = joinRequest.body.requestId as number;

    await request(app)
      .post(`/api/community-events/${eventId}/join-requests`)
      .set(uidHeader(OTHER_UID))
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ requestId, status: "pending" });
      });

    const requesterFeed = await request(app)
      .get("/api/events/feed")
      .set(uidHeader(OTHER_UID))
      .expect(200);
    expect(requesterFeed.body.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: eventId,
          joinApprovalRequired: true,
          myJoinRequestStatus: "pending",
        }),
      ]),
    );

    await request(app)
      .get(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OTHER_UID))
      .expect(404);
    await request(app)
      .post(`/api/events/member/${eventId}/check-in/location`)
      .set(uidHeader(OTHER_UID))
      .send({ latitude: 13.7563, longitude: 100.5018, accuracy: 10 })
      .expect(403);
    const pendingAttendance = await db
      .select()
      .from(eventAttendanceTable)
      .where(and(
        eq(eventAttendanceTable.eventId, eventId),
        eq(eventAttendanceTable.userUid, OTHER_UID),
      ));
    expect(pendingAttendance).toHaveLength(0);
    const hostRequests = await request(app)
      .get(`/api/events/member/${eventId}/attendees`)
      .set(uidHeader(OWNER_UID))
      .expect(200);
    expect(hostRequests.body.joinRequests).toEqual([
      expect.objectContaining({
        id: requestId,
        uid: OTHER_UID,
        displayName: "Other Guest",
        status: "pending",
      }),
    ]);

    await request(app)
      .patch(`/api/community-events/${eventId}/join-requests/${requestId}`)
      .set(uidHeader(OTHER_UID))
      .send({ status: "accepted" })
      .expect(403);
    await request(app)
      .patch(`/api/community-events/${eventId}/join-requests/${requestId}`)
      .set(uidHeader(OWNER_UID))
      .send({ status: "accepted" })
      .expect(200);

    const [acceptedRsvp] = await db
      .select()
      .from(communityEventRsvpsTable)
      .where(and(
        eq(communityEventRsvpsTable.eventId, eventId),
        eq(communityEventRsvpsTable.userUid, OTHER_UID),
      ))
      .limit(1);
    expect(acceptedRsvp?.status).toBe("going");

    const acceptedDetails = await request(app)
      .get(`/api/events/member/${eventId}`)
      .set(uidHeader(OTHER_UID))
      .expect(200);
    expect(acceptedDetails.body).toMatchObject({
      myJoinRequestStatus: "accepted",
      myRsvp: "going",
    });
    await request(app)
      .get(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OTHER_UID))
      .expect(200);
    await request(app)
      .delete(`/api/community-events/${eventId}/join-requests`)
      .set(uidHeader(OTHER_UID))
      .expect(409);
  });

  it("sends one host alert per new request and updates requesters on decisions", async () => {
    await db.update(profilesTable)
      .set({ pushToken: "owner-token" })
      .where(eq(profilesTable.uid, OWNER_UID));
    await db.update(profilesTable)
      .set({ pushToken: "other-token" })
      .where(eq(profilesTable.uid, OTHER_UID));
    await db.update(profilesTable)
      .set({ pushToken: "invitee-token" })
      .where(eq(profilesTable.uid, INVITEE_UID));
    mockSendPushWithStatus.mockClear();

    try {
      const created = await request(app)
        .post("/api/events")
        .set(uidHeader(OWNER_UID))
        .send({
          title: "Notification test hangout",
          startsAt: new Date(Date.now() + 86_400_000).toISOString(),
          location: "Lumphini Park",
          locationPlaceId: "notification-test-place",
          latitude: 13.7563,
          longitude: 100.5018,
          visibility: "public",
          joinApprovalRequired: true,
          inviteeUids: [],
        })
        .expect(201);
      const eventId = created.body.id as number;

      const otherRequest = await request(app)
        .post(`/api/community-events/${eventId}/join-requests`)
        .set(uidHeader(OTHER_UID))
        .expect(201);
      const inviteeRequest = await request(app)
        .post(`/api/community-events/${eventId}/join-requests`)
        .set(uidHeader(INVITEE_UID))
        .expect(201);

      expect(mockSendPushWithStatus).toHaveBeenCalledTimes(2);
      expect(mockSendPushWithStatus).toHaveBeenNthCalledWith(1, "owner-token", {
        title: "New hangout join request",
        body: "Other Guest asked to join your plan. Open Met to review.",
        data: {
          type: "hangout_join_request",
          eventId: String(eventId),
          eventType: "member",
        },
      });

      await request(app)
        .post(`/api/community-events/${eventId}/join-requests`)
        .set(uidHeader(OTHER_UID))
        .expect(200);
      expect(mockSendPushWithStatus).toHaveBeenCalledTimes(2);

      await request(app)
        .patch(`/api/community-events/${eventId}/join-requests/${otherRequest.body.requestId}`)
        .set(uidHeader(OWNER_UID))
        .send({ status: "accepted" })
        .expect(200);
      await request(app)
        .patch(`/api/community-events/${eventId}/join-requests/${otherRequest.body.requestId}`)
        .set(uidHeader(OWNER_UID))
        .send({ status: "accepted" })
        .expect(200);
      expect(mockSendPushWithStatus).toHaveBeenCalledTimes(3);
      await request(app)
        .patch(`/api/community-events/${eventId}/join-requests/${inviteeRequest.body.requestId}`)
        .set(uidHeader(OWNER_UID))
        .send({ status: "declined" })
        .expect(200);

      expect(mockSendPushWithStatus).toHaveBeenCalledTimes(4);
      expect(mockSendPushWithStatus).toHaveBeenNthCalledWith(3, "other-token", {
        title: "Your hangout request was accepted",
        body: "You can now join the hangout. Open Met for details.",
        data: {
          type: "hangout_join_decision",
          eventId: String(eventId),
          eventType: "member",
          requestStatus: "accepted",
        },
      });
      expect(mockSendPushWithStatus).toHaveBeenNthCalledWith(4, "invitee-token", {
        title: "Your hangout request was declined",
        body: "Open Met to explore other hangouts.",
        data: {
          type: "hangout_join_decision",
          eventId: String(eventId),
          eventType: "member",
          requestStatus: "declined",
        },
      });

      await request(app)
        .post(`/api/community-events/${eventId}/join-requests`)
        .set(uidHeader(INVITEE_UID))
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            requestId: inviteeRequest.body.requestId,
            status: "pending",
          });
        });
      await request(app)
        .post(`/api/community-events/${eventId}/join-requests`)
        .set(uidHeader(INVITEE_UID))
        .expect(200);
      expect(mockSendPushWithStatus).toHaveBeenCalledTimes(5);
      expect(mockSendPushWithStatus).toHaveBeenNthCalledWith(5, "owner-token", {
        title: "New hangout join request",
        body: "Event Invitee asked to join your plan. Open Met to review.",
        data: {
          type: "hangout_join_request",
          eventId: String(eventId),
          eventType: "member",
        },
      });
    } finally {
      await db.update(profilesTable)
        .set({ pushToken: null })
        .where(inArray(profilesTable.uid, [OWNER_UID, OTHER_UID, INVITEE_UID]));
      mockSendPushWithStatus.mockClear();
    }
  });

  it("sends only one host alert for simultaneous requests from the same member", async () => {
    await db.update(profilesTable)
      .set({ pushToken: "owner-token", notificationPrefs: null })
      .where(eq(profilesTable.uid, OWNER_UID));
    mockSendPushWithStatus.mockClear();

    try {
      const created = await request(app)
        .post("/api/events")
        .set(uidHeader(OWNER_UID))
        .send({
          title: "Concurrent request test",
          startsAt: new Date(Date.now() + 86_400_000).toISOString(),
          location: "Lumphini Park",
          locationPlaceId: "same-member-concurrent-place",
          latitude: 13.7563,
          longitude: 100.5018,
          visibility: "public",
          joinApprovalRequired: true,
          inviteeUids: [],
        })
        .expect(201);
      const eventId = created.body.id as number;
      const submitRequest = () =>
        request(app)
          .post(`/api/community-events/${eventId}/join-requests`)
          .set(uidHeader(OTHER_UID));

      const [first, second] = await Promise.all([
        submitRequest(),
        submitRequest(),
      ]);

      expect([first.status, second.status].sort()).toEqual([200, 201]);
      expect(first.body).toMatchObject({ success: true, status: "pending" });
      expect(second.body).toMatchObject({ success: true, status: "pending" });
      expect(first.body.requestId).toBe(second.body.requestId);

      const records = await db
        .select()
        .from(communityEventJoinRequestsTable)
        .where(and(
          eq(communityEventJoinRequestsTable.eventId, eventId),
          eq(communityEventJoinRequestsTable.userUid, OTHER_UID),
        ));
      expect(records).toHaveLength(1);
      expect(records[0]?.status).toBe("pending");

      expect(mockSendPushWithStatus).toHaveBeenCalledTimes(1);
      expect(mockSendPushWithStatus).toHaveBeenCalledWith("owner-token", {
        title: "New hangout join request",
        body: "Other Guest asked to join your plan. Open Met to review.",
        data: {
          type: "hangout_join_request",
          eventId: String(eventId),
          eventType: "member",
        },
      });
    } finally {
      await db.update(profilesTable)
        .set({ pushToken: null, notificationPrefs: null })
        .where(eq(profilesTable.uid, OWNER_UID));
      mockSendPushWithStatus.mockClear();
    }
  });

  it("sends one host alert for each simultaneous request from different members", async () => {
    await db.update(profilesTable)
      .set({ pushToken: "owner-token", notificationPrefs: null })
      .where(eq(profilesTable.uid, OWNER_UID));
    mockSendPushWithStatus.mockClear();

    try {
      const created = await request(app)
        .post("/api/events")
        .set(uidHeader(OWNER_UID))
        .send({
          title: "Concurrent member requests test",
          startsAt: new Date(Date.now() + 86_400_000).toISOString(),
          location: "Lumphini Park",
          locationPlaceId: "different-member-concurrent-place",
          latitude: 13.7563,
          longitude: 100.5018,
          visibility: "public",
          joinApprovalRequired: true,
          inviteeUids: [],
        })
        .expect(201);
      const eventId = created.body.id as number;
      const submitRequest = (uid: string) =>
        request(app)
          .post(`/api/community-events/${eventId}/join-requests`)
          .set(uidHeader(uid));

      const [otherResponse, inviteeResponse] = await Promise.all([
        submitRequest(OTHER_UID),
        submitRequest(INVITEE_UID),
      ]);

      expect(otherResponse.status).toBe(201);
      expect(inviteeResponse.status).toBe(201);
      expect(otherResponse.body).toMatchObject({ success: true, status: "pending" });
      expect(inviteeResponse.body).toMatchObject({ success: true, status: "pending" });
      expect(otherResponse.body.requestId).not.toBe(inviteeResponse.body.requestId);

      const records = await db
        .select()
        .from(communityEventJoinRequestsTable)
        .where(and(
          eq(communityEventJoinRequestsTable.eventId, eventId),
          inArray(communityEventJoinRequestsTable.userUid, [OTHER_UID, INVITEE_UID]),
        ));
      expect(records).toHaveLength(2);
      expect(records).toEqual(expect.arrayContaining([
        expect.objectContaining({ userUid: OTHER_UID, status: "pending" }),
        expect.objectContaining({ userUid: INVITEE_UID, status: "pending" }),
      ]));

      const hostAlert = {
        title: "New hangout join request",
        body: "Someone asked to join your plan. Open Met to review.",
        data: {
          type: "hangout_join_request",
          eventId: String(eventId),
          eventType: "member",
        },
      };
      expect(mockSendPushWithStatus).toHaveBeenCalledTimes(2);
      expect(mockSendPushWithStatus).toHaveBeenCalledWith("owner-token", {
        ...hostAlert,
        body: "Other Guest asked to join your plan. Open Met to review.",
      });
      expect(mockSendPushWithStatus).toHaveBeenCalledWith("owner-token", {
        ...hostAlert,
        body: "Event Invitee asked to join your plan. Open Met to review.",
      });
    } finally {
      await db.update(profilesTable)
        .set({ pushToken: null, notificationPrefs: null })
        .where(eq(profilesTable.uid, OWNER_UID));
      mockSendPushWithStatus.mockClear();
    }
  });

  it("alerts accepted guests when their hangout changes or is cancelled", async () => {
    await db.update(profilesTable)
      .set({ pushToken: "other-token", notificationPrefs: null })
      .where(eq(profilesTable.uid, OTHER_UID));
    mockSendPushWithStatus.mockClear();

    try {
      const startsAt = new Date(Date.now() + 86_400_000);
      const created = await request(app)
        .post("/api/events")
        .set(uidHeader(OWNER_UID))
        .send({
          title: "Hangout update notification test",
          startsAt: startsAt.toISOString(),
          location: "Lumphini Park",
          locationPlaceId: "hangout-change-notification-place",
          latitude: 13.7563,
          longitude: 100.5018,
          visibility: "public",
          joinApprovalRequired: true,
          inviteeUids: [],
        })
        .expect(201);
      const eventId = created.body.id as number;
      const joinRequest = await request(app)
        .post(`/api/community-events/${eventId}/join-requests`)
        .set(uidHeader(OTHER_UID))
        .expect(201);
      await request(app)
        .patch(`/api/community-events/${eventId}/join-requests/${joinRequest.body.requestId}`)
        .set(uidHeader(OWNER_UID))
        .send({ status: "accepted" })
        .expect(200);
      mockSendPushWithStatus.mockClear();

      await request(app)
        .put(`/api/community-events/${eventId}`)
        .set(uidHeader(OWNER_UID))
        .send({
          title: "Updated hangout notification test",
          startsAt: startsAt.toISOString(),
          location: "Lumphini Park",
          locationPlaceId: "hangout-change-notification-place",
          latitude: 13.7563,
          longitude: 100.5018,
          visibility: "public",
          inviteeUids: [],
        })
        .expect(200);
      expect(mockSendPushWithStatus).toHaveBeenCalledTimes(1);
      expect(mockSendPushWithStatus).toHaveBeenCalledWith("other-token", {
        title: "Hangout plan updated",
        body: "A hangout you joined has changed. Open Met for details.",
        data: {
          type: "hangout_updated",
          eventId: String(eventId),
          eventType: "member",
        },
      });

      mockSendPushWithStatus.mockClear();
      await request(app)
        .delete(`/api/community-events/${eventId}`)
        .set(uidHeader(OWNER_UID))
        .expect(204);
      expect(mockSendPushWithStatus).toHaveBeenCalledTimes(1);
      expect(mockSendPushWithStatus).toHaveBeenCalledWith("other-token", {
        title: "Hangout plan cancelled",
        body: "A hangout you joined was cancelled. Open Met to see your plans.",
        data: {
          type: "hangout_cancelled",
          eventId: String(eventId),
          eventType: "member",
        },
      });
    } finally {
      await db.update(profilesTable)
        .set({ pushToken: null, notificationPrefs: null })
        .where(eq(profilesTable.uid, OTHER_UID));
      mockSendPushWithStatus.mockClear();
    }
  });

  it("respects disabled event-update preferences for hosts and requesters", async () => {
    await db.update(profilesTable)
      .set({
        pushToken: "owner-token",
        notificationPrefs: { notifyEventUpdates: false },
      })
      .where(eq(profilesTable.uid, OWNER_UID));
    await db.update(profilesTable)
      .set({
        pushToken: "other-token",
        notificationPrefs: { notifyEventUpdates: false },
      })
      .where(eq(profilesTable.uid, OTHER_UID));
    mockSendPushWithStatus.mockClear();

    try {
      const created = await request(app)
        .post("/api/events")
        .set(uidHeader(OWNER_UID))
        .send({
          title: "Quiet hangout notifications",
          startsAt: new Date(Date.now() + 86_400_000).toISOString(),
          location: "Lumphini Park",
          locationPlaceId: "quiet-notifications-place",
          latitude: 13.7563,
          longitude: 100.5018,
          visibility: "public",
          joinApprovalRequired: true,
          inviteeUids: [],
        })
        .expect(201);
      const eventId = created.body.id as number;
      const joinRequest = await request(app)
        .post(`/api/community-events/${eventId}/join-requests`)
        .set(uidHeader(OTHER_UID))
        .expect(201);
      expect(mockSendPushWithStatus).not.toHaveBeenCalled();

      await request(app)
        .patch(`/api/community-events/${eventId}/join-requests/${joinRequest.body.requestId}`)
        .set(uidHeader(OWNER_UID))
        .send({ status: "accepted" })
        .expect(200);
      expect(mockSendPushWithStatus).not.toHaveBeenCalled();

      const [savedRequest] = await db
        .select()
        .from(communityEventJoinRequestsTable)
        .where(eq(communityEventJoinRequestsTable.id, joinRequest.body.requestId));
      const [savedRsvp] = await db
        .select()
        .from(communityEventRsvpsTable)
        .where(and(
          eq(communityEventRsvpsTable.eventId, eventId),
          eq(communityEventRsvpsTable.userUid, OTHER_UID),
        ));
      expect(savedRequest?.status).toBe("accepted");
      expect(savedRsvp?.status).toBe("going");
    } finally {
      await db.update(profilesTable)
        .set({ pushToken: null, notificationPrefs: null })
        .where(inArray(profilesTable.uid, [OWNER_UID, OTHER_UID]));
      mockSendPushWithStatus.mockClear();
    }
  });

  it("saves join requests and decisions when recipients have no push token", async () => {
    await db.update(profilesTable)
      .set({ pushToken: null, notificationPrefs: null })
      .where(inArray(profilesTable.uid, [OWNER_UID, OTHER_UID]));
    mockSendPushWithStatus.mockClear();

    const created = await request(app)
      .post("/api/events")
      .set(uidHeader(OWNER_UID))
      .send({
        title: "Hangout without push tokens",
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        location: "Lumphini Park",
        locationPlaceId: "no-push-token-place",
        latitude: 13.7563,
        longitude: 100.5018,
        visibility: "public",
        joinApprovalRequired: true,
        inviteeUids: [],
      })
      .expect(201);
    const eventId = created.body.id as number;
    const joinRequest = await request(app)
      .post(`/api/community-events/${eventId}/join-requests`)
      .set(uidHeader(OTHER_UID))
      .expect(201);
    expect(mockSendPushWithStatus).not.toHaveBeenCalled();

    await request(app)
      .patch(`/api/community-events/${eventId}/join-requests/${joinRequest.body.requestId}`)
      .set(uidHeader(OWNER_UID))
      .send({ status: "accepted" })
      .expect(200);
    expect(mockSendPushWithStatus).not.toHaveBeenCalled();

    const [savedRequest] = await db
      .select()
      .from(communityEventJoinRequestsTable)
      .where(eq(communityEventJoinRequestsTable.id, joinRequest.body.requestId));
    const [savedRsvp] = await db
      .select()
      .from(communityEventRsvpsTable)
      .where(and(
        eq(communityEventRsvpsTable.eventId, eventId),
        eq(communityEventRsvpsTable.userUid, OTHER_UID),
      ));
    expect(savedRequest?.status).toBe("accepted");
    expect(savedRsvp?.status).toBe("going");
  });

  it("keeps invitees private and restricts management to the event owner", async () => {
    const eventBody = {
      title: "Private community gathering",
      description: "An invite-only test event",
      imageUrl: "https://example.com/community-event.jpg",
      contactPhone: "+1 555 123 4567",
      websiteUrl: "https://example.com/event",
      publicEmail: "events@example.com",
      startsAt: "2030-06-01T12:00:00.000Z",
      endsAt: "2030-06-01T14:00:00.000Z",
      visibility: "invite_only",
      inviteeUids: [INVITEE_UID],
    };

    const created = await request(app)
      .post("/api/events")
      .set(uidHeader(OWNER_UID))
      .send(eventBody)
      .expect(201);
    const eventId = created.body.id as number;

    const ownerManageResponse = await request(app)
      .get(`/api/community-events/${eventId}/manage`)
      .set(uidHeader(OWNER_UID))
      .expect(200);
    expect(ownerManageResponse.body.inviteeUids).toEqual([INVITEE_UID]);
    expect(ownerManageResponse.body).toMatchObject({
      imageUrl: eventBody.imageUrl,
      contactPhone: eventBody.contactPhone,
      websiteUrl: eventBody.websiteUrl,
      publicEmail: eventBody.publicEmail,
    });

    await request(app)
      .get(`/api/events/member/${eventId}`)
      .set(uidHeader(OTHER_UID))
      .expect(404);

    const inviteeDetails = await request(app)
      .get(`/api/events/member/${eventId}`)
      .set(uidHeader(INVITEE_UID))
      .expect(200);
    expect(inviteeDetails.body.title).toBe(eventBody.title);
    expect(inviteeDetails.body).not.toHaveProperty("inviteeUids");
    expect(inviteeDetails.body).toMatchObject({
      imageUrl: eventBody.imageUrl,
      contactPhone: eventBody.contactPhone,
      websiteUrl: eventBody.websiteUrl,
      publicEmail: eventBody.publicEmail,
    });

    const changedBody = {
      ...eventBody,
      title: "Unauthorized edit",
    };
    await request(app)
      .put(`/api/community-events/${eventId}`)
      .set(uidHeader(OTHER_UID))
      .send(changedBody)
      .expect(404);

    await request(app)
      .delete(`/api/community-events/${eventId}`)
      .set(uidHeader(OTHER_UID))
      .expect(404);

    const unchanged = await request(app)
      .get(`/api/community-events/${eventId}/manage`)
      .set(uidHeader(OWNER_UID))
      .expect(200);
    expect(unchanged.body.title).toBe(eventBody.title);

    const updated = await request(app)
      .put(`/api/community-events/${eventId}`)
      .set(uidHeader(OWNER_UID))
      .send({
        ...eventBody,
        title: "Updated community gathering",
        contactPhone: "+1 555 765 4321",
        websiteUrl: "https://example.com/updated",
        publicEmail: "updated@example.com",
      })
      .expect(200);
    expect(updated.body.title).toBe("Updated community gathering");
    expect(updated.body).toMatchObject({
      contactPhone: "+1 555 765 4321",
      websiteUrl: "https://example.com/updated",
      publicEmail: "updated@example.com",
    });

    await request(app)
      .delete(`/api/community-events/${eventId}`)
      .set(uidHeader(OWNER_UID))
      .expect(204);
    await request(app)
      .get(`/api/community-events/${eventId}/manage`)
      .set(uidHeader(OWNER_UID))
      .expect(404);
  });

  it("shares passcode-protected invite links and grants event access after RSVP", async () => {
    const eventBody = {
      title: "Invite link gathering",
      description: "A private event shared by link",
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      endsAt: null,
      location: null,
      locationPlaceId: null,
      latitude: null,
      longitude: null,
      visibility: "invite_only",
      inviteeUids: [],
      inviteLinkEnabled: true,
      invitePasscode: "frosty7",
    };

    const created = await request(app)
      .post("/api/events")
      .set(uidHeader(OWNER_UID))
      .send(eventBody)
      .expect(201);
    const eventId = created.body.id as number;

    const [storedEvent] = await db
      .select()
      .from(communityEventsTable)
      .where(eq(communityEventsTable.id, eventId))
      .limit(1);
    expect(storedEvent?.invitePasscodeHash).toBeTruthy();
    expect(storedEvent?.invitePasscodeHash).not.toBe(eventBody.invitePasscode);
    expect(storedEvent?.invitePasscodeSalt).toBeTruthy();
    expect(storedEvent?.inviteTokenHash).toBeTruthy();
    expect(storedEvent?.inviteTokenEncrypted).toBeTruthy();
    expect(storedEvent?.inviteTokenEncrypted).not.toContain("frosty7");

    const ownerManageResponse = await request(app)
      .get(`/api/community-events/${eventId}/manage`)
      .set(uidHeader(OWNER_UID))
      .expect(200);
    expect(ownerManageResponse.body).toMatchObject({
      inviteLinkEnabled: true,
      invitePasscodeRequired: true,
    });
    expect(ownerManageResponse.body).not.toHaveProperty("inviteTokenHash");
    expect(ownerManageResponse.body).not.toHaveProperty("invitePasscodeHash");

    const sharedLink = await request(app)
      .post(`/api/community-events/${eventId}/invite-link`)
      .set(uidHeader(OWNER_UID))
      .expect(200);
    expect(sharedLink.body.passcodeRequired).toBe(true);
    const token = new URL(sharedLink.body.url as string).pathname.split("/").pop()!;

    await request(app)
      .post("/api/event-invites/resolve")
      .send({ token })
      .expect(200, { requiresPasscode: true, event: null });
    await request(app)
      .post("/api/event-invites/resolve")
      .send({ token, passcode: "wrong-passcode" })
      .expect(401);

    const resolved = await request(app)
      .post("/api/event-invites/resolve")
      .send({ token, passcode: "frosty7" })
      .expect(200);
    expect(resolved.body).toMatchObject({
      requiresPasscode: true,
      event: {
        id: eventId,
        title: eventBody.title,
        rsvpCount: 0,
      },
    });
    expect(resolved.body.event).not.toHaveProperty("ownerUid");
    expect(resolved.body.event).not.toHaveProperty("inviteeUids");
    expect(resolved.body.event).not.toHaveProperty("inviteTokenHash");

    await request(app)
      .get(`/api/events/member/${eventId}`)
      .set(uidHeader(OTHER_UID))
      .expect(404);

    await request(app)
      .post("/api/event-invites/rsvp")
      .set(uidHeader(OTHER_UID))
      .send({ token, status: "going", passcode: "frosty7" })
      .expect(200, { success: true, status: "going" });

    const recipientDetails = await request(app)
      .get(`/api/events/member/${eventId}`)
      .set(uidHeader(OTHER_UID))
      .expect(200);
    expect(recipientDetails.body.myRsvp).toBe("going");

    const feed = await request(app)
      .get("/api/events/feed")
      .set(uidHeader(OTHER_UID))
      .expect(200);
    expect(feed.body.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "member", id: eventId }),
      ]),
    );

    await request(app)
      .put(`/api/community-events/${eventId}`)
      .set(uidHeader(OWNER_UID))
      .send({
        ...eventBody,
        inviteeUids: [INVITEE_UID],
        inviteLinkEnabled: false,
        invitePasscode: null,
      })
      .expect(200);
    const revokedInviteResponse = await request(app)
      .post("/api/event-invites/resolve")
      .send({ token, passcode: "frosty7" })
      .expect(404);
    expect(revokedInviteResponse.body).toEqual({
      message: "Invitation not found.",
    });
  });

  it("returns a generic unavailable response after an event is removed", async () => {
    const created = await request(app)
      .post("/api/events")
      .set(uidHeader(OWNER_UID))
      .send({
        title: "Removed event invitation",
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        visibility: "invite_only",
        inviteeUids: [],
        inviteLinkEnabled: true,
      })
      .expect(201);
    const eventId = created.body.id as number;

    const sharedLink = await request(app)
      .post(`/api/community-events/${eventId}/invite-link`)
      .set(uidHeader(OWNER_UID))
      .expect(200);
    const token = new URL(sharedLink.body.url as string).pathname.split("/").pop()!;

    await request(app)
      .delete(`/api/community-events/${eventId}`)
      .set(uidHeader(OWNER_UID))
      .expect(204);

    const response = await request(app)
      .post("/api/event-invites/resolve")
      .send({ token })
      .expect(404);
    expect(response.body).toEqual({ message: "Invitation not found." });
  });

  it("lets guests share and report public community events", async () => {
    const eventBody = {
      title: "Open community gathering",
      description: "A public event for sharing",
      startsAt: "2030-06-02T12:00:00.000Z",
      visibility: "public",
      inviteeUids: [],
    };
    const created = await request(app)
      .post("/api/events")
      .set(uidHeader(OWNER_UID))
      .send(eventBody)
      .expect(201);
    const eventId = created.body.id as number;

    const sharedLink = await request(app)
      .post(`/api/community-events/${eventId}/invite-link`)
      .set(uidHeader(OTHER_UID))
      .expect(200);
    expect(sharedLink.body.passcodeRequired).toBe(false);
    const token = new URL(sharedLink.body.url as string).pathname.split("/").pop()!;
    const resolved = await request(app)
      .post("/api/event-invites/resolve")
      .send({ token })
      .expect(200);
    expect(resolved.body).toMatchObject({
      requiresPasscode: false,
      event: { id: eventId, title: eventBody.title },
    });

    await request(app)
      .post("/api/community-event-reports")
      .set(uidHeader(OTHER_UID))
      .send({ eventId, reason: "spam" })
      .expect(201);
    const [report] = await db
      .select()
      .from(venueContentReportsTable)
      .where(and(
        eq(venueContentReportsTable.entityType, "community_event"),
        eq(venueContentReportsTable.entityId, eventId),
        eq(venueContentReportsTable.reporterUid, OTHER_UID),
      ))
      .limit(1);
    expect(report).toMatchObject({
      entityType: "community_event",
      entityId: eventId,
      placeId: "community-events",
      reason: "spam",
    });
  });

  it("shares plan conversations only with hosts and invited or attending members", async () => {
    mockSendPushWithStatus.mockClear();
    const created = await request(app)
      .post("/api/events")
      .set(uidHeader(OWNER_UID))
      .send({
        title: "Dinner with friends",
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        visibility: "invite_only",
        inviteeUids: [INVITEE_UID, MUTED_UID],
      })
      .expect(201);
    const eventId = created.body.id as number;

    const initialChat = await request(app)
      .get(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OWNER_UID))
      .expect(200);
    expect(initialChat.body.event).toMatchObject({
      id: eventId,
      title: "Dinner with friends",
    });
    expect(initialChat.body.notificationsMuted).toBe(false);
    expect(initialChat.body.participants).toEqual([
      expect.objectContaining({ uid: OWNER_UID, status: "host" }),
    ]);

    const inviteeFeed = await request(app)
      .get("/api/events/feed")
      .set(uidHeader(INVITEE_UID))
      .expect(200);
    expect(inviteeFeed.body.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "member",
          id: eventId,
          isInvited: true,
          myRsvp: null,
        }),
      ]),
    );
    const inviteeDetails = await request(app)
      .get(`/api/events/member/${eventId}`)
      .set(uidHeader(INVITEE_UID))
      .expect(200);
    expect(inviteeDetails.body).toMatchObject({
      id: eventId,
      isInvited: true,
      myRsvp: null,
    });
    const invitedChat = await request(app)
      .get(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(INVITEE_UID))
      .expect(200);
    expect(invitedChat.body.event.id).toBe(eventId);

    await request(app)
      .get(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OTHER_UID))
      .expect(404);
    await request(app)
      .post(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OTHER_UID))
      .send({ text: "I should not see this" })
      .expect(404);

    await request(app)
      .post(`/api/community-events/${eventId}/rsvp`)
      .set(uidHeader(INVITEE_UID))
      .send({ status: "going" })
      .expect(200);
    await request(app)
      .post(`/api/community-events/${eventId}/rsvp`)
      .set(uidHeader(MUTED_UID))
      .send({ status: "maybe" })
      .expect(200);
    await db
      .update(profilesTable)
      .set({
        pushToken: "owner-token",
        notificationPrefs: { notifyChat: true },
      })
      .where(eq(profilesTable.uid, OWNER_UID));
    await db
      .update(profilesTable)
      .set({
        pushToken: "invitee-token",
        notificationPrefs: { notifyChat: true },
      })
      .where(eq(profilesTable.uid, INVITEE_UID));
    await db
      .update(profilesTable)
      .set({
        pushToken: "muted-token",
        notificationPrefs: { notifyChat: false },
      })
      .where(eq(profilesTable.uid, MUTED_UID));

    const ownerMessage = await request(app)
      .post(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OWNER_UID))
      .send({ text: "Let's meet at 7." })
      .expect(201);
    expect(ownerMessage.body.message).toMatchObject({
      senderUid: OWNER_UID,
      senderName: "Event Owner",
      text: "Let's meet at 7.",
    });
    expect(mockSendPushWithStatus).toHaveBeenCalledTimes(1);
    expect(mockSendPushWithStatus).toHaveBeenCalledWith("invitee-token", {
      title: "New message in your plan",
      body: "Open Met to view the conversation.",
      data: {
        type: "event_plan_message",
        eventId: String(eventId),
        eventType: "member",
      },
    });
    expect(JSON.stringify(mockSendPushWithStatus.mock.calls[0]?.[1])).not.toContain(
      "Let's meet at 7.",
    );
    expect(JSON.stringify(mockSendPushWithStatus.mock.calls[0]?.[1])).not.toContain(
      "Dinner with friends",
    );

    mockSendPushWithStatus.mockClear();
    await request(app)
      .post(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(INVITEE_UID))
      .send({ text: "Sounds good." })
      .expect(201);
    expect(mockSendPushWithStatus).toHaveBeenCalledTimes(1);
    expect(mockSendPushWithStatus).toHaveBeenCalledWith("owner-token", {
      title: "New message in your plan",
      body: "Open Met to view the conversation.",
      data: {
        type: "event_plan_message",
        eventId: String(eventId),
        eventType: "member",
      },
    });

    await request(app)
      .put(`/api/community-events/${eventId}/plan-chat/notifications`)
      .set(uidHeader(INVITEE_UID))
      .send({ muted: true })
      .expect(200, { muted: true });
    const mutedChat = await request(app)
      .get(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(INVITEE_UID))
      .expect(200);
    expect(mutedChat.body.notificationsMuted).toBe(true);
    const [inviteePrefsAfterMute] = await db
      .select({ notificationPrefs: profilesTable.notificationPrefs })
      .from(profilesTable)
      .where(eq(profilesTable.uid, INVITEE_UID))
      .limit(1);
    expect(inviteePrefsAfterMute?.notificationPrefs?.notifyChat).toBe(true);

    const secondPlanCreated = await request(app)
      .post("/api/events")
      .set(uidHeader(OWNER_UID))
      .send({
        title: "Coffee with friends",
        startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        visibility: "public",
        inviteeUids: [],
      })
      .expect(201);
    const secondEventId = secondPlanCreated.body.id as number;
    await request(app)
      .post(`/api/community-events/${secondEventId}/rsvp`)
      .set(uidHeader(INVITEE_UID))
      .send({ status: "going" })
      .expect(200);
    const secondPlanChat = await request(app)
      .get(`/api/community-events/${secondEventId}/plan-chat`)
      .set(uidHeader(INVITEE_UID))
      .expect(200);
    expect(secondPlanChat.body.notificationsMuted).toBe(false);

    mockSendPushWithStatus.mockClear();
    await request(app)
      .post(`/api/community-events/${secondEventId}/plan-chat`)
      .set(uidHeader(OWNER_UID))
      .send({ text: "The other plan still sends alerts." })
      .expect(201);
    expect(mockSendPushWithStatus).toHaveBeenCalledTimes(1);
    expect(mockSendPushWithStatus).toHaveBeenCalledWith("invitee-token", {
      title: "New message in your plan",
      body: "Open Met to view the conversation.",
      data: {
        type: "event_plan_message",
        eventId: String(secondEventId),
        eventType: "member",
      },
    });

    await request(app)
      .put(`/api/community-events/${eventId}/plan-chat/notifications`)
      .set(uidHeader(OTHER_UID))
      .send({ muted: true })
      .expect(404);

    mockSendPushWithStatus.mockClear();
    await request(app)
      .post(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OWNER_UID))
      .send({ text: "One plan is quiet now." })
      .expect(201);
    expect(mockSendPushWithStatus).not.toHaveBeenCalled();

    await request(app)
      .put(`/api/community-events/${eventId}/plan-chat/notifications`)
      .set(uidHeader(INVITEE_UID))
      .send({ muted: false })
      .expect(200, { muted: false });
    const unmutedChat = await request(app)
      .get(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(INVITEE_UID))
      .expect(200);
    expect(unmutedChat.body.notificationsMuted).toBe(false);

    mockSendPushWithStatus.mockClear();
    await request(app)
      .post(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OWNER_UID))
      .send({ text: "Alerts are back for this plan." })
      .expect(201);
    expect(mockSendPushWithStatus).toHaveBeenCalledTimes(1);
    expect(mockSendPushWithStatus).toHaveBeenCalledWith("invitee-token", {
      title: "New message in your plan",
      body: "Open Met to view the conversation.",
      data: {
        type: "event_plan_message",
        eventId: String(eventId),
        eventType: "member",
      },
    });

    const inviteeChat = await request(app)
      .get(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(INVITEE_UID))
      .expect(200);
    expect(inviteeChat.body.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ uid: OWNER_UID, status: "host" }),
        expect.objectContaining({ uid: INVITEE_UID, status: "going" }),
      ]),
    );
    expect(inviteeChat.body.messages.map((message: { text: string }) => message.text)).toEqual([
      "Let's meet at 7.",
      "Sounds good.",
      "One plan is quiet now.",
      "Alerts are back for this plan.",
    ]);

    await request(app)
      .post(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OWNER_UID))
      .send({ text: "   " })
      .expect(400);
    await request(app)
      .post(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OWNER_UID))
      .send({ text: "x".repeat(501) })
      .expect(400);
  });
});
