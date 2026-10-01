import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock handles — defined before vi.mock() factory runs.
// ---------------------------------------------------------------------------

const dbMocks = vi.hoisted(() => {
  const sessionDb = {
    transaction: vi.fn(),
  };
  const poolClient = {
    query: vi.fn(),
    release: vi.fn(),
  };
  const poolConnect = vi.fn();
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
    delete: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    execute: vi.fn(),
    transaction: vi.fn(),
  };
  return { chain, sessionDb, poolClient, poolConnect };
});

const drizzleMocks = vi.hoisted(() => ({
  drizzle: vi.fn(),
}));

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
  hideProfileFromFirestore: vi.fn().mockResolvedValue({ ok: true }),
  clearEncounterMirrorsForHiddenUser: vi.fn().mockResolvedValue({ ok: true }),
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
  pool: { connect: dbMocks.poolConnect },
  profilesTable: {},
  encountersTable: {},
  revealRequestsTable: {},
  subscriptionsTable: {},
  presenceTable: {},
}));

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: drizzleMocks.drizzle,
}));

vi.mock("../lib/firestoreMirror", () => ({
  mirrorProfileToFirestore: firestoreMirrorMocks.mirrorProfileToFirestore,
  hideProfileFromFirestore: firestoreMirrorMocks.hideProfileFromFirestore,
  clearEncounterMirrorsForHiddenUser:
    firestoreMirrorMocks.clearEncounterMirrorsForHiddenUser,
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
const profileFixture = {
  uid: "alice",
  displayName: "Alice",
  photoUrl: null,
  bio: null,
  socials: {},
  interests: [],
  isVisible: false,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

let transactionTail: Promise<void> = Promise.resolve();

async function runSerializedTransaction<T>(
  callback: (tx: typeof dbMocks.chain) => Promise<T>,
): Promise<T> {
  const previous = transactionTail;
  let release!: () => void;
  transactionTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await callback(dbMocks.chain);
  } finally {
    release();
  }
}

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
  dbMocks.chain.delete.mockReturnThis();
  dbMocks.chain.onConflictDoUpdate.mockReturnThis();
  // Default push behaviour: no-op send, rate-limit always denies.
  pushMocks.sendPush.mockResolvedValue(undefined);
  pushMocks.checkNearbyPushAllowed.mockReturnValue(false);
  // Default limit response: empty array so any unmatched DB lookup (e.g.
  // the push-token profile fetch added to POST /encounters) returns []
  // instead of undefined and causing a 500.
  dbMocks.chain.limit.mockResolvedValue([]);
  dbMocks.chain.execute.mockResolvedValue({ rows: [] });
  transactionTail = Promise.resolve();
  dbMocks.chain.transaction.mockImplementation(runSerializedTransaction);
  dbMocks.sessionDb.transaction.mockImplementation(runSerializedTransaction);
  dbMocks.poolConnect.mockImplementation(async () => dbMocks.poolClient);
  dbMocks.poolClient.query.mockResolvedValue({ rows: [] });
  dbMocks.poolClient.release.mockReset();
  drizzleMocks.drizzle.mockReturnValue(dbMocks.sessionDb);
  // Restore Firestore mirror impls wiped by resetAllMocks so routes that
  // call recordSymmetricEncounter don't hit the try/catch 502 path.
  firestoreMirrorMocks.mirrorProfileToFirestore.mockResolvedValue({ ok: true });
  firestoreMirrorMocks.hideProfileFromFirestore.mockResolvedValue({ ok: true });
  firestoreMirrorMocks.clearEncounterMirrorsForHiddenUser.mockResolvedValue({
    ok: true,
  });
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
  if (typeof body.observedUid === "string") {
    dbMocks.chain.where.mockResolvedValueOnce([
      { uid, isVisible: true },
      { uid: body.observedUid, isVisible: true },
    ]);
  }
  return request(app)
    .post("/api/encounters")
    .set("x-met-uid", uid)
    .send(body);
}

function postRecordEncounterAs(
  uid: string,
  body: Record<string, unknown>,
  otherOverrides: Record<string, unknown> = {},
  observerIsVisible = true,
) {
  if (typeof body.otherUid === "string") {
    dbMocks.chain.where.mockResolvedValueOnce([
      {
        uid,
        isVisible: observerIsVisible,
      },
      {
        uid: body.otherUid,
        isVisible: true,
        pushToken: null,
        interests: [],
        preferredLocale: null,
        displayName: "Peer",
        notificationPrefs: null,
        ...otherOverrides,
      },
    ]);
  }
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

  it("rejects attempts to record a hidden peer as a new encounter", async () => {
    dbMocks.chain.where.mockResolvedValueOnce([
      { uid: "alice", isVisible: true },
      { uid: "bob", isVisible: false },
    ]);

    const res = await postEncounterAs("alice", { observedUid: "bob" });

    expect(res.status).toBe(404);
    expect(dbMocks.chain.insert).not.toHaveBeenCalled();
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

    it("rejects both a hidden observer and a hidden target without writing a mirror", async () => {
      const hiddenTarget = await postRecordEncounterAs(
        "alice",
        { otherUid: "bob" },
        { isVisible: false },
      );
      expect(hiddenTarget.status).toBe(404);
      expect(firestoreMirrorMocks.recordSymmetricEncounter).not.toHaveBeenCalled();

      const hiddenObserver = await postRecordEncounterAs(
        "alice",
        { otherUid: "bob" },
        {},
        false,
      );
      expect(hiddenObserver.status).toBe(404);
      expect(firestoreMirrorMocks.recordSymmetricEncounter).not.toHaveBeenCalled();
      expect(pushMocks.sendPush).not.toHaveBeenCalled();
    });

    it("sends a generic push body when there are no shared interests", async () => {
      pushMocks.checkNearbyPushAllowed.mockReturnValueOnce(true);

      dbMocks.chain.limit
        .mockResolvedValueOnce([])  // tier lookup: both free
        .mockResolvedValueOnce([])  // re-encounter check: not connected
        .mockResolvedValueOnce([{ interests: [] }]);  // caller profile: no interests → no overlap

      await postRecordEncounterAs(
        "alice",
        { otherUid: "bob" },
        { pushToken: "tok-bob", interests: ["Music"] },
      );

      expect(pushMocks.sendPush).toHaveBeenCalledWith(
        "tok-bob",
        expect.objectContaining({ body: "You've crossed paths with someone." }),
      );
    });

    it("sends a shared-interest push body when interests overlap (English recipient)", async () => {
      pushMocks.checkNearbyPushAllowed.mockReturnValueOnce(true);

      dbMocks.chain.limit
        .mockResolvedValueOnce([])  // tier lookup: both free
        .mockResolvedValueOnce([])  // re-encounter check: not connected
        .mockResolvedValueOnce([{ interests: ["Travel", "Yoga"] }]);  // "Travel" is shared

      await postRecordEncounterAs(
        "alice",
        { otherUid: "bob" },
        { pushToken: "tok-bob", interests: ["Music", "Travel"] },
      );

      expect(pushMocks.sendPush).toHaveBeenCalledWith(
        "tok-bob",
        expect.objectContaining({ body: expect.stringContaining("Travel") }),
      );
    });

    it("sends the shared-interest label in the recipient's language", async () => {
      pushMocks.checkNearbyPushAllowed.mockReturnValueOnce(true);

      // Bob prefers Spanish — "Travel" should appear as "Viajes" in the notification.
      dbMocks.chain.limit
        .mockResolvedValueOnce([])  // tier lookup: both free
        .mockResolvedValueOnce([])  // re-encounter check: not connected
        .mockResolvedValueOnce([{ interests: ["Travel", "Yoga"] }]);

      await postRecordEncounterAs(
        "alice",
        { otherUid: "bob" },
        {
          pushToken: "tok-bob",
          interests: ["Music", "Travel"],
          preferredLocale: "es",
        },
      );

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
        .mockResolvedValueOnce([])  // tier lookup: both free
        .mockResolvedValueOnce([])  // re-encounter check: not connected
        .mockResolvedValueOnce([{ interests: ["Music"] }]);

      await postRecordEncounterAs(
        "alice",
        { otherUid: "bob" },
        { pushToken: "tok-bob", interests: ["music"] },
      );

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

describe("cross-process privacy serialization", () => {
  it("finishes a delayed symmetric encounter before Hide clears discovery data", async () => {
    const events: string[] = [];
    let markEncounterStarted!: () => void;
    let finishEncounter!: () => void;
    let markPushStarted!: () => void;
    let finishPush!: () => void;
    const encounterStarted = new Promise<void>((resolve) => {
      markEncounterStarted = resolve;
    });
    const delayedEncounter = new Promise<void>((resolve) => {
      finishEncounter = resolve;
    });
    const pushStarted = new Promise<void>((resolve) => {
      markPushStarted = resolve;
    });
    const delayedPush = new Promise<void>((resolve) => {
      finishPush = resolve;
    });
    firestoreMirrorMocks.recordSymmetricEncounter.mockImplementationOnce(
      async () => {
        events.push("encounter-start");
        markEncounterStarted();
        await delayedEncounter;
        events.push("encounter-finished");
        return {
          otherUid: "bob",
          metCount: 1,
          lastMet: new Date("2024-01-01T00:00:00Z"),
        };
      },
    );
    firestoreMirrorMocks.hideProfileFromFirestore.mockImplementationOnce(
      async () => {
        events.push("hide-mirror");
        return { ok: true };
      },
    );
    firestoreMirrorMocks.clearEncounterMirrorsForHiddenUser.mockImplementationOnce(
      async () => {
        events.push("hide-cleanup");
        return { ok: true };
      },
    );
    pushMocks.checkNearbyPushAllowed.mockReturnValue(true);
    pushMocks.sendPush.mockImplementationOnce(async () => {
      events.push("push-start");
      markPushStarted();
      await delayedPush;
      events.push("push-finished");
    });
    dbMocks.chain.limit
      .mockResolvedValueOnce([]) // encounter subscription tier lookup
      .mockResolvedValueOnce([
        { isVisible: true, updatedAt: profileFixture.updatedAt },
      ]) // profile version/state read by Hide
      .mockResolvedValueOnce([]); // accepted reveal lookup after mirror write
    dbMocks.chain.returning.mockResolvedValueOnce([
      { ...profileFixture, isVisible: false },
    ]);

    const encounterRequest = postRecordEncounterAs(
      "alice",
      { otherUid: "bob" },
      { pushToken: "peer-push-token" },
    ).then((response) => response);
    await encounterStarted;

    let hideSettled = false;
    const hideRequest = request(app)
      .put("/api/profiles/me")
      .set("x-met-uid", "alice")
      .send({ displayName: "Alice", isVisible: false })
      .then((response) => {
        hideSettled = true;
        return response;
      });

    await Promise.resolve();
    expect(hideSettled).toBe(false);
    expect(firestoreMirrorMocks.hideProfileFromFirestore).not.toHaveBeenCalled();

    finishEncounter();
    await pushStarted;
    await Promise.resolve();
    expect(hideSettled).toBe(false);
    expect(firestoreMirrorMocks.hideProfileFromFirestore).not.toHaveBeenCalled();
    finishPush();
    const [encounterResponse, hideResponse] = await Promise.all([
      encounterRequest,
      hideRequest,
    ]);

    expect(encounterResponse.status).toBe(200);
    expect(hideResponse.status).toBe(200);
    expect(events).toEqual([
      "encounter-start",
      "encounter-finished",
      "push-start",
      "push-finished",
      "hide-mirror",
      "hide-cleanup",
    ]);
    // Encounter uses both xact locks; profile update uses the same session
    // lock key on the same checked-out client that owns its Drizzle transaction.
    expect(dbMocks.chain.execute).toHaveBeenCalledTimes(2);
    expect(dbMocks.poolClient.query).toHaveBeenCalledTimes(2);
    expect(drizzleMocks.drizzle).toHaveBeenCalledWith(
      dbMocks.poolClient,
      expect.any(Object),
    );
    expect(dbMocks.poolClient.release).toHaveBeenCalledTimes(1);
  });
});
