/**
 * Integration tests for hub_checkins.source behaviour introduced by task #634.
 *
 * Coverage:
 *  1. POST /api/hubs/checkin at a registered venue (no QR) inserts a row with
 *     source='proximity' — the guest appears on the leaderboard even without
 *     scanning the QR code.
 *  2. POST /api/hubs/qr-verify upgrades an existing proximity row to
 *     source='qr_verified'.
 *  3. POST /api/hubs/qr-verify inserts a fresh source='qr_verified' row when
 *     no proximity row exists within the 4-hour cooldown window.
 *  4. GET /api/venue-owner/me/guests returns qrVerifiedCount per guest,
 *     correctly reflecting proximity-only vs QR-verified visits.
 *  5. A proximity-only guest (no QR scan) appears on the leaderboard at all —
 *     the core regression guard for the original silent-exclusion bug.
 *
 * Tests skip automatically when DATABASE_URL is absent.
 * Auth: non-production X-Met-Uid header is used to bypass Firebase token
 * verification (requireUid accepts this in NODE_ENV != production).
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  communityEventRsvpsTable,
  communityEventsTable,
  db,
  hubCheckinsTable,
  venueOwnerProfilesTable,
  venueQrVerificationsTable,
  profilesTable,
  venueBusinessesTable,
  venueMembershipsTable,
  venueEventRsvpsTable,
  venueEventsTable,
  userStatsTable,
} from "@workspace/db";
import type { Express } from "express";

// ---------------------------------------------------------------------------
// Must be set before any app import so session middleware initialises.
// ---------------------------------------------------------------------------
process.env["SESSION_SECRET"] = "itest-hub-checkin-source-secret";

// ---------------------------------------------------------------------------
// Mocks — silence noisy middleware and external calls.
// ---------------------------------------------------------------------------
vi.mock("pino-http", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    level: "silent",
  },
}));

vi.mock("../middlewares/rateLimit", () => ({
  createIpRateLimiter:
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createUserRateLimiter:
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/push", () => ({ sendPush: vi.fn() }));

vi.mock("../lib/firebaseAdmin", () => ({
  adminAuth: () => ({
    verifyIdToken: vi.fn().mockRejectedValue(new Error("not used in these tests")),
  }),
  adminDb: { collection: vi.fn() },
  adminStorage: {},
}));

vi.mock("../lib/objectStorage", () => ({ ObjectStorageService: class {} }));

vi.mock("../lib/email.js", () => ({
  sendVenueApprovedEmail: vi.fn(),
  sendVenueRejectedEmail: vi.fn(),
  sendVenueChangesRequestedEmail: vi.fn(),
  sendRegistrationLinkEmail: vi.fn(),
  sendClaimLinkOverdueAlertEmail: vi.fn(),
}));

vi.mock("../lib/revenueCat", () => ({
  getVerifiedTier: vi.fn().mockResolvedValue("free"),
}));

// ---------------------------------------------------------------------------
// Google Places — stub so /hubs/checkin auto-resolves the place.
// ---------------------------------------------------------------------------
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    places: [
      {
        id: "mock-place-id-source-test",
        displayName: { text: "Source Test Venue" },
        location: { latitude: 51.5074, longitude: -0.1278 },
      },
    ],
  }),
  text: async () => "",
}) as unknown as typeof fetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const hasDatabase = Boolean(process.env["DATABASE_URL"]);

const TP = `itestsrc-${process.pid}`;
const PLACE_ID = `${TP}-place`;
const UNREGISTERED_PLACE_ID = `${TP}-unregistered`;
const OWNER_UID = `${TP}-owner`;
const GUEST_UID = `${TP}-guestA`;
const GUEST2_UID = `${TP}-guestB`;
const GUEST3_UID = `${TP}-open-guest`;
// Must be a valid UUID v4 (version=4, variant=8/9/a/b) — Zod rejects non-conforming UUIDs.
const QR_TOKEN = "12345678-1234-4321-89ab-123456789012";

/**
 * In non-production mode requireUid accepts X-Met-Uid header directly,
 * so we never need to deal with Firebase token verification.
 */
function uid(u: string) {
  return { "X-Met-Uid": u };
}

// ---------------------------------------------------------------------------
// Seed & cleanup
// ---------------------------------------------------------------------------

async function seed() {
  const [profile] = await db
    .insert(venueOwnerProfilesTable)
    .values({
      ownerUid: OWNER_UID,
      placeId: PLACE_ID,
      placeName: "Source Test Venue",
      businessName: "Source Test Venue Ltd",
      applicationStatus: "approved",
      isApproved: true,
      isVerified: true,
      qrToken: QR_TOKEN,
      lat: "51.5074",
      lng: "-0.1278",
    })
    .returning({ id: venueOwnerProfilesTable.id });

  const [business] = await db
    .insert(venueBusinessesTable)
    .values({
      venueOwnerProfileId: profile!.id,
      placeId: PLACE_ID,
      legalName: "Source Test Venue Ltd",
      createdByUid: OWNER_UID,
      isActive: true,
    })
    .returning({ id: venueBusinessesTable.id });

  await db.insert(venueMembershipsTable).values({
    businessId: business!.id,
    uid: OWNER_UID,
    role: "owner",
    status: "active",
    acceptedAt: new Date(),
  });

  // Minimal profile rows so the guests endpoint can join
  for (const u of [GUEST_UID, GUEST2_UID, GUEST3_UID, OWNER_UID]) {
    await db
      .insert(profilesTable)
      .values({ uid: u, displayName: `Test ${u}`, photoUrl: "https://example.com/test-profile.jpg" })
      .onConflictDoNothing();
  }
}

async function cleanup() {
  const communityEvents = await db
    .select({ id: communityEventsTable.id })
    .from(communityEventsTable)
    .where(eq(communityEventsTable.ownerUid, GUEST_UID));
  if (communityEvents.length) {
    await db.delete(communityEventRsvpsTable).where(
      inArray(communityEventRsvpsTable.eventId, communityEvents.map((event) => event.id)),
    );
  }
  await db.delete(communityEventsTable).where(eq(communityEventsTable.ownerUid, GUEST_UID));
  const venueEvents = await db
    .select({ id: venueEventsTable.id })
    .from(venueEventsTable)
    .where(eq(venueEventsTable.placeId, PLACE_ID));
  if (venueEvents.length) {
    await db.delete(venueEventRsvpsTable).where(
      inArray(venueEventRsvpsTable.eventId, venueEvents.map((event) => event.id)),
    );
  }
  await db.delete(venueEventsTable).where(eq(venueEventsTable.placeId, PLACE_ID));
  await db.delete(hubCheckinsTable).where(eq(hubCheckinsTable.placeId, PLACE_ID));
  await db.delete(venueQrVerificationsTable).where(eq(venueQrVerificationsTable.placeId, PLACE_ID));
  await db.delete(userStatsTable).where(inArray(userStatsTable.userUid, [GUEST_UID, GUEST2_UID, GUEST3_UID]));

  const businesses = await db
    .select({ id: venueBusinessesTable.id })
    .from(venueBusinessesTable)
    .where(eq(venueBusinessesTable.placeId, PLACE_ID));

  for (const b of businesses) {
    await db.delete(venueMembershipsTable).where(eq(venueMembershipsTable.businessId, b.id));
    await db.delete(venueBusinessesTable).where(eq(venueBusinessesTable.id, b.id));
  }

  await db.delete(venueOwnerProfilesTable).where(eq(venueOwnerProfilesTable.placeId, PLACE_ID));

  for (const u of [GUEST_UID, GUEST2_UID, GUEST3_UID, OWNER_UID]) {
    await db.delete(profilesTable).where(eq(profilesTable.uid, u));
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasDatabase)(
  "hub_checkins.source — proximity, QR, and open-location visits (real database)",
  () => {
    let app: Express;

    beforeAll(async () => {
      app = (await import("../app")).default;
      await cleanup();
      await seed();
    });

    afterAll(async () => {
      await cleanup();
    });

    // -----------------------------------------------------------------------
    // 1. Proximity insert: registered venue, no QR scan
    // -----------------------------------------------------------------------
    it("checkin at registered venue without QR inserts a row with source=proximity", async () => {
      const res = await request(app)
        .post("/api/hubs/checkin")
        .set(uid(GUEST_UID))
        .send({ lat: 51.5074, lng: -0.1278, placeId: PLACE_ID, placeName: "Source Test Venue" });

      expect(res.status).toBe(200);
      expect(res.body.isRegisteredVenue).toBe(true);
      expect(res.body.isQrVerified).toBe(false);
      // No streak points for proximity-only
      expect(res.body.streak_points).toBe(0);

      const [row] = await db
        .select({ source: hubCheckinsTable.source })
        .from(hubCheckinsTable)
        .where(
          and(
            eq(hubCheckinsTable.userUid, GUEST_UID),
            eq(hubCheckinsTable.placeId, PLACE_ID),
          ),
        )
        .orderBy(desc(hubCheckinsTable.createdAt))
        .limit(1);

      expect(row?.source).toBe("proximity");
    });

    // -----------------------------------------------------------------------
    // 2. QR verify upgrades an existing proximity row
    // -----------------------------------------------------------------------
    it("qr-verify upgrades an existing proximity row to source=qr_verified", async () => {
      // Confirm the proximity row from test #1 is in place.
      const [before] = await db
        .select({ id: hubCheckinsTable.id, source: hubCheckinsTable.source })
        .from(hubCheckinsTable)
        .where(
          and(
            eq(hubCheckinsTable.userUid, GUEST_UID),
            eq(hubCheckinsTable.placeId, PLACE_ID),
          ),
        )
        .orderBy(desc(hubCheckinsTable.createdAt))
        .limit(1);

      expect(before?.source).toBe("proximity");
      const rowId = before!.id;

      const res = await request(app)
        .post("/api/hubs/qr-verify")
        .set(uid(GUEST_UID))
        .send({ placeId: PLACE_ID, token: QR_TOKEN });

      expect(res.status).toBe(200);
      expect(res.body.verified).toBe(true);

      // The existing row must be upgraded in-place (not a new row).
      const [upgraded] = await db
        .select({ id: hubCheckinsTable.id, source: hubCheckinsTable.source })
        .from(hubCheckinsTable)
        .where(eq(hubCheckinsTable.id, rowId))
        .limit(1);

      expect(upgraded?.source).toBe("qr_verified");

      // Exactly one checkin row for this guest — no duplicate inserted.
      const allRows = await db
        .select({ id: hubCheckinsTable.id })
        .from(hubCheckinsTable)
        .where(
          and(
            eq(hubCheckinsTable.userUid, GUEST_UID),
            eq(hubCheckinsTable.placeId, PLACE_ID),
          ),
        );
      expect(allRows).toHaveLength(1);
    });

    // -----------------------------------------------------------------------
    // 3. QR verify with no prior checkin inserts source=qr_verified directly
    // -----------------------------------------------------------------------
    it("qr-verify with no prior proximity row inserts source=qr_verified directly", async () => {
      const res = await request(app)
        .post("/api/hubs/qr-verify")
        .set(uid(GUEST2_UID))
        .send({ placeId: PLACE_ID, token: QR_TOKEN });

      expect(res.status).toBe(200);
      expect(res.body.verified).toBe(true);

      const [row] = await db
        .select({ source: hubCheckinsTable.source })
        .from(hubCheckinsTable)
        .where(
          and(
            eq(hubCheckinsTable.userUid, GUEST2_UID),
            eq(hubCheckinsTable.placeId, PLACE_ID),
          ),
        )
        .orderBy(desc(hubCheckinsTable.createdAt))
        .limit(1);

      expect(row?.source).toBe("qr_verified");
    });

    // -----------------------------------------------------------------------
    // 4. Guest list: qrVerifiedCount reflects mixed history correctly
    // -----------------------------------------------------------------------
    it("GET /venue-owner/me/guests returns qrVerifiedCount per guest", async () => {
      // Insert an additional proximity row for GUEST2 to create a mixed history:
      //   GUEST_UID  → 1 qr_verified
      //   GUEST2_UID → 1 qr_verified + 1 proximity
      await db.insert(hubCheckinsTable).values({
        userUid: GUEST2_UID,
        placeId: PLACE_ID,
        source: "proximity",
      });

      const res = await request(app)
        .get("/api/venue-owner/me/guests?period=all")
        .set(uid(OWNER_UID));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.guests)).toBe(true);

      type GuestRow = { uid: string; checkinCount: number; qrVerifiedCount: number };
      const g1 = (res.body.guests as GuestRow[]).find((g) => g.uid === GUEST_UID);
      const g2 = (res.body.guests as GuestRow[]).find((g) => g.uid === GUEST2_UID);

      // GUEST_UID: 1 visit, 1 QR-verified
      expect(g1).toBeDefined();
      expect(g1!.checkinCount).toBe(1);
      expect(g1!.qrVerifiedCount).toBe(1);

      // GUEST2_UID: 2 visits, 1 QR-verified
      expect(g2).toBeDefined();
      expect(g2!.checkinCount).toBe(2);
      expect(g2!.qrVerifiedCount).toBe(1);
    });

    // -----------------------------------------------------------------------
    // 5. Proximity-only guest appears at all — core regression guard
    // -----------------------------------------------------------------------
    it("a proximity-only guest appears on the guest list with qrVerifiedCount=0", async () => {
      const PROXIMITY_UID = `${TP}-prox-only`;

      await db.insert(hubCheckinsTable).values({
        userUid: PROXIMITY_UID,
        placeId: PLACE_ID,
        source: "proximity",
      });

      try {
        const res = await request(app)
          .get("/api/venue-owner/me/guests?period=all")
          .set(uid(OWNER_UID));

        expect(res.status).toBe(200);

        type GuestRow = { uid: string; checkinCount: number; qrVerifiedCount: number };
        const guest = (res.body.guests as GuestRow[]).find((g) => g.uid === PROXIMITY_UID);

        expect(guest).toBeDefined();
        expect(guest!.checkinCount).toBe(1);
        expect(guest!.qrVerifiedCount).toBe(0);
      } finally {
        await db
          .delete(hubCheckinsTable)
          .where(eq(hubCheckinsTable.userUid, PROXIMITY_UID));
      }
    });

    it("shows complete-profile proximity visits for unregistered places, not registered QR venues", async () => {
      const privateUid = `${TP}-private-profile`;
      await db.insert(profilesTable).values({
        uid: privateUid,
        displayName: "",
        photoUrl: null,
      });
      const inserted = await db
        .insert(hubCheckinsTable)
        .values([
          { userUid: GUEST3_UID, placeId: PLACE_ID, source: "proximity" },
          { userUid: GUEST3_UID, placeId: UNREGISTERED_PLACE_ID, source: "proximity" },
          { userUid: privateUid, placeId: UNREGISTERED_PLACE_ID, source: "proximity" },
        ])
        .returning({ id: hubCheckinsTable.id });

      try {
        const registered = await request(app)
          .get(`/api/hubs/${encodeURIComponent(PLACE_ID)}/leaderboard?period=all_time`)
          .set(uid(GUEST_UID));
        const unregistered = await request(app)
          .get(`/api/hubs/${encodeURIComponent(UNREGISTERED_PLACE_ID)}/leaderboard?period=all_time`)
          .set(uid(GUEST_UID));

        expect(registered.status).toBe(200);
        expect(registered.body).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ uid: GUEST3_UID })]),
        );
        expect(unregistered.status).toBe(200);
        expect(unregistered.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ uid: GUEST3_UID, displayName: `Test ${GUEST3_UID}` }),
          ]),
        );
        expect(unregistered.body).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ uid: privateUid })]),
        );
      } finally {
        await db.delete(hubCheckinsTable).where(
          inArray(hubCheckinsTable.id, inserted.map((row) => row.id)),
        );
        await db.delete(profilesTable).where(eq(profilesTable.uid, privateUid));
      }
    });

    it("creates, opens, updates, and restricts member-event management to its owner", async () => {
      const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const created = await request(app)
        .post("/api/events")
        .set(uid(GUEST_UID))
        .send({
          title: `Source Test Member Event ${TP}`,
          description: "Created by the integration test.",
          startsAt,
          location: "Example Cafe, Bangkok, Thailand",
          locationPlaceId: "n:12345",
          latitude: 13.7563,
          longitude: 100.5018,
          visibility: "public",
          joinApprovalRequired: true,
          inviteeUids: [],
        });

      expect(created.status).toBe(201);
      expect(created.body.eventType).toBe("member");
      expect(created.body.locationPlaceId).toBe("n:12345");
      expect(created.body.latitude).toBe(13.7563);

      const feed = await request(app)
        .get("/api/events/feed")
        .set(uid(GUEST_UID));
      expect(feed.status).toBe(200);
      expect(feed.body.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: created.body.id,
            eventType: "member",
            title: `Source Test Member Event ${TP}`,
            visibility: "public",
            locationPlaceId: "n:12345",
            latitude: 13.7563,
            longitude: 100.5018,
          }),
        ]),
      );

      const details = await request(app)
        .get(`/api/events/member/${created.body.id}`)
        .set(uid(GUEST2_UID));
      expect(details.status).toBe(200);
      expect(details.body.location).toBe("Example Cafe, Bangkok, Thailand");

      const editable = await request(app)
        .get(`/api/community-events/${created.body.id}/manage`)
        .set(uid(GUEST_UID));
      expect(editable.status).toBe(200);
      expect(editable.body.locationPlaceId).toBe("n:12345");

      const editBody = {
        title: `Updated Source Test Member Event ${TP}`,
        description: "Updated by the owner.",
        startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        endsAt: null,
        location: "Example Cafe, Bangkok, Thailand",
        locationPlaceId: "n:12345",
        latitude: 13.7563,
        longitude: 100.5018,
        visibility: "public",
        inviteeUids: [],
      };
      const deniedUpdate = await request(app)
        .put(`/api/community-events/${created.body.id}`)
        .set(uid(GUEST2_UID))
        .send(editBody);
      expect(deniedUpdate.status).toBe(404);

      const deniedDelete = await request(app)
        .delete(`/api/community-events/${created.body.id}`)
        .set(uid(GUEST2_UID));
      expect(deniedDelete.status).toBe(404);

      const updated = await request(app)
        .put(`/api/community-events/${created.body.id}`)
        .set(uid(GUEST_UID))
        .send(editBody);
      expect(updated.status).toBe(200);
      expect(updated.body.title).toBe(editBody.title);

      const deleted = await request(app)
        .delete(`/api/community-events/${created.body.id}`)
        .set(uid(GUEST_UID));
      expect(deleted.status).toBe(204);
    });

    it("a published public venue event appears in the Events pool with venue coordinates", async () => {
      const created = await request(app)
        .post("/api/venue-owner/me/events")
        .set(uid(OWNER_UID))
        .send({
          title: `Source Test Public Venue Event ${TP}`,
          startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          visibility: "public",
        });
      expect(created.status).toBe(201);

      const feed = await request(app)
        .get("/api/events/feed")
        .set(uid(GUEST_UID));
      expect(feed.status).toBe(200);
      expect(feed.body.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: created.body.event.id,
            eventType: "venue",
            title: `Source Test Public Venue Event ${TP}`,
            latitude: 51.5074,
            longitude: -0.1278,
          }),
        ]),
      );
    });

    it("rejects events that would be hidden from the upcoming Events pool", async () => {
      const created = await request(app)
        .post("/api/events")
        .set(uid(GUEST_UID))
        .send({
          title: `Source Test Past Event ${TP}`,
          startsAt: new Date(Date.now() - 60_000).toISOString(),
          visibility: "public",
        });

      expect(created.status).toBe(400);
      expect(created.body.message).toBe("Event start time must be in the future.");
    });

    it("open-mode check-ins validate location and receive QR-equivalent credit", async () => {
      await db.update(venueOwnerProfilesTable)
        .set({ checkInMode: "open" })
        .where(eq(venueOwnerProfilesTable.placeId, PLACE_ID));

      const originalNodeEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = "production";
        const missingAppCheck = await request(app)
          .post("/api/hubs/checkin")
          .set(uid(GUEST3_UID))
          .send({ lat: 51.5074, lng: -0.1278, accuracy: 5, placeId: PLACE_ID, placeName: "Source Test Venue" });
        expect(missingAppCheck.status).toBe(403);
        expect(missingAppCheck.body.error).toBe("APP_CHECK_REQUIRED");
      } finally {
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
      }

      const tooFar = await request(app)
        .post("/api/hubs/checkin")
        .set(uid(GUEST3_UID))
        .send({ lat: 51.5174, lng: -0.1278, accuracy: 5, placeId: PLACE_ID, placeName: "Source Test Venue" });
      expect(tooFar.status).toBe(403);
      expect(tooFar.body.error).toBe("VENUE_OUT_OF_RANGE");

      const lowAccuracy = await request(app)
        .post("/api/hubs/checkin")
        .set(uid(GUEST3_UID))
        .send({ lat: 51.5074, lng: -0.1278, accuracy: 80, placeId: PLACE_ID, placeName: "Source Test Venue" });
      expect(lowAccuracy.status).toBe(403);
      expect(lowAccuracy.body.error).toBe("LOCATION_ACCURACY_TOO_LOW");

      const missingAccuracy = await request(app)
        .post("/api/hubs/checkin")
        .set(uid(GUEST3_UID))
        .send({ lat: 51.5074, lng: -0.1278, placeId: PLACE_ID, placeName: "Source Test Venue" });
      expect(missingAccuracy.status).toBe(403);
      expect(missingAccuracy.body.error).toBe("LOCATION_ACCURACY_TOO_LOW");

      const uncertainBoundary = await request(app)
        .post("/api/hubs/checkin")
        .set(uid(GUEST3_UID))
        .send({ lat: 51.50775, lng: -0.1278, accuracy: 15, placeId: PLACE_ID, placeName: "Source Test Venue" });
      expect(uncertainBoundary.status).toBe(403);
      expect(uncertainBoundary.body.error).toBe("LOCATION_UNCERTAIN");

      const mocked = await request(app)
        .post("/api/hubs/checkin")
        .set(uid(GUEST3_UID))
        .send({ lat: 51.5074, lng: -0.1278, accuracy: 5, mocked: true, placeId: PLACE_ID, placeName: "Source Test Venue" });
      expect(mocked.status).toBe(403);
      expect(mocked.body.error).toBe("MOCKED_LOCATION");

      const rejectedVisits = await db
        .select({ id: hubCheckinsTable.id })
        .from(hubCheckinsTable)
        .where(and(
          eq(hubCheckinsTable.userUid, GUEST3_UID),
          eq(hubCheckinsTable.placeId, PLACE_ID),
        ));
      expect(rejectedVisits).toHaveLength(0);
      const rejectedVerifications = await db
        .select({ id: venueQrVerificationsTable.id })
        .from(venueQrVerificationsTable)
        .where(and(
          eq(venueQrVerificationsTable.userUid, GUEST3_UID),
          eq(venueQrVerificationsTable.placeId, PLACE_ID),
          eq(venueQrVerificationsTable.source, "open_location"),
        ));
      expect(rejectedVerifications).toHaveLength(0);

      const checkedIn = await request(app)
        .post("/api/hubs/checkin")
        .set(uid(GUEST3_UID))
        .send({ lat: 51.5074, lng: -0.1278, accuracy: 5, mocked: false, placeId: PLACE_ID, placeName: "Source Test Venue" });
      expect(checkedIn.status).toBe(200);
      expect(checkedIn.body).toMatchObject({
        isRegisteredVenue: true,
        isQrVerified: false,
        checkInMode: "open",
        privateOnly: false,
      });
      expect(checkedIn.body.streak_points).toBeGreaterThan(0);

      const [visit] = await db
        .select({ source: hubCheckinsTable.source })
        .from(hubCheckinsTable)
        .where(and(
          eq(hubCheckinsTable.userUid, GUEST3_UID),
          eq(hubCheckinsTable.placeId, PLACE_ID),
        ))
        .limit(1);
      expect(visit?.source).toBe("open_location");

      const guestList = await request(app)
        .get("/api/venue-owner/me/guests?period=all")
        .set(uid(OWNER_UID));
      expect(guestList.status).toBe(200);
      expect(guestList.body.guests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            uid: GUEST3_UID,
            checkinCount: 1,
            qrVerifiedCount: 0,
          }),
        ]),
      );

      const status = await request(app)
        .get(`/api/hubs/${PLACE_ID}/checkin-status`)
        .set(uid(GUEST3_UID));
      expect(status.body).toMatchObject({
        isRegisteredVenue: true,
        isQrVerified: false,
        checkInMode: "open",
        hasOpenCheckin: true,
      });
    });
  },
);
