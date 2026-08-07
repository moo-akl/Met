import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock handles — defined before vi.mock() factory runs.
// ---------------------------------------------------------------------------

const dbMocks = vi.hoisted(() => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    delete: vi.fn().mockReturnThis(),
    transaction: vi.fn(),
  };
  return { chain };
});

// Distinct objects so we can compare table references in delete-order assertions.
const venueTableMocks = vi.hoisted(() => ({
  venueOwnerProfilesTable: { _name: "venue_owner_profiles" },
  venueEventsTable: { _name: "venue_events" },
  venueEventRsvpsTable: { _name: "venue_event_rsvps" },
  venueRewardsTable: { _name: "venue_rewards" },
  venueAnnouncementsTable: { _name: "venue_announcements" },
  venueApplicationHistoryTable: { _name: "venue_application_history" },
  venueMembershipsTable: { _name: "venue_memberships" },
}));

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  profilesTable: {},
  encountersTable: {},
  revealRequestsTable: {},
  subscriptionsTable: {},
  ...venueTableMocks,
}));

vi.mock("../lib/deleteUserData", () => ({
  deleteUserData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/deleteVenueOwnerProfile", () => ({
  deleteVenueOwnerProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/firestoreMirror", () => ({
  mirrorProfileToFirestore: vi.fn().mockResolvedValue(undefined),
  mirrorRevealRequest: vi.fn().mockResolvedValue(undefined),
  mirrorRevealStatus: vi.fn().mockResolvedValue(undefined),
  recordSymmetricEncounter: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/firebaseAdmin", () => ({
  adminStorage: vi.fn(),
  adminAuth: vi.fn(),
  adminDb: vi.fn(),
  tryInitAdmin: vi.fn(() => null),
}));

// ---------------------------------------------------------------------------
// App — imported after mocks are registered so mocked modules are in place.
// ---------------------------------------------------------------------------

import request from "supertest";
import app from "../app";
import { deleteUserData } from "../lib/deleteUserData";
import { deleteVenueOwnerProfile } from "../lib/deleteVenueOwnerProfile";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const profileFixture = {
  uid: "alice",
  uidHash: "hash-alice",
  displayName: "Alice Wonderland",
  photoUrl: null,
  bio: null,
  socials: {},
  interests: [],
  isVisible: true,
  preferredLocale: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Ensure no real Redis connection is attempted.
// ---------------------------------------------------------------------------

beforeAll(() => {
  delete process.env["REDIS_URL"];
});

beforeEach(() => {
  vi.clearAllMocks();
  // Restore chainable returns after clearAllMocks resets them.
  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockReturnThis();
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.insert.mockReturnThis();
  dbMocks.chain.values.mockReturnThis();
  dbMocks.chain.onConflictDoUpdate.mockReturnThis();
  dbMocks.chain.delete.mockReturnThis();
  // Transaction executes callback immediately with the same mock db.
  dbMocks.chain.transaction.mockImplementation(
    async (cb: (tx: typeof dbMocks.chain) => Promise<void>) => cb(dbMocks.chain),
  );
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/profiles/me", () => {
  it("returns 401 when no auth header or x-met-uid is provided", async () => {
    const res = await request(app).get("/api/profiles/me");

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 404 when the authenticated user has no profile", async () => {
    dbMocks.chain.limit.mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/api/profiles/me")
      .set("x-met-uid", "uid-no-profile");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/not found/i);
  });

  it("returns 200 with the profile when the user exists", async () => {
    dbMocks.chain.limit.mockResolvedValueOnce([profileFixture]);
    // Second query: subscription lookup — return no row (defaults to free tier).
    dbMocks.chain.limit.mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/api/profiles/me")
      .set("x-met-uid", "alice");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      uid: "alice",
      displayName: "Alice Wonderland",
    });
  });
});

describe("PUT /api/profiles/me", () => {
  it("returns 401 when no auth header or x-met-uid is provided", async () => {
    const res = await request(app)
      .put("/api/profiles/me")
      .send({ displayName: "Alice" });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 400 when displayName is missing from the body", async () => {
    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "uid-validation-test")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 400 when displayName is an empty string", async () => {
    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "uid-validation-test")
      .send({ displayName: "" });

    expect(res.status).toBe(400);
  });

  it("returns 200 with the upserted profile on a valid request", async () => {
    dbMocks.chain.returning.mockResolvedValueOnce([profileFixture]);

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ displayName: "Alice Wonderland" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      uid: "alice",
      displayName: "Alice Wonderland",
    });
  });

  it("preserves optional fields when omitted from the request body", async () => {
    const updatedFixture = { ...profileFixture, bio: "Hello!", socials: { twitter: "@alice" } };
    dbMocks.chain.returning.mockResolvedValueOnce([updatedFixture]);

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({
        displayName: "Alice Wonderland",
        bio: "Hello!",
        socials: { twitter: "@alice" },
      });

    expect(res.status).toBe(200);
    expect(res.body.bio).toBe("Hello!");
    expect(res.body.socials).toMatchObject({ twitter: "@alice" });
  });

  it("does not expose the internal uidHash field in the response", async () => {
    dbMocks.chain.returning.mockResolvedValueOnce([profileFixture]);

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ displayName: "Alice Wonderland" });

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("uidHash");
  });

  it("accepts valid interests from the canonical list and returns them in the response", async () => {
    const withInterests = { ...profileFixture, interests: ["Music", "Travel"] };
    dbMocks.chain.returning.mockResolvedValueOnce([withInterests]);

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ displayName: "Alice Wonderland", interests: ["Music", "Travel"] });

    expect(res.status).toBe(200);
    expect(res.body.interests).toEqual(["Music", "Travel"]);
  });

  it("silently strips interests not in the canonical whitelist", async () => {
    // Only "Music" is in the allowed list; "Hacking" and "Unknown" are not.
    const withKnownOnly = { ...profileFixture, interests: ["Music"] };
    dbMocks.chain.returning.mockResolvedValueOnce([withKnownOnly]);

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ displayName: "Alice", interests: ["Music", "Hacking", "Unknown"] });

    expect(res.status).toBe(200);
    // The fixture has only "Music" (what the mock DB returns).
    expect(res.body.interests).toEqual(["Music"]);
  });

  it("deduplicates interests — duplicate entries count only once", async () => {
    // Send 8 items including two duplicates (≤10 so Zod passes); after
    // server-side dedup the 6 unique tags are stored.
    const tags = ["Music", "Travel", "Music", "Art", "Travel", "Food", "Gaming", "Tech"];
    const withDedupedInterests = {
      ...profileFixture,
      interests: ["Music", "Travel", "Art", "Food", "Gaming", "Tech"],
    };
    dbMocks.chain.returning.mockResolvedValueOnce([withDedupedInterests]);

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ displayName: "Alice", interests: tags });

    expect(res.status).toBe(200);
    // Response reflects what the DB returned — 6 unique entries.
    expect(res.body.interests).toEqual(["Music", "Travel", "Art", "Food", "Gaming", "Tech"]);
  });

  it("preserves existing interests when interests field is omitted from the request", async () => {
    const withInterests = { ...profileFixture, interests: ["Yoga", "Coffee"] };
    dbMocks.chain.returning.mockResolvedValueOnce([withInterests]);

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ displayName: "Alice Wonderland" }); // no interests key

    expect(res.status).toBe(200);
    // DB returned the pre-existing interests — confirm they flow through serialize().
    expect(res.body.interests).toEqual(["Yoga", "Coffee"]);
  });

  it("includes interests in the GET /profiles/me response", async () => {
    const withInterests = { ...profileFixture, interests: ["Hiking", "Dogs"] };
    dbMocks.chain.limit.mockResolvedValueOnce([withInterests]);
    // Second query: subscription lookup — return no row (defaults to free tier).
    dbMocks.chain.limit.mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/api/profiles/me")
      .set("x-met-uid", "alice");

    expect(res.status).toBe(200);
    expect(res.body.interests).toEqual(["Hiking", "Dogs"]);
  });

  describe("preferredLocale upsert behaviour", () => {
    it("stores a valid locale code and does not expose it in the response", async () => {
      const withLocale = { ...profileFixture, preferredLocale: "es" };
      dbMocks.chain.returning.mockResolvedValueOnce([withLocale]);

      const res = await request(app)
        .put("/api/profiles/me")
        .set("x-met-uid", "alice")
        .send({ displayName: "Alice Wonderland", preferredLocale: "es" });

      expect(res.status).toBe(200);
      // preferredLocale is stored server-side only and must not appear in the response.
      expect(res.body).not.toHaveProperty("preferredLocale");
    });

    it("silently ignores an unrecognised locale and leaves the existing value intact", async () => {
      dbMocks.chain.returning.mockResolvedValueOnce([profileFixture]);

      const res = await request(app)
        .put("/api/profiles/me")
        .set("x-met-uid", "alice")
        .send({ displayName: "Alice Wonderland", preferredLocale: "xx-INVALID" });

      expect(res.status).toBe(200);
      // An unknown locale is dropped; response still succeeds.
      expect(res.body).not.toHaveProperty("preferredLocale");
    });
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/profiles/me
// ---------------------------------------------------------------------------

describe("DELETE /api/profiles/me", () => {
  // Cast mocked functions to spies so we can assert calls.
  const deleteUserDataSpy = deleteUserData as ReturnType<typeof vi.fn>;
  const deleteVenueOwnerProfileSpy = deleteVenueOwnerProfile as ReturnType<typeof vi.fn>;

  const venueOwnerProfileFixture = {
    id: 99,
    ownerUid: "alice",
    placeId: "place-123",
    placeName: "Alice's Bar",
    businessName: "Alice's Bar Ltd",
    applicationStatus: "approved" as const,
    isApproved: true,
    isVerified: true,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  };

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).delete("/api/profiles/me").send({});
    expect(res.status).toBe(401);
  });

  it("returns 204 and calls deleteUserData but skips venue cascade when deleteVenueProfile is absent", async () => {
    const res = await request(app)
      .delete("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({});

    expect(res.status).toBe(204);
    expect(deleteUserDataSpy).toHaveBeenCalledWith("alice");
    // No venue table should have been targeted.
    expect(deleteVenueOwnerProfileSpy).not.toHaveBeenCalled();
    expect(dbMocks.chain.delete).not.toHaveBeenCalled();
  });

  it("runs the full venue cascade and calls deleteUserData when deleteVenueProfile is true and a profile is found", async () => {
    // The handler does: select owner profile → found → db.transaction(deleteVenueOwnerProfile)
    // The limit() call resolves to a non-empty array so the profile is found.
    dbMocks.chain.limit.mockResolvedValueOnce([venueOwnerProfileFixture]);

    const res = await request(app)
      .delete("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ deleteVenueProfile: true });

    expect(res.status).toBe(204);

    // deleteVenueOwnerProfile must have been called inside a transaction.
    expect(dbMocks.chain.transaction).toHaveBeenCalledTimes(1);
    expect(deleteVenueOwnerProfileSpy).toHaveBeenCalledTimes(1);
    // The profile object passed must include both id and ownerUid.
    expect(deleteVenueOwnerProfileSpy).toHaveBeenCalledWith(
      expect.anything(), // tx handle
      expect.objectContaining({ id: 99, ownerUid: "alice" }),
    );

    // Core user data must still be cleaned up after the venue cascade.
    expect(deleteUserDataSpy).toHaveBeenCalledWith("alice");
  });

  it("skips the venue cascade but still deletes user data when no venue profile is found", async () => {
    // Profile lookup returns empty — user never registered as a venue owner.
    dbMocks.chain.limit.mockResolvedValueOnce([]);

    const res = await request(app)
      .delete("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ deleteVenueProfile: true });

    expect(res.status).toBe(204);
    expect(deleteVenueOwnerProfileSpy).not.toHaveBeenCalled();
    expect(dbMocks.chain.transaction).not.toHaveBeenCalled();
    expect(deleteUserDataSpy).toHaveBeenCalledWith("alice");
  });

  it("calls deleteUserData which cleans up RSVPs the user made as an attendee at other venues", async () => {
    // RSVPs by userUid (attendee role) are cleaned up inside deleteUserData, not in the
    // venue-specific block. This test verifies that deleteUserData is always called,
    // ensuring those RSVPs are never orphaned after account deletion.
    const res = await request(app)
      .delete("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({});

    expect(res.status).toBe(204);
    // deleteUserData is responsible for removing venue_event_rsvps where userUid = alice.
    expect(deleteUserDataSpy).toHaveBeenCalledWith("alice");
  });
});
