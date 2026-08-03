/**
 * Venue event field serialization — real-database integration tests.
 *
 * Verifies that optional fields set via the venue-manager API
 * (imageUrl, description, capacityLimit) survive serialization and appear
 * correctly in the guest-facing public endpoint, and that unpublished events
 * are hidden from guests.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { eq, inArray, like, sql } from "drizzle-orm";
import {
  db,
  venueBusinessesTable,
  venueEventRsvpsTable,
  venueEventsTable,
  venueManagerSessionsTable,
  venueManagersTable,
  venueManagerTokensTable,
  venueMembershipAuditTable,
  venueMembershipsTable,
  venueOwnerProfilesTable,
} from "@workspace/db";

// Rate limiting is covered by its own middleware tests; bypass it here.
vi.mock("../middlewares/rateLimit", () => ({
  createIpRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createUserRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// The guest event endpoint uses requireUid (Firebase token). Impersonate via header.
vi.mock("../middlewares/requireUid", () => ({
  requireUid: (
    req: { uid?: string; header: (name: string) => string | undefined },
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: () => void,
  ) => {
    const uid = req.header("x-test-uid");
    if (!uid) {
      res.status(401).json({ message: "unauthenticated" });
      return;
    }
    req.uid = uid;
    next();
  },
}));

process.env["SESSION_SECRET"] ||= "test-session-secret";

const hasDatabase = Boolean(process.env["DATABASE_URL"]);
const PREFIX = `itest-vevt-${process.pid}-${Date.now()}`;
const email = (name: string) => `${PREFIX}-${name}@example.com`;
const STRONG = "CorrectHorse99x";
const GUEST_UID = `${PREFIX}-guest-uid`;

async function cleanup() {
  // Clean up events and RSVPs for test-owned places.
  const profiles = await db
    .select({ id: venueOwnerProfilesTable.id, placeId: venueOwnerProfilesTable.placeId })
    .from(venueOwnerProfilesTable)
    .where(sql`${venueOwnerProfilesTable.ownerUid} LIKE ${`${PREFIX}%`}`);

  const placeIds = profiles.map((p) => p.placeId);
  if (placeIds.length) {
    const events = await db
      .select({ id: venueEventsTable.id })
      .from(venueEventsTable)
      .where(inArray(venueEventsTable.placeId, placeIds));
    const eventIds = events.map((e) => e.id);
    if (eventIds.length) {
      await db.delete(venueEventRsvpsTable).where(inArray(venueEventRsvpsTable.eventId, eventIds));
      await db.delete(venueEventsTable).where(inArray(venueEventsTable.id, eventIds));
    }
  }

  // Clean up manager accounts.
  const managers = await db
    .select({ id: venueManagersTable.id })
    .from(venueManagersTable)
    .where(like(venueManagersTable.email, `${PREFIX}%`));
  const managerIds = managers.map((m) => m.id);
  if (managerIds.length) {
    await db.delete(venueManagerSessionsTable).where(inArray(venueManagerSessionsTable.managerId, managerIds));
    await db.delete(venueManagerTokensTable).where(inArray(venueManagerTokensTable.managerId, managerIds));
    await db.delete(venueMembershipsTable).where(inArray(venueMembershipsTable.managerId, managerIds));
  }

  // Clean up businesses and profiles.
  const profileIds = profiles.map((p) => p.id);
  if (profileIds.length) {
    const businesses = await db
      .select({ id: venueBusinessesTable.id })
      .from(venueBusinessesTable)
      .where(inArray(venueBusinessesTable.venueOwnerProfileId, profileIds));
    const businessIds = businesses.map((b) => b.id);
    if (businessIds.length) {
      await db.delete(venueMembershipAuditTable).where(inArray(venueMembershipAuditTable.businessId, businessIds));
      await db.delete(venueManagerTokensTable).where(inArray(venueManagerTokensTable.businessId, businessIds));
      await db.delete(venueMembershipsTable).where(inArray(venueMembershipsTable.businessId, businessIds));
      await db.delete(venueBusinessesTable).where(inArray(venueBusinessesTable.id, businessIds));
    }
    await db.delete(venueOwnerProfilesTable).where(inArray(venueOwnerProfilesTable.id, profileIds));
  }

  if (managerIds.length) {
    await db.delete(venueManagersTable).where(inArray(venueManagersTable.id, managerIds));
  }
}

async function makeBusiness(name: string) {
  const [profile] = await db
    .insert(venueOwnerProfilesTable)
    .values({
      ownerUid: `${PREFIX}-uid-${name}`,
      placeId: `${PREFIX}-place-${name}`,
      placeName: `Venue ${name}`,
      businessName: `Business ${name}`,
      verificationDocUrl: "https://example.com/proof.pdf",
      applicationStatus: "approved",
      isApproved: true,
      isVerified: true,
      approvedAt: new Date(),
    })
    .returning();
  const [business] = await db
    .insert(venueBusinessesTable)
    .values({
      venueOwnerProfileId: profile!.id,
      placeId: profile!.placeId,
      legalName: profile!.businessName,
      createdByUid: profile!.ownerUid,
    })
    .returning();
  return { profile: profile!, business: business! };
}

describe.skipIf(!hasDatabase)("venue event field serialization (real database)", async () => {
  const { default: app } = await import("../app");
  const api = () => request(app);

  beforeAll(cleanup);
  afterAll(cleanup);

  /** Claim an owner account for a fresh business; returns an authed agent. */
  async function claimOwner(name: string) {
    const { profile, business } = await makeBusiness(name);
    const agent = request.agent(app);
    const res = await agent
      .post("/api/venue-manager/claim")
      .set("x-test-uid", profile.ownerUid)
      .send({ email: email(name), displayName: `Owner ${name}`, password: STRONG });
    expect(res.status).toBe(200);
    // Refresh CSRF token via GET /session so we have the latest value.
    const session = await agent.get("/api/venue-manager/session");
    expect(session.status).toBe(200);
    return {
      agent,
      csrf: session.body.csrfToken as string,
      business,
      profile,
    };
  }

  it("preserves imageUrl, description, and capacityLimit in the guest-facing event list", async () => {
    const { agent, csrf, business, profile } = await claimOwner("fields");
    const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Create an event with all optional fields via the manager API.
    const created = await agent
      .post(`/api/venue-manager/businesses/${business.id}/events`)
      .set("x-csrf-token", csrf)
      .send({
        title: "Integration Test Event",
        startsAt,
        description: "A detailed description of the event.",
        imageUrl: "https://example.com/event-banner.jpg",
        capacityLimit: 42,
        isPublished: true,
      });
    expect(created.status).toBe(201);
    const createdEvent = created.body.event as Record<string, unknown>;
    expect(createdEvent.id).toBeDefined();

    // Fetch via the guest/public endpoint.
    const guestRes = await api()
      .get(`/api/venue-owner/${profile.placeId}/events`)
      .set("x-test-uid", GUEST_UID);
    expect(guestRes.status).toBe(200);

    const events = guestRes.body.events as Record<string, unknown>[];
    expect(events).toHaveLength(1);

    const event = events[0]!;
    expect(event.title).toBe("Integration Test Event");
    expect(event.description).toBe("A detailed description of the event.");
    expect(event.imageUrl).toBe("https://example.com/event-banner.jpg");
    expect(event.capacityLimit).toBe(42);

    // ownerUid must be stripped from the public response.
    expect(event.ownerUid).toBeUndefined();
  });

  it("hides unpublished events from guests but still serves them to the manager", async () => {
    const { agent, csrf, business, profile } = await claimOwner("visibility");
    const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    // Create a published event.
    const pub = await agent
      .post(`/api/venue-manager/businesses/${business.id}/events`)
      .set("x-csrf-token", csrf)
      .send({ title: "Published Event", startsAt, isPublished: true });
    expect(pub.status).toBe(201);

    // Create an unpublished (draft) event.
    const draft = await agent
      .post(`/api/venue-manager/businesses/${business.id}/events`)
      .set("x-csrf-token", csrf)
      .send({ title: "Draft Event", startsAt, isPublished: false });
    expect(draft.status).toBe(201);

    // Manager can see both events.
    const managerRes = await agent.get(`/api/venue-manager/businesses/${business.id}/events`);
    expect(managerRes.status).toBe(200);
    const managerEvents = managerRes.body.events as Record<string, unknown>[];
    expect(managerEvents).toHaveLength(2);

    // Guests only see the published event.
    const guestRes = await api()
      .get(`/api/venue-owner/${profile.placeId}/events`)
      .set("x-test-uid", GUEST_UID);
    expect(guestRes.status).toBe(200);
    const guestEvents = guestRes.body.events as Record<string, unknown>[];
    expect(guestEvents).toHaveLength(1);
    expect(guestEvents[0]!.title).toBe("Published Event");
    expect(guestEvents[0]!.isPublished).toBe(true);
  });

  it("shows no events to guests when all events are unpublished", async () => {
    const { agent, csrf, business, profile } = await claimOwner("alldrafts");
    const startsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    const draft = await agent
      .post(`/api/venue-manager/businesses/${business.id}/events`)
      .set("x-csrf-token", csrf)
      .send({ title: "Hidden Event", startsAt, isPublished: false });
    expect(draft.status).toBe(201);

    const guestRes = await api()
      .get(`/api/venue-owner/${profile.placeId}/events`)
      .set("x-test-uid", GUEST_UID);
    expect(guestRes.status).toBe(200);
    expect(guestRes.body.events).toHaveLength(0);
  });

  it("returns 404 for events belonging to a revoked (unapproved) venue", async () => {
    // Insert a venue profile that is explicitly not approved.
    const [revokedProfile] = await db
      .insert(venueOwnerProfilesTable)
      .values({
        ownerUid: `${PREFIX}-uid-revoked`,
        placeId: `${PREFIX}-place-revoked`,
        placeName: "Revoked Venue",
        businessName: "Revoked Business",
        verificationDocUrl: "https://example.com/proof.pdf",
        applicationStatus: "rejected",
        isApproved: false,
      })
      .returning();

    // Insert a published event for the revoked venue directly.
    await db.insert(venueEventsTable).values({
      placeId: revokedProfile!.placeId,
      ownerUid: revokedProfile!.ownerUid,
      title: "Ghost Event",
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isPublished: true,
    });

    // Guests must NOT see events for a revoked venue.
    const guestRes = await api()
      .get(`/api/venue-owner/${revokedProfile!.placeId}/events`)
      .set("x-test-uid", GUEST_UID);
    expect(guestRes.status).toBe(404);
  });

  it("reflects updated optional fields in the guest list after a PATCH", async () => {
    const { agent, csrf, business, profile } = await claimOwner("patch");
    const startsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

    // Create event without optional fields.
    const created = await agent
      .post(`/api/venue-manager/businesses/${business.id}/events`)
      .set("x-csrf-token", csrf)
      .send({ title: "Patch Target", startsAt, isPublished: true });
    expect(created.status).toBe(201);
    const eventId = (created.body.event as Record<string, unknown>).id as number;

    // Patch in the optional fields.
    const patched = await agent
      .patch(`/api/venue-manager/businesses/${business.id}/events/${eventId}`)
      .set("x-csrf-token", csrf)
      .send({
        description: "Now with a description.",
        imageUrl: "https://example.com/updated-banner.png",
        capacityLimit: 100,
      });
    expect(patched.status).toBe(200);

    // Confirm the guest sees the updated values.
    const guestRes = await api()
      .get(`/api/venue-owner/${profile.placeId}/events`)
      .set("x-test-uid", GUEST_UID);
    expect(guestRes.status).toBe(200);
    const events = guestRes.body.events as Record<string, unknown>[];
    expect(events).toHaveLength(1);
    expect(events[0]!.description).toBe("Now with a description.");
    expect(events[0]!.imageUrl).toBe("https://example.com/updated-banner.png");
    expect(events[0]!.capacityLimit).toBe(100);
  });
});
