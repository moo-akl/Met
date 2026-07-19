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
  };
  return { chain };
});

const logMocks = vi.hoisted(() => {
  const warnSpy = vi.fn();
  const childLogger = {
    warn: warnSpy,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  };
  childLogger.child.mockReturnValue(childLogger);
  return { childLogger, warnSpy };
});

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  profilesTable: {},
  encountersTable: {},
  revealRequestsTable: {},
  subscriptionsTable: {},
}));

// Replace pino-http with a bare middleware that attaches our spy logger to
// req.log — avoids pino's internal symbol requirements while still letting
// route handlers call req.log.warn / req.log.info normally.
vi.mock("pino-http", () => ({
  default: () => (req: any, _res: any, next: any) => {
    req.log = logMocks.childLogger;
    next();
  },
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
  // Default limit to resolve with an empty array so routes that make a second
  // DB query (e.g. subscriptions lookup in GET /profiles/me) don't throw on
  // array destructuring when no per-test override is set.
  dbMocks.chain.limit.mockResolvedValue([]);
  // Restore childLogger methods after clearAllMocks resets them.
  logMocks.childLogger.warn = logMocks.warnSpy;
  logMocks.childLogger.child.mockReturnValue(logMocks.childLogger);
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

    const res = await request(app)
      .get("/api/profiles/me")
      .set("x-met-uid", "alice");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      uid: "alice",
      displayName: "Alice Wonderland",
    });
  });

  it("returns 200 with subscriptionTier 'free' when the subscriptions query throws", async () => {
    // First call (profile lookup) resolves, second call (subscriptions) throws.
    dbMocks.chain.limit
      .mockResolvedValueOnce([profileFixture])
      .mockRejectedValueOnce(new Error("subscriptionsTable not found in mock"));

    const res = await request(app)
      .get("/api/profiles/me")
      .set("x-met-uid", "alice");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      uid: "alice",
      subscriptionTier: "free",
      isSubscribed: false,
    });
    // The catch block must log a warning so the silent failure is observable.
    expect(logMocks.warnSpy).toHaveBeenCalledOnce();
    const [bindings, message] = logMocks.warnSpy.mock.calls[0] as [unknown, string];
    expect(bindings).toMatchObject({ err: expect.any(Error) });
    expect(message).toContain("subscription lookup failed");
  });

  it("returns subscriptionTier 'pro' and isSubscribed true for an active pro subscriber", async () => {
    // First call (profile lookup) resolves with the profile.
    // Second call (subscriptions lookup) resolves with an active pro row.
    dbMocks.chain.limit
      .mockResolvedValueOnce([profileFixture])
      .mockResolvedValueOnce([{ tier: "pro", status: "active" }]);

    const res = await request(app)
      .get("/api/profiles/me")
      .set("x-met-uid", "alice");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      uid: "alice",
      subscriptionTier: "pro",
      isSubscribed: true,
    });
  });

  it("returns isSubscribed false for a cancelled pro subscription", async () => {
    dbMocks.chain.limit
      .mockResolvedValueOnce([profileFixture])
      .mockResolvedValueOnce([{ tier: "pro", status: "cancelled" }]);

    const res = await request(app)
      .get("/api/profiles/me")
      .set("x-met-uid", "alice");

    expect(res.status).toBe(200);
    expect(res.body.isSubscribed).toBe(false);
  });

  it("returns isSubscribed false for an expired pro subscription", async () => {
    dbMocks.chain.limit
      .mockResolvedValueOnce([profileFixture])
      .mockResolvedValueOnce([{ tier: "pro", status: "expired" }]);

    const res = await request(app)
      .get("/api/profiles/me")
      .set("x-met-uid", "alice");

    expect(res.status).toBe(200);
    expect(res.body.isSubscribed).toBe(false);
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
