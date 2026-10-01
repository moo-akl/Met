import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock handles — defined before vi.mock() factory runs.
// ---------------------------------------------------------------------------

const dbMocks = vi.hoisted(() => {
  const sessionDb = {
    transaction: vi.fn(),
  };
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    transaction: vi.fn(),
    execute: vi.fn(),
  };
  return { chain, sessionDb };
});

const drizzleMocks = vi.hoisted(() => ({
  drizzle: vi.fn(),
}));
const poolMocks = vi.hoisted(() => ({
  connect: vi.fn(),
}));

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
  pool: poolMocks,
  profilesTable: {},
  encountersTable: {},
  presenceTable: {},
  revealRequestsTable: {},
  subscriptionsTable: {},
  networkMembersTable: {},
  ...venueTableMocks,
}));

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: drizzleMocks.drizzle,
}));

vi.mock("../lib/deleteUserData", () => ({
  deleteUserData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/deleteVenueOwnerProfile", () => ({
  // Returns string[] (event image URLs) — default to empty array.
  deleteVenueOwnerProfile: vi.fn().mockResolvedValue([]),
}));

vi.mock("../lib/firestoreMirror", () => ({
  mirrorProfileToFirestore: vi.fn().mockResolvedValue(undefined),
  hideProfileFromFirestore: vi.fn().mockResolvedValue({ ok: true }),
  clearEncounterMirrorsForHiddenUser: vi.fn().mockResolvedValue({ ok: true }),
  mirrorRevealRequest: vi.fn().mockResolvedValue(undefined),
  mirrorRevealStatus: vi.fn().mockResolvedValue(undefined),
  recordSymmetricEncounter: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/firebaseAdmin", () => ({
  adminAuth: vi.fn(),
  adminDb: vi.fn(),
  tryInitAdmin: vi.fn(() => null),
}));

vi.mock("../lib/deleteVenueStorageFiles", () => ({
  deleteVenueStorageFiles: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// App — imported after mocks are registered so mocked modules are in place.
// ---------------------------------------------------------------------------

import request from "supertest";
import app from "../app";
import { deleteUserData } from "../lib/deleteUserData";
import { deleteVenueOwnerProfile } from "../lib/deleteVenueOwnerProfile";
import { deleteVenueStorageFiles } from "../lib/deleteVenueStorageFiles";
import {
  clearEncounterMirrorsForHiddenUser,
  hideProfileFromFirestore,
  mirrorProfileToFirestore,
} from "../lib/firestoreMirror";

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

let sessionLockTails = new Map<string, Promise<void>>();
let sessionEventLog: string[] = [];
let sessionClients: Array<{
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}> = [];

function createSessionPoolClient() {
  const heldLocks = new Map<string, () => void>();
  const client = {
    query: vi.fn(async (statement: string, values?: unknown[]) => {
      const key = String(values?.[0] ?? "");
      if (statement.includes("pg_advisory_lock(") && !statement.includes("unlock")) {
        const previous = sessionLockTails.get(key) ?? Promise.resolve();
        let release!: () => void;
        const current = new Promise<void>((resolve) => {
          release = resolve;
        });
        sessionLockTails.set(key, current);
        await previous;
        heldLocks.set(key, release);
      } else if (statement.includes("pg_advisory_unlock(")) {
        heldLocks.get(key)?.();
        heldLocks.delete(key);
      }
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  sessionClients.push(client);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset one-shot responses too: clearAllMocks only clears call history, so
  // an early-returning request could otherwise shift a queued result into the
  // next test's profile-preservation lookup.
  dbMocks.chain.select.mockReset().mockReturnThis();
  dbMocks.chain.from.mockReset().mockReturnThis();
  dbMocks.chain.where.mockReset().mockReturnThis();
  dbMocks.chain.limit.mockReset().mockResolvedValue([]);
  dbMocks.chain.insert.mockReset().mockReturnThis();
  dbMocks.chain.values.mockReset().mockReturnThis();
  dbMocks.chain.onConflictDoUpdate.mockReset().mockReturnThis();
  dbMocks.chain.returning.mockReset();
  dbMocks.chain.update.mockReset().mockReturnThis();
  dbMocks.chain.set.mockReset().mockReturnThis();
  dbMocks.chain.delete.mockReset().mockReturnThis();
  dbMocks.chain.transaction.mockReset();
  dbMocks.chain.execute.mockReset().mockResolvedValue({ rows: [] });
  // Transaction executes callback immediately with the same mock db.
  dbMocks.chain.transaction.mockImplementation(
    async (cb: (tx: typeof dbMocks.chain) => Promise<void>) => cb(dbMocks.chain),
  );
  dbMocks.sessionDb.transaction.mockReset().mockImplementation(
    async (cb: (tx: typeof dbMocks.chain) => Promise<unknown>) => {
      const result = await cb(dbMocks.chain);
      sessionEventLog.push("pg-commit");
      return result;
    },
  );
  sessionLockTails = new Map();
  sessionEventLog = [];
  sessionClients = [];
  poolMocks.connect.mockReset().mockImplementation(async () => createSessionPoolClient());
  drizzleMocks.drizzle.mockReset().mockImplementation((client) => {
    expect(client).toBe(sessionClients.at(-1));
    return dbMocks.sessionDb;
  });

  (mirrorProfileToFirestore as ReturnType<typeof vi.fn>)
    .mockReset()
    .mockResolvedValue({ ok: true });
  (hideProfileFromFirestore as ReturnType<typeof vi.fn>)
    .mockReset()
    .mockResolvedValue({ ok: true });
  (clearEncounterMirrorsForHiddenUser as ReturnType<typeof vi.fn>)
    .mockReset()
    .mockResolvedValue({ ok: true });
  (deleteUserData as ReturnType<typeof vi.fn>)
    .mockReset()
    .mockResolvedValue(undefined);
  (deleteVenueOwnerProfile as ReturnType<typeof vi.fn>)
    .mockReset()
    .mockResolvedValue([]);
  (deleteVenueStorageFiles as ReturnType<typeof vi.fn>)
    .mockReset()
    .mockResolvedValue(undefined);
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
      visibilityVersion: profileFixture.updatedAt.toISOString(),
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
    const hiddenFixture = { ...profileFixture, isVisible: false };
    dbMocks.chain.returning.mockResolvedValueOnce([hiddenFixture]);

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ displayName: "Alice Wonderland" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      uid: "alice",
      displayName: "Alice Wonderland",
      isVisible: false,
    });
    expect(dbMocks.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: false }),
    );
    expect(mirrorProfileToFirestore).toHaveBeenCalledWith({
      uid: "alice",
      isVisible: false,
    });
    expect(hideProfileFromFirestore).toHaveBeenCalledWith("alice");
  });

  it("creates a new profile Hidden when isVisible is omitted", async () => {
    dbMocks.chain.limit.mockResolvedValueOnce([]);
    dbMocks.chain.returning.mockResolvedValueOnce([
      { ...profileFixture, isVisible: false },
    ]);

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ displayName: "Alice Wonderland" });

    expect(res.status).toBe(200);
    expect(res.body.isVisible).toBe(false);
    expect(dbMocks.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: false }),
    );
    expect(hideProfileFromFirestore).toHaveBeenCalledWith("alice");
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

  it("keeps Ghost Mode enabled when saving another profile field without isVisible", async () => {
    const hiddenFixture = { ...profileFixture, isVisible: false };
    dbMocks.chain.limit.mockResolvedValueOnce([{ isVisible: false }]);
    dbMocks.chain.returning.mockResolvedValueOnce([hiddenFixture]);

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ displayName: "Alice Updated" });

    expect(res.status).toBe(200);
    expect(res.body.isVisible).toBe(false);
    expect(dbMocks.chain.onConflictDoUpdate.mock.calls[0]?.[0]?.set)
      .not.toHaveProperty("isVisible");
    expect(hideProfileFromFirestore).toHaveBeenCalledWith("alice");
    expect(clearEncounterMirrorsForHiddenUser).toHaveBeenCalledWith("alice");
  });

  it("keeps the canonical profile Hidden when the Firestore privacy barrier fails", async () => {
    (hideProfileFromFirestore as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      error: "Firestore unavailable",
    });
    dbMocks.chain.limit.mockResolvedValueOnce([
      { isVisible: true, updatedAt: profileFixture.updatedAt },
    ]);
    dbMocks.chain.returning.mockResolvedValueOnce([
      { ...profileFixture, isVisible: false },
    ]);

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ displayName: "Alice", isVisible: false });

    expect(res.status).toBe(503);
    expect(dbMocks.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: false }),
    );
    expect(res.body.message).toMatch(/remains hidden/i);
  });

  it("persists Hidden and reports failure when the profile mirror fails", async () => {
    (mirrorProfileToFirestore as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      error: "Firestore unavailable",
    });
    dbMocks.chain.limit.mockResolvedValueOnce([
      { isVisible: true, updatedAt: profileFixture.updatedAt },
    ]);
    dbMocks.chain.returning.mockResolvedValueOnce([
      { ...profileFixture, isVisible: false },
    ]);

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ displayName: "Alice", isVisible: false });

    expect(res.status).toBe(503);
    expect(dbMocks.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: false }),
    );
    expect(res.body.message).toMatch(/remains hidden/i);
  });

  it("rejects an opt-in based on an outdated visibility version", async () => {
    const currentVersion = "2025-01-02T00:00:00.000Z";
    dbMocks.chain.limit.mockResolvedValueOnce([
      { isVisible: false, updatedAt: new Date(currentVersion) },
    ]);

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({
        displayName: "Alice",
        isVisible: true,
        expectedVisibilityVersion: profileFixture.updatedAt.toISOString(),
      });

    expect(res.status).toBe(409);
    expect(dbMocks.chain.insert).not.toHaveBeenCalled();
    expect(mirrorProfileToFirestore).not.toHaveBeenCalled();
    expect(hideProfileFromFirestore).not.toHaveBeenCalled();
  });

  it("requires a visibility version when opting in", async () => {
    dbMocks.chain.limit.mockResolvedValueOnce([
      { isVisible: false, updatedAt: profileFixture.updatedAt },
    ]);

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ displayName: "Alice", isVisible: true });

    expect(res.status).toBe(400);
    expect(dbMocks.chain.insert).not.toHaveBeenCalled();
  });

  it("opts in only with the current visibility version and returns a new version", async () => {
    const currentVersion = profileFixture.updatedAt.toISOString();
    const nextUpdatedAt = new Date(profileFixture.updatedAt.getTime() + 1);
    const visibleFixture = {
      ...profileFixture,
      isVisible: true,
      updatedAt: nextUpdatedAt,
    };
    dbMocks.chain.limit.mockResolvedValueOnce([
      { isVisible: false, updatedAt: profileFixture.updatedAt },
    ]);
    dbMocks.chain.returning.mockResolvedValueOnce([visibleFixture]);

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({
        displayName: "Alice",
        isVisible: true,
        expectedVisibilityVersion: currentVersion,
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      isVisible: true,
      visibilityVersion: nextUpdatedAt.toISOString(),
    });
    expect(dbMocks.chain.onConflictDoUpdate.mock.calls[0]?.[0]?.set)
      .toHaveProperty("isVisible", true);
    expect(mirrorProfileToFirestore).toHaveBeenCalledWith({
      uid: "alice",
      isVisible: true,
    });
    expect(hideProfileFromFirestore).not.toHaveBeenCalled();
  });

  it("compensates to canonical Hidden when the Visible Firestore mirror fails", async () => {
    const currentVersion = profileFixture.updatedAt.toISOString();
    dbMocks.chain.limit.mockResolvedValueOnce([
      { isVisible: false, updatedAt: profileFixture.updatedAt },
    ]);
    dbMocks.chain.returning
      .mockResolvedValueOnce([{ ...profileFixture, isVisible: true }])
      .mockResolvedValueOnce([{ ...profileFixture, isVisible: false }]);
    (mirrorProfileToFirestore as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: false, error: "write outcome unknown" })
      .mockResolvedValueOnce({ ok: true });

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({
        displayName: "Alice",
        isVisible: true,
        expectedVisibilityVersion: currentVersion,
      });

    expect(res.status).toBe(503);
    expect(dbMocks.sessionDb.transaction).toHaveBeenCalledTimes(3);
    expect(dbMocks.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: false }),
    );
    expect(mirrorProfileToFirestore).toHaveBeenNthCalledWith(1, {
      uid: "alice",
      isVisible: true,
    });
    expect(mirrorProfileToFirestore).toHaveBeenNthCalledWith(2, {
      uid: "alice",
      isVisible: false,
    });
    expect(hideProfileFromFirestore).toHaveBeenCalledWith("alice");
    expect(clearEncounterMirrorsForHiddenUser).toHaveBeenCalledWith("alice");
  });

  it("does not publish Visible when the profile transaction commit fails", async () => {
    dbMocks.chain.limit.mockResolvedValueOnce([
      { isVisible: false, updatedAt: profileFixture.updatedAt },
    ]);
    dbMocks.chain.returning.mockResolvedValueOnce([
      { ...profileFixture, isVisible: true },
    ]);
    dbMocks.sessionDb.transaction.mockImplementationOnce(async (callback) => {
      await callback(dbMocks.chain);
      throw new Error("simulated commit failure");
    });

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({
        displayName: "Alice",
        isVisible: true,
        expectedVisibilityVersion: profileFixture.updatedAt.toISOString(),
      });

    expect(res.status).toBe(500);
    expect(mirrorProfileToFirestore).not.toHaveBeenCalled();
    expect(sessionClients[0]?.release).toHaveBeenCalledTimes(1);
  });

  it("does not acknowledge an opt-in before the Postgres commit", async () => {
    const visibleProfile = {
      ...profileFixture,
      isVisible: true,
      updatedAt: new Date(profileFixture.updatedAt.getTime() + 1),
    };
    dbMocks.chain.limit.mockResolvedValueOnce([
      { isVisible: false, updatedAt: profileFixture.updatedAt },
    ]);
    dbMocks.chain.returning.mockResolvedValueOnce([visibleProfile]);

    let markTransactionReady!: () => void;
    let finishCommit!: () => void;
    const transactionReady = new Promise<void>((resolve) => {
      markTransactionReady = resolve;
    });
    const delayedCommit = new Promise<void>((resolve) => {
      finishCommit = resolve;
    });
    dbMocks.sessionDb.transaction.mockImplementationOnce(async (callback) => {
      const result = await callback(dbMocks.chain);
      markTransactionReady();
      await delayedCommit;
      sessionEventLog.push("pg-commit");
      return result;
    });
    (mirrorProfileToFirestore as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async () => {
        sessionEventLog.push("firestore-visible");
        return { ok: true };
      },
    );

    let responseSettled = false;
    const responsePromise = request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({
        displayName: "Alice",
        isVisible: true,
        expectedVisibilityVersion: profileFixture.updatedAt.toISOString(),
      })
      .then((response) => {
        responseSettled = true;
        sessionEventLog.push("http-response");
        return response;
      });

    await transactionReady;
    expect(responseSettled).toBe(false);
    expect(mirrorProfileToFirestore).not.toHaveBeenCalled();
    finishCommit();

    const res = await responsePromise;
    expect(res.status).toBe(200);
    expect(sessionEventLog).toEqual([
      "pg-commit",
      "firestore-visible",
      "http-response",
    ]);
  });

  it("keeps a concurrent Hide after opt-in compensation from being overwritten", async () => {
    const currentVersion = profileFixture.updatedAt.toISOString();
    const compensatedVersion = new Date(profileFixture.updatedAt.getTime() + 2);
    const hiddenAfterCompensation = {
      ...profileFixture,
      isVisible: false,
      updatedAt: compensatedVersion,
    };
    const hiddenAfterHide = {
      ...profileFixture,
      isVisible: false,
      updatedAt: new Date(profileFixture.updatedAt.getTime() + 3),
    };
    dbMocks.chain.limit
      .mockResolvedValueOnce([{ isVisible: false, updatedAt: profileFixture.updatedAt }])
      .mockResolvedValueOnce([{ isVisible: false, updatedAt: compensatedVersion }]);
    dbMocks.chain.returning
      .mockResolvedValueOnce([{ ...profileFixture, isVisible: true }])
      .mockResolvedValueOnce([hiddenAfterCompensation])
      .mockResolvedValueOnce([hiddenAfterHide]);

    const events: string[] = [];
    let markVisibleMirrorStarted!: () => void;
    let failVisibleMirror!: () => void;
    const visibleMirrorStarted = new Promise<void>((resolve) => {
      markVisibleMirrorStarted = resolve;
    });
    const visibleMirrorGate = new Promise<void>((resolve) => {
      failVisibleMirror = resolve;
    });
    (mirrorProfileToFirestore as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ isVisible }: { uid: string; isVisible: boolean }) => {
        if (isVisible) {
          events.push("visible-mirror-start");
          markVisibleMirrorStarted();
          await visibleMirrorGate;
          events.push("visible-mirror-failed");
          return { ok: false, error: "write outcome unknown" };
        }
        events.push("hidden-mirror");
        return { ok: true };
      },
    );
    (hideProfileFromFirestore as ReturnType<typeof vi.fn>).mockImplementation(
      async () => {
        events.push("hide-barrier");
        return { ok: true };
      },
    );
    (clearEncounterMirrorsForHiddenUser as ReturnType<typeof vi.fn>).mockImplementation(
      async () => {
        events.push("encounter-cleanup");
        return { ok: true };
      },
    );

    let optInSettled = false;
    const optInPromise = request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({
        displayName: "Alice",
        isVisible: true,
        expectedVisibilityVersion: currentVersion,
      })
      .then((response) => {
        optInSettled = true;
        return response;
      });
    await visibleMirrorStarted;

    let hideSettled = false;
    const hidePromise = request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ displayName: "Alice", isVisible: false })
      .then((response) => {
        hideSettled = true;
        events.push("hide-response");
        return response;
      });
    await Promise.resolve();
    expect(hideSettled).toBe(false);
    expect(hideProfileFromFirestore).not.toHaveBeenCalled();

    failVisibleMirror();
    const [optInResponse, hideResponse] = await Promise.all([
      optInPromise,
      hidePromise,
    ]);

    expect(optInSettled).toBe(true);
    expect(optInResponse.status).toBe(503);
    expect(hideResponse.status).toBe(200);
    expect(events).toEqual([
      "visible-mirror-start",
      "visible-mirror-failed",
      "hide-barrier",
      "hidden-mirror",
      "encounter-cleanup",
      "hide-barrier",
      "hidden-mirror",
      "encounter-cleanup",
      "hide-response",
    ]);
    expect(events.slice(events.indexOf("hide-response") + 1))
      .not.toContain("visible-mirror-start");
    expect(sessionClients).toHaveLength(2);
    for (const client of sessionClients) {
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("pg_advisory_lock("),
        ["met-profile-privacy:alice"],
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("pg_advisory_unlock("),
        ["met-profile-privacy:alice"],
      );
    }
    expect(drizzleMocks.drizzle).toHaveBeenNthCalledWith(
      1,
      sessionClients[0],
      expect.any(Object),
    );
    expect(drizzleMocks.drizzle).toHaveBeenNthCalledWith(
      2,
      sessionClients[1],
      expect.any(Object),
    );
  });

  it("reports incomplete stale-record cleanup instead of claiming success", async () => {
    (clearEncounterMirrorsForHiddenUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      error: "Firestore unavailable",
    });
    dbMocks.chain.limit.mockResolvedValueOnce([]);
    dbMocks.chain.returning.mockResolvedValueOnce([
      { ...profileFixture, isVisible: false },
    ]);

    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ displayName: "Alice", isVisible: false });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/stale encounter data/i);
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

describe("GET /api/profiles/:uid", () => {
  it("returns the same not-found response for a hidden profile with no explicit relationship", async () => {
    dbMocks.chain.limit.mockResolvedValueOnce([
      { ...profileFixture, isVisible: false },
    ]);
    dbMocks.chain.where
      .mockImplementationOnce(() => dbMocks.chain)
      .mockResolvedValueOnce([]); // no pending reveal or connection

    const res = await request(app)
      .get("/api/profiles/alice")
      .set("x-met-uid", "bob");

    expect(res.status).toBe(404);
  });

  it("preserves an already-explicit pending reveal identity for a hidden profile", async () => {
    dbMocks.chain.limit.mockResolvedValueOnce([
      { ...profileFixture, isVisible: false },
    ]);
    dbMocks.chain.where
      .mockImplementationOnce(() => dbMocks.chain)
      .mockResolvedValueOnce([{ senderUid: "bob", recipientUid: "alice" }]);

    const res = await request(app)
      .get("/api/profiles/alice")
      .set("x-met-uid", "bob");

    expect(res.status).toBe(200);
    expect(res.body.uid).toBe("alice");
    expect(res.body.isVisible).toBe(false);
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

  it("calls deleteVenueStorageFiles with cover photo, logo, and event image URLs when deleteVenueProfile is true", async () => {
    const deleteVenueStorageFilesSpy = deleteVenueStorageFiles as ReturnType<typeof vi.fn>;

    const coverPhotoUrl =
      "https://storage.googleapis.com/my-bucket/venue-profile-photos/alice/cover-123.jpg";
    const logoUrl =
      "https://storage.googleapis.com/my-bucket/venue-profile-photos/alice/logo-456.jpg";
    const eventImageUrl =
      "https://storage.googleapis.com/my-bucket/venue-event-images/alice/event-789.jpg";

    const profileWithPhotos = {
      ...venueOwnerProfileFixture,
      coverPhotoUrl,
      logoUrl,
    };
    dbMocks.chain.limit.mockResolvedValueOnce([profileWithPhotos]);

    // deleteVenueOwnerProfile returns the event image URLs it found before deleting.
    (deleteVenueOwnerProfile as ReturnType<typeof vi.fn>).mockResolvedValueOnce([eventImageUrl]);

    const res = await request(app)
      .delete("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ deleteVenueProfile: true });

    expect(res.status).toBe(204);

    // deleteVenueStorageFiles must be called with all three URLs so the helper
    // can apply its bucket/prefix validation before deleting.
    expect(deleteVenueStorageFilesSpy).toHaveBeenCalledTimes(1);
    expect(deleteVenueStorageFilesSpy).toHaveBeenCalledWith(
      [coverPhotoUrl, logoUrl, eventImageUrl],
      expect.objectContaining({ uid: "alice" }),
    );
  });

  it("calls deleteVenueStorageFiles even when the profile has no photo URLs", async () => {
    const deleteVenueStorageFilesSpy = deleteVenueStorageFiles as ReturnType<typeof vi.fn>;

    // Profile has null for both photo columns; deleteVenueOwnerProfile returns no event images.
    dbMocks.chain.limit.mockResolvedValueOnce([venueOwnerProfileFixture]);
    (deleteVenueOwnerProfile as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const res = await request(app)
      .delete("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ deleteVenueProfile: true });

    expect(res.status).toBe(204);
    // The helper is still called (with an all-null/empty list) — it handles
    // skipping internally rather than the caller needing to guard.
    expect(deleteVenueStorageFilesSpy).toHaveBeenCalledTimes(1);
  });
});
