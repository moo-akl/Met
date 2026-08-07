/**
 * Venue Admin review workspace — route coverage.
 *
 * Focus is the reviewer-facing contract: only the session-backed API is
 * reachable, the queue only offers genuinely actionable applications, a
 * repeated or concurrent decision cannot overwrite a newer one, and internal
 * reviewer notes never leak into applicant-facing responses.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env["ADMIN_SECRET"] = "test-admin-bootstrap";
process.env["SESSION_SECRET"] = "test-session-secret";

/**
 * Spy on drizzle-orm's `eq` so individual tests can assert that the correct
 * equality predicate is constructed (e.g. eq("applicationSource", "mobile")).
 * The spy calls through to the real implementation so nothing else breaks.
 */
const eqSpy = vi.hoisted(() => vi.fn());
vi.mock("drizzle-orm", async (importActual) => {
  const actual = await importActual<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (...args: Parameters<typeof actual.eq>) => {
      eqSpy(...args);
      return actual.eq(...args);
    },
  };
});

const dbMocks = vi.hoisted(() => {
  /**
   * The admin credential table gets its own stateful mini-store so its
   * queries never consume the sequential mocks meant for application
   * queries (which caused ordering collisions between session checks and
   * per-test fixtures).
   */
  const credTable = {
    id: "id",
    passwordHash: "passwordHash",
    sessionVersion: "sessionVersion",
    lastLoginAt: "lastLoginAt",
    passwordChangedAt: "passwordChangedAt",
    failedLoginAttempts: "failedLoginAttempts",
    lockedUntil: "lockedUntil",
    updatedAt: "updatedAt",
  };
  const credState: { rows: Array<Record<string, unknown>>; pendingWrite: Record<string, unknown> | null } = {
    rows: [],
    pendingWrite: null,
  };
  const credChain: Record<string, ReturnType<typeof vi.fn>> = {} as never;
  credChain["where"] = vi.fn(() => credChain);
  credChain["limit"] = vi.fn(async () => credState.rows.map((r) => ({ ...r })));
  credChain["values"] = vi.fn((row: Record<string, unknown>) => {
    credState.pendingWrite = row;
    return credChain;
  });
  credChain["set"] = vi.fn((row: Record<string, unknown>) => {
    if (credState.rows[0]) Object.assign(credState.rows[0], row);
    return credChain;
  });
  credChain["returning"] = vi.fn(async () => {
    if (credState.pendingWrite) {
      const row = {
        id: 1,
        sessionVersion: 1,
        passwordChangedAt: new Date(),
        lastLoginAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...credState.pendingWrite,
      };
      credState.pendingWrite = null;
      credState.rows = [row];
    }
    return credState.rows.map((r) => ({ ...r }));
  });
  /**
   * The venue business/membership tables get a dedicated chain so the
   * approval bootstrap (business + owner membership + audit inserts) never
   * consumes the sequential mocks meant for application queries.
   */
  const bizTable = { id: "bizId", venueOwnerProfileId: "venueOwnerProfileId" };
  const bizChain: Record<string, ReturnType<typeof vi.fn>> = {} as never;
  bizChain["values"] = vi.fn(() => bizChain);
  bizChain["onConflictDoNothing"] = vi.fn(() => bizChain);
  bizChain["where"] = vi.fn(() => bizChain);
  bizChain["limit"] = vi.fn(async () => [{ id: 1 }]);
  bizChain["returning"] = vi.fn(async () => [{ id: 1 }]);
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn(),
    groupBy: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    transaction: vi.fn(),
  };
  return { chain, credChain, credState, credTable, bizChain, bizTable };
});

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  venueOwnerProfilesTable: {
    id: "id",
    ownerUid: "ownerUid",
    placeId: "placeId",
    applicationStatus: "applicationStatus",
    applicationSource: "applicationSource",
    submittedAt: "submittedAt",
    createdAt: "createdAt",
  },
  venueApplicationHistoryTable: {
    id: "id",
    venueOwnerProfileId: "venueOwnerProfileId",
    eventType: "eventType",
    fromStatus: "fromStatus",
    toStatus: "toStatus",
    actorRole: "actorRole",
    actorUid: "actorUid",
    applicantMessage: "applicantMessage",
    internalNote: "internalNote",
    metadata: "metadata",
    createdAt: "createdAt",
  },
  venueAdminCredentialsTable: dbMocks.credTable,
  venueBusinessesTable: dbMocks.bizTable,
  venueMembershipsTable: dbMocks.bizTable,
  venueMembershipAuditTable: dbMocks.bizTable,
  venueEventsTable: {},
  venueEventRsvpsTable: {},
  venueRewardsTable: {},
  venueAnnouncementsTable: {},
  hubCheckinsTable: {},
  profilesTable: {},
}));

vi.mock("../middlewares/requireUid", () => ({
  requireUid: (req: { uid?: string }, _res: unknown, next: () => void) => {
    req.uid = "venue-owner-uid";
    next();
  },
}));

vi.mock("../middlewares/rateLimit", () => ({
  createUserRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createIpRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const pushMock = vi.fn().mockResolvedValue(undefined);
vi.mock("../lib/push", () => ({ sendPush: (...args: unknown[]) => pushMock(...args) }));

import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import venueOwnerRouter from "./venueOwner";

const app = express();
app.use(express.json());
app.use(cookieParser(process.env["SESSION_SECRET"]));
app.use("/api", venueOwnerRouter);

type Status =
  | "submitted"
  | "under_review"
  | "resubmitted"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "expired";

function application(
  overrides: { id?: number; applicationStatus?: Status; applicationSource?: string | null } = {},
) {
  return {
    id: overrides.id ?? 7,
    ownerUid: "venue-owner-uid",
    placeId: "google-place-1",
    placeName: "The Corner",
    businessName: "Corner Social",
    lat: "40.7128",
    lng: "-74.006",
    tagline: null,
    description: null,
    coverPhotoUrl: null,
    logoUrl: null,
    verificationDocUrl: "https://example.com/proof.pdf",
    registrationNotes: null,
    isApproved: false,
    isVerified: false,
    rejectionReason: null,
    applicationStatus: overrides.applicationStatus ?? "submitted",
    applicationSource: "applicationSource" in overrides ? overrides.applicationSource : null,
    submittedAt: new Date("2026-07-01T10:00:00.000Z"),
    reviewedAt: null,
    approvedAt: null,
    rejectedAt: null,
    withdrawnAt: null,
    expiredAt: null,
    createdAt: new Date("2026-07-01T10:00:00.000Z"),
    updatedAt: new Date("2026-07-01T10:00:00.000Z"),
  };
}

/** Builds a signed cookie through setup, then returns its supertest agent. */
async function signedInAgent() {
  const agent = request.agent(app);
  const res = await agent.post("/api/admin/venue-owner/setup").send({
    bootstrapCode: "test-admin-bootstrap",
    password: "SecurePassword1",
  });
  expect(res.status).toBe(200);
  return agent;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.credState.rows = [];
  dbMocks.credState.pendingWrite = null;
  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockImplementation((table: unknown) =>
    table === dbMocks.credTable
      ? dbMocks.credChain
      : table === dbMocks.bizTable
        ? dbMocks.bizChain
        : dbMocks.chain,
  );
  dbMocks.chain.insert.mockImplementation((table: unknown) =>
    table === dbMocks.credTable
      ? dbMocks.credChain
      : table === dbMocks.bizTable
        ? dbMocks.bizChain
        : dbMocks.chain,
  );
  dbMocks.chain.update.mockImplementation((table: unknown) =>
    table === dbMocks.credTable ? dbMocks.credChain : dbMocks.chain,
  );
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.set.mockReturnThis();
  dbMocks.chain.values.mockReturnThis();
  dbMocks.chain.orderBy.mockResolvedValue([]);
  dbMocks.chain.groupBy.mockResolvedValue([]);
  dbMocks.chain.limit.mockResolvedValue([]);
  dbMocks.chain.returning.mockResolvedValue([]);
  dbMocks.chain.transaction.mockImplementation(
    async (cb: (tx: typeof dbMocks.chain) => unknown) => cb(dbMocks.chain),
  );
});

describe("admin session authorization", () => {
  const guarded: Array<[string, string]> = [
    ["get", "/api/admin/venue-owner/applications"],
    ["get", "/api/admin/venue-owner/applications/7"],
    ["post", "/api/admin/venue-owner/applications/7/start-review"],
    ["post", "/api/admin/venue-owner/applications/7/approve"],
    ["post", "/api/admin/venue-owner/applications/7/reject"],
    ["post", "/api/admin/venue-owner/applications/7/request-changes"],
    ["post", "/api/admin/venue-owner/applications/7/withdraw"],
    ["post", "/api/admin/venue-owner/applications/7/notes"],
  ];

  it.each(guarded)("rejects %s %s without a session", async (method, path) => {
    const res = await (method === "get"
      ? request(app).get(path)
      : request(app).post(path).send({ reason: "not ok", message: "fix it", internalNote: "x" }));
    expect(res.status).toBe(401);
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
  });

  it("reports first-time setup before a password exists", async () => {
    const res = await request(app).get("/api/admin/venue-owner/setup");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ setupRequired: true, serverConfigured: true });
  });

  it("creates a password hash during setup without returning password material", async () => {
    const res = await request(app).post("/api/admin/venue-owner/setup").send({
      bootstrapCode: "test-admin-bootstrap",
      password: "SecurePassword1",
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ authenticated: true }));
    expect(JSON.stringify(res.body)).not.toContain("password");
    expect(dbMocks.credChain["values"]).toHaveBeenCalledWith(expect.objectContaining({
      passwordHash: expect.stringMatching(/^scrypt\$/),
    }));
  });

  it("refuses an invalid bootstrap code without issuing a cookie", async () => {
    const res = await request(app)
      .post("/api/admin/venue-owner/setup")
      .send({ bootstrapCode: "wrong-code", password: "SecurePassword1" });
    expect(res.status).toBe(401);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("refuses sign-in until a password is configured", async () => {
    const res = await request(app).post("/api/admin/venue-owner/session").send({ password: "SecurePassword1" });
    expect(res.status).toBe(428);
  });

  it("does not accept the retired header-secret review endpoints", async () => {
    const res = await request(app)
      .get("/api/admin/venue-owner/pending")
      .set("x-admin-secret", "test-admin-secret");
    expect(res.status).toBe(404);
  });

  it("logs out by clearing the HttpOnly session cookie", async () => {
    const agent = await signedInAgent();
    const res = await agent.delete("/api/admin/venue-owner/session");
    expect(res.status).toBe(204);
    const protectedRes = await agent.get("/api/admin/venue-owner/applications");
    expect(protectedRes.status).toBe(401);
  });
});

describe("password lifecycle", () => {
  it("rejects weak passwords during setup", async () => {
    const res = await request(app).post("/api/admin/venue-owner/setup").send({
      bootstrapCode: "test-admin-bootstrap",
      password: "short",
    });
    expect(res.status).toBe(401);
  });

  it("rejects recovery when no password has ever been set", async () => {
    const res = await request(app).post("/api/admin/venue-owner/password/recover").send({
      bootstrapCode: "test-admin-bootstrap",
      newPassword: "AnotherSecure1",
    });
    expect(res.status).toBe(428);
  });

  it("signs in with the configured password and rejects the wrong one", async () => {
    await signedInAgent(); // configures the stored credential

    const wrong = await request(app).post("/api/admin/venue-owner/session")
      .send({ password: "NotThePassword1" });
    expect(wrong.status).toBe(401);
    expect(wrong.headers["set-cookie"]).toBeUndefined();

    const agent = request.agent(app);
    const ok = await agent.post("/api/admin/venue-owner/session")
      .send({ password: "SecurePassword1" });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual(expect.objectContaining({ authenticated: true }));
    const guarded = await agent.get("/api/admin/venue-owner/applications");
    expect(guarded.status).toBe(200);
  });

  it("changing the password revokes other active sessions", async () => {
    const changer = await signedInAgent();
    const bystander = request.agent(app);
    const login = await bystander.post("/api/admin/venue-owner/session")
      .send({ password: "SecurePassword1" });
    expect(login.status).toBe(200);

    const rejected = await changer.post("/api/admin/venue-owner/password")
      .send({ currentPassword: "WrongCurrent1", newPassword: "BrandNewSecret1" });
    expect(rejected.status).toBe(401);

    const changed = await changer.post("/api/admin/venue-owner/password")
      .send({ currentPassword: "SecurePassword1", newPassword: "BrandNewSecret1" });
    expect(changed.status).toBe(200);

    // The bystander's cookie carries the old session version.
    const stale = await bystander.get("/api/admin/venue-owner/applications");
    expect(stale.status).toBe(401);
    // The changer received a rotated cookie and keeps working.
    const fresh = await changer.get("/api/admin/venue-owner/applications");
    expect(fresh.status).toBe(200);
    // Only the new password signs in now.
    const oldLogin = await request(app).post("/api/admin/venue-owner/session")
      .send({ password: "SecurePassword1" });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post("/api/admin/venue-owner/session")
      .send({ password: "BrandNewSecret1" });
    expect(newLogin.status).toBe(200);
  });

  it("recovery resets the password and revokes existing sessions", async () => {
    const agent = await signedInAgent();
    const res = await request(app).post("/api/admin/venue-owner/password/recover").send({
      bootstrapCode: "test-admin-bootstrap",
      newPassword: "RecoveredSecret1",
    });
    expect(res.status).toBe(204);

    const stale = await agent.get("/api/admin/venue-owner/applications");
    expect(stale.status).toBe(401);
    const login = await request(app).post("/api/admin/venue-owner/session")
      .send({ password: "RecoveredSecret1" });
    expect(login.status).toBe(200);
  });

  it("refuses a second setup once a password exists", async () => {
    await signedInAgent();
    const res = await request(app).post("/api/admin/venue-owner/setup").send({
      bootstrapCode: "test-admin-bootstrap",
      password: "AnotherSecure1",
    });
    expect(res.status).toBe(409);
  });

  it("wrong currentPassword on password-change increments the failed-attempts counter", async () => {
    const agent = await signedInAgent();
    const res = await agent.post("/api/admin/venue-owner/password")
      .send({ currentPassword: "WrongPassword1", newPassword: "BrandNewSecret1" });
    expect(res.status).toBe(401);
    // credChain.set is called with the incremented counter
    expect(dbMocks.credChain["set"]).toHaveBeenCalledWith(
      expect.objectContaining({ failedLoginAttempts: 1, lockedUntil: null }),
    );
  });

  it("password-change endpoint locks the account after MAX_FAILED_LOGIN_ATTEMPTS wrong currentPasswords", async () => {
    const agent = await signedInAgent();
    // Simulate 4 prior failures stored in the credential row
    dbMocks.credState.rows[0]!.failedLoginAttempts = 4;

    const res = await agent.post("/api/admin/venue-owner/password")
      .send({ currentPassword: "WrongPassword1", newPassword: "BrandNewSecret1" });
    expect(res.status).toBe(401);
    expect(dbMocks.credChain["set"]).toHaveBeenCalledWith(
      expect.objectContaining({
        failedLoginAttempts: 5,
        lockedUntil: expect.any(Date),
      }),
    );
  });

  it("password-change endpoint returns 429 when the account is already locked", async () => {
    const agent = await signedInAgent();
    // Simulate an active lockout in the stored credential
    dbMocks.credState.rows[0]!.lockedUntil = new Date(Date.now() + 5 * 60 * 1000);

    const res = await agent.post("/api/admin/venue-owner/password")
      .send({ currentPassword: "WrongPassword1", newPassword: "BrandNewSecret1" });
    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
    // Counter must not be touched while locked
    expect(dbMocks.credChain["set"]).not.toHaveBeenCalled();
  });

  it("successful password change resets the failed-attempts counter", async () => {
    const agent = await signedInAgent();
    // Simulate some prior failures
    dbMocks.credState.rows[0]!.failedLoginAttempts = 2;

    const res = await agent.post("/api/admin/venue-owner/password")
      .send({ currentPassword: "SecurePassword1", newPassword: "BrandNewSecret1" });
    expect(res.status).toBe(200);
    expect(dbMocks.credChain["set"]).toHaveBeenCalledWith(
      expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }),
    );
  });

  it("password-change lockout lifts automatically when the timeout expires — no manual DB intervention needed", async () => {
    // Use fake timers so we can advance the clock without real-time sleeps.
    vi.useFakeTimers();
    try {
      const LOCKOUT_MS = 5 * 60 * 1000; // must match the server constant

      const agent = await signedInAgent();

      // Drive the account to lockout via 5 wrong currentPassword attempts.
      // Time is frozen so lockedUntil is written at a deterministic instant.
      const lockTime = Date.now();
      for (let i = 0; i < 5; i++) {
        await agent.post("/api/admin/venue-owner/password")
          .send({ currentPassword: "WrongPassword1", newPassword: "BrandNewSecret1" });
      }

      // Verify the credential row was locked.
      const lockedUntil = dbMocks.credState.rows[0]?.["lockedUntil"] as Date | null;
      expect(lockedUntil).toBeInstanceOf(Date);
      expect(lockedUntil!.getTime()).toBeGreaterThan(lockTime);

      // Advance simulated clock past the full lockout window.
      vi.advanceTimersByTime(LOCKOUT_MS + 1);

      // A password-change attempt with the correct currentPassword must now succeed —
      // the lockout lifted automatically due to time passage, with no manual DB write.
      const res = await agent.post("/api/admin/venue-owner/password")
        .send({ currentPassword: "SecurePassword1", newPassword: "BrandNewSecret1" });
      expect(res.status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it("password-change: lockedUntil exactly equal to now is treated as expired (boundary: > not >=)", async () => {
    // Use fake timers so we can pin Date.now() to a known instant.
    vi.useFakeTimers();
    try {
      const agent = await signedInAgent();

      // Pin the clock to a fixed instant and set lockedUntil to that exact instant.
      // The lockout check is `lockedUntil > new Date()`, so equal-to-now must NOT block.
      const now = Date.now();
      Object.assign(dbMocks.credState.rows[0]!, {
        failedLoginAttempts: 5,
        lockedUntil: new Date(now), // exactly at the boundary
      });

      const res = await agent.post("/api/admin/venue-owner/password")
        .send({ currentPassword: "SecurePassword1", newPassword: "BrandNewSecret1" });
      expect(res.status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("review queue filtering", () => {
  it("defaults to applications that are actually awaiting a decision", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.orderBy.mockResolvedValueOnce([application()]);
    dbMocks.chain.groupBy.mockResolvedValueOnce([
      { status: "submitted", total: 1 },
      { status: "approved", total: 4 },
    ]);

    const res = await agent.get("/api/admin/venue-owner/applications");

    expect(res.status).toBe(200);
    expect(res.body.applications).toHaveLength(1);
    expect(res.body.applications[0].status).toBe("submitted");
    expect(res.body.applications[0].statusLabel).toBe("Submitted");
    // Counts span every status so the reviewer can see decided work exists.
    expect(res.body.counts).toEqual({ submitted: 1, approved: 4 });
  });

  it("rejects an unknown status filter instead of silently returning the queue", async () => {
    const agent = await signedInAgent();
    const res = await agent.get("/api/admin/venue-owner/applications?status=nonsense");
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("nonsense");
  });

  it("rejects an unparseable date filter", async () => {
    const agent = await signedInAgent();
    const res = await agent.get("/api/admin/venue-owner/applications?from=not-a-date");
    expect(res.status).toBe(400);
  });

  it("accepts an explicit multi-status filter and a date window", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.orderBy.mockResolvedValueOnce([application({ applicationStatus: "approved" })]);
    const res = await agent.get(
      "/api/admin/venue-owner/applications?status=approved,rejected&from=2026-01-01T00:00:00.000Z&to=2026-12-31T00:00:00.000Z",
    );
    expect(res.status).toBe(200);
    expect(res.body.applications[0].status).toBe("approved");
  });

  it("returns a recently resubmitted application in the date-filtered review queue", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.orderBy.mockResolvedValueOnce([
      {
        ...application({ applicationStatus: "resubmitted" }),
        createdAt: new Date("2025-01-01T10:00:00.000Z"),
        submittedAt: new Date("2026-08-01T10:00:00.000Z"),
      },
    ]);

    const res = await agent.get(
      "/api/admin/venue-owner/applications?status=queue&from=2026-08-01T00:00:00.000Z&to=2026-08-02T00:00:00.000Z&search=Corner",
    );

    expect(res.status).toBe(200);
    expect(res.body.applications).toHaveLength(1);
    expect(res.body.applications[0].status).toBe("resubmitted");
    expect(dbMocks.chain.where).toHaveBeenCalled();
    expect(dbMocks.chain.orderBy).toHaveBeenCalled();
  });
});

describe("review detail and notes", () => {
  it("returns the full audit trail including internal notes", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application()]);
    dbMocks.chain.orderBy.mockResolvedValueOnce([
      {
        id: 1,
        eventType: "submitted",
        fromStatus: null,
        toStatus: "submitted",
        actorRole: "applicant",
        actorUid: "venue-owner-uid",
        applicantMessage: "Application submitted for review.",
        internalNote: null,
        createdAt: new Date("2026-07-01T10:00:00.000Z"),
      },
      {
        id: 2,
        eventType: "review_note_added",
        fromStatus: "submitted",
        toStatus: "submitted",
        actorRole: "admin",
        actorUid: null,
        applicantMessage: null,
        internalNote: "Proof looks photoshopped, second opinion needed",
        createdAt: new Date("2026-07-02T10:00:00.000Z"),
      },
    ]);

    const res = await agent.get("/api/admin/venue-owner/applications/7");

    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(2);
    expect(res.body.history[1].internalNote).toContain("second opinion");
    expect(res.body.history[1].actorRole).toBe("admin");
  });

  it("records an internal note without changing the decision", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application()]);

    const res = await agent
      .post("/api/admin/venue-owner/applications/7/notes")
      .send({ internalNote: "Called the owner, awaiting a utility bill" });

    expect(res.status).toBe(201);
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
    expect(dbMocks.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "review_note_added",
        internalNote: "Called the owner, awaiting a utility bill",
        actorRole: "admin",
        fromStatus: "submitted",
        toStatus: "submitted",
      }),
    );
  });

  it("requires a non-empty internal note", async () => {
    const agent = await signedInAgent();
    const res = await agent
      .post("/api/admin/venue-owner/applications/7/notes")
      .send({ internalNote: "   " });
    expect(res.status).toBe(400);
  });

  it("keeps internal notes out of the applicant-facing status response", async () => {
    dbMocks.chain.limit.mockResolvedValueOnce([application()]);
    dbMocks.chain.orderBy.mockResolvedValueOnce([
      {
        id: 2,
        eventType: "review_note_added",
        fromStatus: "submitted",
        toStatus: "submitted",
        applicantMessage: null,
        createdAt: new Date(),
      },
    ]);

    const res = await request(app).get("/api/venue-owner/me/application");

    expect(res.status).toBe(200);
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("internalNote");
    expect(serialized).not.toContain("actorUid");
  });
});

describe("decisions are single-shot", () => {
  it("approves an application awaiting review and notifies the applicant", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application()]);
    dbMocks.chain.returning.mockResolvedValueOnce([
      { ...application(), applicationStatus: "approved", isApproved: true },
    ]);

    const res = await agent
      .post("/api/admin/venue-owner/applications/7/approve")
      .send({ internalNote: "Deed matches the business name" });

    expect(res.status).toBe(200);
    expect(res.body.profile.status).toBe("approved");
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(dbMocks.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "approved",
        fromStatus: "submitted",
        toStatus: "approved",
        internalNote: "Deed matches the business name",
      }),
    );
  });

  it("refuses a repeated decision on an already-approved application", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application({ applicationStatus: "approved" })]);

    const res = await agent.post("/api/admin/venue-owner/applications/7/approve").send({});

    expect(res.status).toBe(409);
    expect(res.body.currentStatus).toBe("approved");
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("refuses to overwrite a decision made while the reviewer was deciding", async () => {
    const agent = await signedInAgent();
    // Reviewer opened the dialog on `submitted`; a colleague already rejected it.
    dbMocks.chain.limit.mockResolvedValueOnce([application({ applicationStatus: "rejected" })]);

    const res = await agent
      .post("/api/admin/venue-owner/applications/7/approve")
      .send({ expectedStatus: "submitted" });

    expect(res.status).toBe(409);
    expect(res.body.currentStatus).toBe("rejected");
    expect(res.body.message).toContain("Refresh");
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
  });

  it("reports a conflict when the row moves between the read and the write", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application()]);
    // The guarded UPDATE matches nothing because a concurrent decision landed first.
    dbMocks.chain.returning.mockResolvedValueOnce([]);

    const res = await agent.post("/api/admin/venue-owner/applications/7/approve").send({});

    expect(res.status).toBe(409);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("requires an applicant-facing reason to reject", async () => {
    const agent = await signedInAgent();
    const res = await agent
      .post("/api/admin/venue-owner/applications/7/reject")
      .send({ internalNote: "obvious spam" });
    expect(res.status).toBe(400);
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
  });

  it("separates the applicant message from the internal note when rejecting", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application()]);
    dbMocks.chain.returning.mockResolvedValueOnce([
      { ...application(), applicationStatus: "rejected" },
    ]);

    const res = await agent.post("/api/admin/venue-owner/applications/7/reject").send({
      reason: "The ownership document is illegible.",
      internalNote: "Third attempt from this owner",
    });

    expect(res.status).toBe(200);
    expect(dbMocks.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        applicantMessage: "The ownership document is illegible.",
        internalNote: "Third attempt from this owner",
      }),
    );
    expect(pushMock).toHaveBeenCalledWith(
      "venue-owner-uid",
      expect.objectContaining({
        data: { type: "venue_owner_rejected", placeId: "google-place-1" },
      }),
    );
  });

  it("hands an application back for changes without ending the claim", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application()]);
    dbMocks.chain.returning.mockResolvedValueOnce([
      { ...application(), applicationStatus: "changes_requested" },
    ]);

    const res = await agent
      .post("/api/admin/venue-owner/applications/7/request-changes")
      .send({ message: "Send a utility bill showing the venue address." });

    expect(res.status).toBe(200);
    expect(res.body.profile.status).toBe("changes_requested");
    expect(res.body.profile.statusLabel).toBe("Changes requested");
    expect(dbMocks.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "changes_requested",
        toStatus: "changes_requested",
        applicantMessage: "Send a utility bill showing the venue address.",
      }),
    );
    expect(pushMock).toHaveBeenCalledWith(
      "venue-owner-uid",
      expect.objectContaining({
        data: { type: "venue_owner_changes_requested", placeId: "google-place-1" },
      }),
    );
  });

  it("requires a message when asking the applicant for changes", async () => {
    const agent = await signedInAgent();
    const res = await agent
      .post("/api/admin/venue-owner/applications/7/request-changes")
      .send({ message: "no" });
    expect(res.status).toBe(400);
  });

  it("lets a reviewer withdraw an application that is still with the applicant", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([
      application({ applicationStatus: "changes_requested" }),
    ]);
    dbMocks.chain.returning.mockResolvedValueOnce([
      { ...application(), applicationStatus: "withdrawn" },
    ]);

    const res = await agent
      .post("/api/admin/venue-owner/applications/7/withdraw")
      .send({ reason: "Duplicate of an existing claim." });

    expect(res.status).toBe(200);
    expect(res.body.profile.status).toBe("withdrawn");
    expect(pushMock).toHaveBeenCalledWith(
      "venue-owner-uid",
      expect.objectContaining({
        data: { type: "venue_owner_withdrawn", placeId: "google-place-1" },
      }),
    );
  });

  it("cannot withdraw an approved venue", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application({ applicationStatus: "approved" })]);

    const res = await agent
      .post("/api/admin/venue-owner/applications/7/withdraw")
      .send({ reason: "Changed my mind" });

    expect(res.status).toBe(409);
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
  });

  it("claims an application for review", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application()]);
    dbMocks.chain.returning.mockResolvedValueOnce([
      { ...application(), applicationStatus: "under_review" },
    ]);

    const res = await agent
      .post("/api/admin/venue-owner/applications/7/start-review")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.profile.status).toBe("under_review");
  });

  it("cannot re-claim an application that is already under review", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application({ applicationStatus: "under_review" })]);

    const res = await agent
      .post("/api/admin/venue-owner/applications/7/start-review")
      .send({});

    expect(res.status).toBe(409);
  });

  it("returns 404 for an application that does not exist", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([]);
    const res = await agent.post("/api/admin/venue-owner/applications/999/approve").send({});
    expect(res.status).toBe(404);
  });

  it("rejects a non-numeric application id", async () => {
    const agent = await signedInAgent();
    const res = await agent.post("/api/admin/venue-owner/applications/abc/approve").send({});
    expect(res.status).toBe(400);
  });
});

describe("credential lockout", () => {
  /**
   * Helper: send N wrong-password sign-in requests using a plain (stateless)
   * request so each call re-reads the credential from credState and applies
   * the side-effect via credChain.set.
   */
  async function failSignIn(times: number) {
    for (let i = 0; i < times; i++) {
      await request(app)
        .post("/api/admin/venue-owner/session")
        .send({ password: "WrongPassword1" });
    }
  }

  it("still signs in successfully after fewer than the lockout threshold failures", async () => {
    await signedInAgent(); // sets up credential

    // 4 wrong attempts — one short of the 5-attempt threshold
    await failSignIn(4);

    const ok = await request(app)
      .post("/api/admin/venue-owner/session")
      .send({ password: "SecurePassword1" });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual(expect.objectContaining({ authenticated: true }));
  });

  it("locks the credential after reaching the failure threshold", async () => {
    await signedInAgent(); // sets up credential

    // 5 consecutive wrong passwords → threshold reached
    await failSignIn(5);

    // Correct password is now rejected because the credential is locked
    const locked = await request(app)
      .post("/api/admin/venue-owner/session")
      .send({ password: "SecurePassword1" });
    expect(locked.status).toBe(429);
    expect(locked.headers["retry-after"]).toBeDefined();
    expect(locked.body.message).toMatch(/locked/i);
  });

  it("increments the failed-attempt counter on the credential row", async () => {
    await signedInAgent();

    await failSignIn(3);

    // The stored credential should reflect 3 failed attempts
    expect(dbMocks.credState.rows[0]?.["failedLoginAttempts"]).toBe(3);
    expect(dbMocks.credState.rows[0]?.["lockedUntil"]).toBeNull();
  });

  it("sets lockedUntil on the credential row when the threshold is reached", async () => {
    await signedInAgent();

    const before = Date.now();
    await failSignIn(5);
    const after = Date.now();

    const lockedUntil = dbMocks.credState.rows[0]?.["lockedUntil"] as Date | null;
    expect(lockedUntil).toBeInstanceOf(Date);
    // lockedUntil should be ~5 minutes in the future
    expect(lockedUntil!.getTime()).toBeGreaterThan(before + 4 * 60 * 1000);
    expect(lockedUntil!.getTime()).toBeLessThanOrEqual(after + 5 * 60 * 1000 + 1000);
  });

  it("clears failedLoginAttempts and lockedUntil after a successful sign-in", async () => {
    await signedInAgent();

    // Accumulate some failures (below the lockout threshold)
    await failSignIn(3);
    expect(dbMocks.credState.rows[0]?.["failedLoginAttempts"]).toBe(3);

    // Successful sign-in resets the counter
    const ok = await request(app)
      .post("/api/admin/venue-owner/session")
      .send({ password: "SecurePassword1" });
    expect(ok.status).toBe(200);
    expect(dbMocks.credState.rows[0]?.["failedLoginAttempts"]).toBe(0);
    expect(dbMocks.credState.rows[0]?.["lockedUntil"]).toBeNull();
  });

  it("sign-in reset: credChain.set is called with failedLoginAttempts:0 and lockedUntil:null on success", async () => {
    await signedInAgent();

    // Prime the credential with a non-zero failed-attempt count
    Object.assign(dbMocks.credState.rows[0]!, { failedLoginAttempts: 2, lockedUntil: null });
    dbMocks.credChain["set"].mockClear();

    const ok = await request(app)
      .post("/api/admin/venue-owner/session")
      .send({ password: "SecurePassword1" });
    expect(ok.status).toBe(200);

    // The DB update on success must write failedLoginAttempts:0 and lockedUntil:null
    expect(dbMocks.credChain["set"]).toHaveBeenCalledWith(
      expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }),
    );
  });

  it("rejects sign-in while locked even with the correct password", async () => {
    await signedInAgent();

    // Manually force a locked state by setting lockedUntil in the future
    const future = new Date(Date.now() + 5 * 60 * 1000);
    Object.assign(dbMocks.credState.rows[0]!, { failedLoginAttempts: 5, lockedUntil: future });

    const res = await request(app)
      .post("/api/admin/venue-owner/session")
      .send({ password: "SecurePassword1" });
    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/locked/i);
  });

  it("allows sign-in once the lockout window has expired", async () => {
    await signedInAgent();

    // Set lockedUntil to just in the past (already expired)
    const past = new Date(Date.now() - 1);
    Object.assign(dbMocks.credState.rows[0]!, { failedLoginAttempts: 5, lockedUntil: past });

    const res = await request(app)
      .post("/api/admin/venue-owner/session")
      .send({ password: "SecurePassword1" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ authenticated: true }));
  });

  it("lockout lifts automatically when the timeout expires — no manual DB intervention needed", async () => {
    // Use fake timers so we can advance the clock without real-time sleeps.
    vi.useFakeTimers();
    try {
      const LOCKOUT_MS = 5 * 60 * 1000; // must match the server constant

      await signedInAgent();

      // Drive the account to lockout by accumulating 5 wrong-password requests.
      // We send the requests while time is frozen so lockedUntil is deterministic.
      const lockTime = Date.now();
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post("/api/admin/venue-owner/session")
          .send({ password: "WrongPassword1" });
      }

      // Verify lockout was set in the DB (the server wrote a lockedUntil ~lockTime + 5 min).
      const lockedUntil = dbMocks.credState.rows[0]?.["lockedUntil"] as Date | null;
      expect(lockedUntil).toBeInstanceOf(Date);
      expect(lockedUntil!.getTime()).toBeGreaterThan(lockTime);

      // Advance simulated clock past the full lockout window.
      vi.advanceTimersByTime(LOCKOUT_MS + 1);

      // A fresh sign-in with the correct password must now succeed — the lockout
      // lifted automatically due to time passage, with no manual DB write needed.
      const res = await request(app)
        .post("/api/admin/venue-owner/session")
        .send({ password: "SecurePassword1" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({ authenticated: true }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("lockedUntil exactly equal to now is treated as expired (boundary: > not >=)", async () => {
    // Use fake timers so we can pin Date.now() to a known instant.
    vi.useFakeTimers();
    try {
      await signedInAgent();

      // Pin the clock to a fixed instant and set lockedUntil to that exact instant.
      // The lockout check is `lockedUntil > new Date()`, so equal-to-now must NOT block.
      const now = Date.now();
      Object.assign(dbMocks.credState.rows[0]!, {
        failedLoginAttempts: 5,
        lockedUntil: new Date(now), // exactly at the boundary
      });

      const res = await request(app)
        .post("/api/admin/venue-owner/session")
        .send({ password: "SecurePassword1" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({ authenticated: true }));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("lockout durability across server restarts", () => {
  /**
   * These tests verify that the lockout state (failedLoginAttempts + lockedUntil)
   * is persisted in the DB — represented here by credState — and that a
   * completely independent request (simulating a process restart) re-reads those
   * fields and continues to enforce the lockout.  No in-memory state is carried
   * between the failure-accumulation phase and the post-"restart" assertion.
   */

  it("sign-in endpoint: lockout written to DB survives a fresh request", async () => {
    await signedInAgent(); // configures the credential row

    // Accumulate exactly MAX_FAILED_LOGIN_ATTEMPTS wrong passwords.
    // Each request re-reads from credState (our DB proxy) and writes back.
    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post("/api/admin/venue-owner/session")
        .send({ password: "WrongPassword1" });
      expect(r.status).toBe(401);
    }

    // Verify the lockout fields were written to the credential row (DB write confirmed).
    expect(dbMocks.credState.rows[0]?.["failedLoginAttempts"]).toBe(5);
    expect(dbMocks.credState.rows[0]?.["lockedUntil"]).toBeInstanceOf(Date);

    // Simulate a server restart: send an entirely fresh request with no manual state
    // mutation.  The handler must read lockedUntil from the DB row and return 429.
    const afterRestart = await request(app)
      .post("/api/admin/venue-owner/session")
      .send({ password: "SecurePassword1" });
    expect(afterRestart.status).toBe(429);
    expect(afterRestart.headers["retry-after"]).toBeDefined();
    expect(afterRestart.body.message).toMatch(/locked/i);
  });

  it("password-change endpoint: lockout written to DB survives a fresh request", async () => {
    const agent = await signedInAgent(); // configures the credential row

    // Accumulate exactly MAX_FAILED_LOGIN_ATTEMPTS wrong currentPasswords.
    for (let i = 0; i < 5; i++) {
      const r = await agent
        .post("/api/admin/venue-owner/password")
        .send({ currentPassword: "WrongPassword1", newPassword: "BrandNewSecret1" });
      expect(r.status).toBe(401);
    }

    // Verify the lockout fields were written to the credential row (DB write confirmed).
    expect(dbMocks.credState.rows[0]?.["failedLoginAttempts"]).toBe(5);
    expect(dbMocks.credState.rows[0]?.["lockedUntil"]).toBeInstanceOf(Date);

    // Simulate a server restart: fresh request re-reads DB row → still locked → 429.
    const afterRestart = await agent
      .post("/api/admin/venue-owner/password")
      .send({ currentPassword: "SecurePassword1", newPassword: "BrandNewSecret1" });
    expect(afterRestart.status).toBe(429);
    expect(afterRestart.headers["retry-after"]).toBeDefined();
  });
});

describe("source filter", () => {
  /**
   * The source filter uses an equality match on `applicationSource`. Legacy
   * rows pre-dating the column have NULL there and must be excluded when any
   * source is active — because the SQL equality predicate `applicationSource =
   * 'mobile'` never matches NULL (SQL three-valued logic). These tests verify
   * that:
   *   a) the equality predicate is actually constructed (via the eqSpy on
   *      drizzle-orm's `eq`) for each accepted source value, so a future
   *      refactor that removes the filter clause would immediately fail here;
   *   b) no source predicate is emitted when the query param is absent; and
   *   c) the serialized response reflects the rows the DB returns.
   *
   * venueOwnerProfilesTable.applicationSource is mocked as the plain string
   * "applicationSource", so spy assertions compare against that string rather
   * than a drizzle column object.
   */

  it.each(["mobile", "web", "agent"] as const)(
    "constructs an equality predicate on applicationSource when source=%s",
    async (sourceValue) => {
      const agent = await signedInAgent();
      dbMocks.chain.orderBy.mockResolvedValueOnce([]);
      dbMocks.chain.groupBy.mockResolvedValueOnce([]);

      const res = await agent.get(`/api/admin/venue-owner/applications?source=${sourceValue}`);

      expect(res.status).toBe(200);
      // The route must have called eq("applicationSource", sourceValue) to build
      // the filter — this is the predicate that excludes NULL (legacy) rows and
      // rows with a different source value.
      expect(eqSpy).toHaveBeenCalledWith("applicationSource", sourceValue);
    },
  );

  it("does not add a source predicate when no source filter is given", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.orderBy.mockResolvedValueOnce([]);
    dbMocks.chain.groupBy.mockResolvedValueOnce([]);

    await agent.get("/api/admin/venue-owner/applications");

    // Without ?source=, the route must not emit an applicationSource equality
    // clause, so legacy (NULL) rows and all-source rows are included.
    const sourceEqCalls = eqSpy.mock.calls.filter((args) => args[0] === "applicationSource");
    expect(sourceEqCalls).toHaveLength(0);
  });

  it("returns the matching rows in the response body when source=mobile", async () => {
    const agent = await signedInAgent();
    const mobileRow = application({ id: 1, applicationSource: "mobile" });
    dbMocks.chain.orderBy.mockResolvedValueOnce([mobileRow]);
    dbMocks.chain.groupBy.mockResolvedValueOnce([{ status: "submitted", total: 1 }]);

    const res = await agent.get("/api/admin/venue-owner/applications?source=mobile");

    expect(res.status).toBe(200);
    expect(res.body.applications).toHaveLength(1);
    expect(res.body.applications[0].applicationSource).toBe("mobile");
    // Predicate must still be present.
    expect(eqSpy).toHaveBeenCalledWith("applicationSource", "mobile");
  });

  it("returns sourced and legacy rows in the response body when no source filter is given", async () => {
    const agent = await signedInAgent();
    const mobileRow = application({ id: 1, applicationSource: "mobile" });
    const legacyRow = application({ id: 2, applicationSource: null });
    dbMocks.chain.orderBy.mockResolvedValueOnce([mobileRow, legacyRow]);
    dbMocks.chain.groupBy.mockResolvedValueOnce([{ status: "submitted", total: 2 }]);

    const res = await agent.get("/api/admin/venue-owner/applications");

    expect(res.status).toBe(200);
    expect(res.body.applications).toHaveLength(2);
    // No source predicate emitted.
    const sourceEqCalls = eqSpy.mock.calls.filter((args) => args[0] === "applicationSource");
    expect(sourceEqCalls).toHaveLength(0);
  });

  it("rejects an unknown source value with 400 before touching the DB", async () => {
    const agent = await signedInAgent();

    const res = await agent.get("/api/admin/venue-owner/applications?source=unknown");

    expect(res.status).toBe(400);
    // No DB write or source predicate should be constructed for an invalid value.
    expect(eqSpy).not.toHaveBeenCalledWith("applicationSource", "unknown");
  });
});
