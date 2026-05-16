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

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  profilesTable: {},
  encountersTable: {},
  revealRequestsTable: {},
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
  isVisible: true,
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
});
