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
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return { chain };
});

// Hoisted push mock refs — captured before vi.mock runs so the factory can
// reference them AND tests can call mockReturnValueOnce directly without a
// dynamic import (which can have subtle ordering issues in Vitest).
const pushMocks = vi.hoisted(() => ({
  sendPush: vi.fn().mockResolvedValue(undefined),
  checkNearbyPushAllowed: vi.fn().mockReturnValue(false),
}));

// Hoisted Firestore mirror mock refs — needed so resetAllMocks() in beforeEach
// doesn't wipe the implementations (recordSymmetricEncounter result is used in
// the route response, so a lost impl causes a try/catch 502 before push runs).
const firestoreMirrorMocks = vi.hoisted(() => ({
  mirrorProfileToFirestore: vi.fn().mockResolvedValue(undefined),
  recordSymmetricEncounter: vi.fn().mockResolvedValue({
    otherUid: "bob",
    metCount: 1,
    lastMet: new Date("2024-01-01T00:00:00Z"),
  }),
  mirrorRevealRequest: vi.fn().mockResolvedValue(undefined),
  mirrorRevealStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  profilesTable: {},
  encountersTable: {},
  revealRequestsTable: {},
  subscriptionsTable: {},
}));

vi.mock("../lib/firestoreMirror", () => ({
  mirrorProfileToFirestore: firestoreMirrorMocks.mirrorProfileToFirestore,
  recordSymmetricEncounter: firestoreMirrorMocks.recordSymmetricEncounter,
  mirrorRevealRequest: firestoreMirrorMocks.mirrorRevealRequest,
  mirrorRevealStatus: firestoreMirrorMocks.mirrorRevealStatus,
}));

// Suppress outbound push notifications — sendPush calls the Expo Push API
// over the network, which is irrelevant to route logic tests.
vi.mock("../lib/push", () => ({
  sendPush: pushMocks.sendPush,
  checkNearbyPushAllowed: pushMocks.checkNearbyPushAllowed,
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

const encounterFixture = {
  id: 1,
  observerUid: "alice",
  observedUid: "bob",
  firstSeenAt: new Date("2024-01-01T00:00:00Z"),
  lastSeenAt: new Date("2024-01-01T00:00:00Z"),
  encounterCount: 1,
  lastRssi: null,
};

// ---------------------------------------------------------------------------
// Ensure no real Redis connection is attempted.
// ---------------------------------------------------------------------------

beforeAll(() => {
  delete process.env["REDIS_URL"];
});

beforeEach(() => {
  // resetAllMocks clears both call history AND the once-queue so no
  // unconsumed mockResolvedValueOnce/mockReturnValueOnce calls bleed
  // across tests (clearAllMocks only clears call history, not the queue).
  vi.resetAllMocks();
  // Restore chainable returns after resetAllMocks wipes them.
  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockReturnThis();
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.insert.mockReturnThis();
  dbMocks.chain.values.mockReturnThis();
  dbMocks.chain.update.mockReturnThis();
  dbMocks.chain.set.mockReturnThis();
  // Default push behaviour: no-op send, rate-limit always denies.
  pushMocks.sendPush.mockResolvedValue(undefined);
  pushMocks.checkNearbyPushAllowed.mockReturnValue(false);
  // Default limit response: empty array so any unmatched DB lookup (e.g.
  // the push-token profile fetch added to POST /encounters) returns []
  // instead of undefined and causing a 500.
  dbMocks.chain.limit.mockResolvedValue([]);
  // Restore Firestore mirror impls wiped by resetAllMocks so routes that
  // call recordSymmetricEncounter don't hit the try/catch 502 path.
  firestoreMirrorMocks.mirrorProfileToFirestore.mockResolvedValue(undefined);
  firestoreMirrorMocks.recordSymmetricEncounter.mockResolvedValue({
    otherUid: "bob",
    metCount: 1,
    lastMet: new Date("2024-01-01T00:00:00Z"),
  });
  firestoreMirrorMocks.mirrorRevealRequest.mockResolvedValue(undefined);
  firestoreMirrorMocks.mirrorRevealStatus.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function postEncounterAs(uid: string, body: Record<string, unknown>) {
  return request(app)
    .post("/api/encounters")
    .set("x-met-uid", uid)
    .send(body);
}

function postRecordEncounterAs(uid: string, body: Record<string, unknown>) {
  return request(app)
    .post("/api/encounters/record")
    .set("x-met-uid", uid)
    .send(body);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/encounters", () => {
  describe("authentication", () => {
    it("returns 401 when no auth header or x-met-uid is provided", async () => {
      const res = await request(app)
        .post("/api/encounters")
        .send({ observedUid: "bob" });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("input validation", () => {
    it("returns 400 when observedUid is missing from the body", async () => {
      const res = await postEncounterAs("alice", {});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
    });

    it("returns 400 when the caller tries to log an encounter with themselves", async () => {
      const res = await postEncounterAs("alice", { observedUid: "alice" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toMatch(/self/i);
    });
  });

  describe("successful creation", () => {
    it("returns 200 with the encounter row when a new encounter is created", async () => {
      // No existing encounter found → insert path.
      dbMocks.chain.limit.mockResolvedValueOnce([]);
      dbMocks.chain.returning.mockResolvedValueOnce([encounterFixture]);

      const res = await postEncounterAs("alice", { observedUid: "bob" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        observerUid: "alice",
        observedUid: "bob",
        encounterCount: 1,
      });
    });

    it("returns 200 and bumps encounterCount when the same pair meets again after the dedup window", async () => {
      // Existing encounter with a lastSeenAt far in the past (> 10 minutes).
      const oldEncounter = {
        ...encounterFixture,
        lastSeenAt: new Date(Date.now() - 15 * 60 * 1000),
        encounterCount: 1,
      };
      const updatedEncounter = { ...oldEncounter, encounterCount: 2 };

      dbMocks.chain.limit.mockResolvedValueOnce([oldEncounter]);
      dbMocks.chain.returning.mockResolvedValueOnce([updatedEncounter]);

      const res = await postEncounterAs("alice", { observedUid: "bob" });

      expect(res.status).toBe(200);
      expect(res.body.encounterCount).toBe(2);
    });

    it("returns 200 and does NOT bump encounterCount within the dedup window", async () => {
      // Existing encounter seen 2 minutes ago → still within the 10-minute window.
      const recentEncounter = {
        ...encounterFixture,
        lastSeenAt: new Date(Date.now() - 2 * 60 * 1000),
        encounterCount: 3,
      };
      const unchangedEncounter = { ...recentEncounter };

      dbMocks.chain.limit.mockResolvedValueOnce([recentEncounter]);
      dbMocks.chain.returning.mockResolvedValueOnce([unchangedEncounter]);

      const res = await postEncounterAs("alice", { observedUid: "bob" });

      expect(res.status).toBe(200);
      expect(res.body.encounterCount).toBe(3);
    });
  });

  describe("interest-aware push notifications (POST /encounters/record)", () => {
    // The push logic lives on the /record endpoint which uses Firestore for the
    // encounter write (recordSymmetricEncounter) then pushes to the other user.
    // DB limit calls on this route:
    //   1. profilesTable lookup for other user (isVisible + pushToken + interests)
    //   2. profilesTable lookup for caller interests (only when other has interests)

    // DB limit call ordering for POST /api/encounters/record:
    //   call 1: profilesTable — other user lookup (isVisible + pushToken + interests)
    //   call 2: subscriptionsTable — tier lookup for both users (limit 2)
    //   call 3: revealRequestsTable — re-encounter check (limit 1)
    //   call 4: profilesTable — caller interests or display name (only when push fires)

    it("sends a generic push body when there are no shared interests", async () => {
      pushMocks.checkNearbyPushAllowed.mockReturnValueOnce(true);

      dbMocks.chain.limit
        .mockResolvedValueOnce([{ uid: "bob", isVisible: true, pushToken: "tok-bob", interests: ["Music"] }])
        .mockResolvedValueOnce([])  // tier lookup: both free
        .mockResolvedValueOnce([])  // re-encounter check: not connected
        .mockResolvedValueOnce([{ interests: [] }]);  // caller profile: no interests → no overlap

      await postRecordEncounterAs("alice", { otherUid: "bob" });

      expect(pushMocks.sendPush).toHaveBeenCalledWith(
        "tok-bob",
        expect.objectContaining({ body: "You've crossed paths with someone." }),
      );
    });

    it("sends a shared-interest push body when interests overlap (English recipient)", async () => {
      pushMocks.checkNearbyPushAllowed.mockReturnValueOnce(true);

      dbMocks.chain.limit
        .mockResolvedValueOnce([{ uid: "bob", isVisible: true, pushToken: "tok-bob", interests: ["Music", "Travel"], preferredLocale: null }])
        .mockResolvedValueOnce([])  // tier lookup: both free
        .mockResolvedValueOnce([])  // re-encounter check: not connected
        .mockResolvedValueOnce([{ interests: ["Travel", "Yoga"] }]);  // "Travel" is shared

      await postRecordEncounterAs("alice", { otherUid: "bob" });

      expect(pushMocks.sendPush).toHaveBeenCalledWith(
        "tok-bob",
        expect.objectContaining({ body: expect.stringContaining("Travel") }),
      );
    });

    it("sends the shared-interest label in the recipient's language", async () => {
      pushMocks.checkNearbyPushAllowed.mockReturnValueOnce(true);

      // Bob prefers Spanish — "Travel" should appear as "Viajes" in the notification.
      dbMocks.chain.limit
        .mockResolvedValueOnce([{ uid: "bob", isVisible: true, pushToken: "tok-bob", interests: ["Music", "Travel"], preferredLocale: "es" }])
        .mockResolvedValueOnce([])  // tier lookup: both free
        .mockResolvedValueOnce([])  // re-encounter check: not connected
        .mockResolvedValueOnce([{ interests: ["Travel", "Yoga"] }]);

      await postRecordEncounterAs("alice", { otherUid: "bob" });

      expect(pushMocks.sendPush).toHaveBeenCalledWith(
        "tok-bob",
        expect.objectContaining({ body: expect.stringContaining("Viajes") }),
      );
    });

    it("matches interests case-insensitively", async () => {
      pushMocks.checkNearbyPushAllowed.mockReturnValueOnce(true);

      // Other user stores "music" in lower-case (legacy); caller has "Music" (title-case).
      // The normalised comparison should still detect the overlap.
      dbMocks.chain.limit
        .mockResolvedValueOnce([{ uid: "bob", isVisible: true, pushToken: "tok-bob", interests: ["music"] }])
        .mockResolvedValueOnce([])  // tier lookup: both free
        .mockResolvedValueOnce([])  // re-encounter check: not connected
        .mockResolvedValueOnce([{ interests: ["Music"] }]);

      await postRecordEncounterAs("alice", { otherUid: "bob" });

      expect(pushMocks.sendPush).toHaveBeenCalledWith(
        "tok-bob",
        expect.objectContaining({ body: expect.stringMatching(/also likes/i) }),
      );
    });

    it("passes active Plus tier to recordSymmetricEncounter as tierA for the caller", async () => {
      // Alice is a Plus subscriber; Bob has no active subscription.
      // DB limit call ordering for this test (no push — pushToken is null):
      //   call 1: profilesTable — other profile lookup
      //   call 2: subscriptionsTable — tier lookup (alice=plus, bob missing → free)
      //   call 3: revealRequestsTable — re-encounter check
      dbMocks.chain.limit
        .mockResolvedValueOnce([{ uid: "bob", isVisible: true, pushToken: null, interests: [] }])
        .mockResolvedValueOnce([{ userUid: "alice", tier: "plus", status: "active" }])
        .mockResolvedValueOnce([]);  // re-encounter check

      await postRecordEncounterAs("alice", { otherUid: "bob" });

      expect(firestoreMirrorMocks.recordSymmetricEncounter).toHaveBeenCalledWith(
        expect.objectContaining({ tierA: "plus", tierB: "free" }),
      );
    });

    it("passes active Pro tier to recordSymmetricEncounter on the observed side", async () => {
      // Bob is a Pro subscriber; Alice has no active subscription.
      // DB limit call ordering:
      //   call 1: profilesTable — other profile lookup
      //   call 2: subscriptionsTable — tier lookup (bob=pro, alice missing → free)
      //   call 3: revealRequestsTable — re-encounter check
      dbMocks.chain.limit
        .mockResolvedValueOnce([{ uid: "bob", isVisible: true, pushToken: null, interests: [] }])
        .mockResolvedValueOnce([{ userUid: "bob", tier: "pro", status: "active" }])
        .mockResolvedValueOnce([]);  // re-encounter check

      await postRecordEncounterAs("alice", { otherUid: "bob" });

      expect(firestoreMirrorMocks.recordSymmetricEncounter).toHaveBeenCalledWith(
        expect.objectContaining({ tierA: "free", tierB: "pro" }),
      );
    });
  });

  describe("rate limiting (30 req/min per user)", () => {
    it("allows the first 30 requests and blocks the 31st with 429 and Retry-After", async () => {
      const uid = "uid-encounter-rl-test";

      // All selects return no existing encounter; all inserts return the fixture.
      dbMocks.chain.limit.mockResolvedValue([]);
      dbMocks.chain.returning.mockResolvedValue([encounterFixture]);

      for (let i = 1; i <= 30; i++) {
        const res = await postEncounterAs(uid, { observedUid: `peer-${i}` });
        expect(res.status).toBe(200);
      }

      const blocked = await postEncounterAs(uid, { observedUid: "peer-31" });

      expect(blocked.status).toBe(429);
      expect(blocked.body).toHaveProperty("message");
      expect(blocked.body.message).toMatch(/too many requests/i);

      const retryAfter = Number(blocked.headers["retry-after"]);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });
  });
});
