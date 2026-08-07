/**
 * Agent session lockout — integration coverage.
 *
 * Verifies that deactivating a sales agent (PATCH /admin/venue-owner/agents/:id
 * with isActive: false) immediately rejects the agent's existing session cookie
 * on their next request, and that reactivation restores access without requiring
 * a fresh login.
 *
 * The implementation under test is `verifyAgentSession` / `requireAgentSession`
 * in venueOwner.ts, which re-queries isActive on every request rather than
 * trusting the cookie alone.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env["ADMIN_SECRET"] = "test-admin-bootstrap";
process.env["SESSION_SECRET"] = "test-session-secret";

// ---------------------------------------------------------------------------
// DB mock state
// ---------------------------------------------------------------------------

const dbMocks = vi.hoisted(() => {
  // ── Admin credential store ──────────────────────────────────────────────
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
  const credState: {
    rows: Array<Record<string, unknown>>;
    pendingWrite: Record<string, unknown> | null;
  } = { rows: [], pendingWrite: null };

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

  // ── Agent store ─────────────────────────────────────────────────────────
  const agentTable = {
    id: "id",
    email: "email",
    displayName: "displayName",
    passwordHash: "passwordHash",
    isActive: "isActive",
    sessionVersion: "sessionVersion",
    failedLoginAttempts: "failedLoginAttempts",
    lockedUntil: "lockedUntil",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  };
  const agentState: { row: Record<string, unknown> | null } = { row: null };

  const agentChain: Record<string, ReturnType<typeof vi.fn>> = {} as never;
  agentChain["where"] = vi.fn(() => agentChain);
  agentChain["limit"] = vi.fn(async () =>
    agentState.row ? [{ ...agentState.row }] : [],
  );
  agentChain["set"] = vi.fn((patch: Record<string, unknown>) => {
    if (agentState.row) Object.assign(agentState.row, patch);
    return agentChain;
  });
  agentChain["returning"] = vi.fn(async () =>
    agentState.row ? [{ ...agentState.row }] : [],
  );
  agentChain["orderBy"] = vi.fn(async () =>
    agentState.row ? [{ ...agentState.row }] : [],
  );

  // ── Generic fallback chain ───────────────────────────────────────────────
  const chain: Record<string, ReturnType<typeof vi.fn>> = {} as never;
  chain["select"] = vi.fn().mockReturnThis();
  chain["from"] = vi.fn();
  chain["where"] = vi.fn().mockReturnThis();
  chain["orderBy"] = vi.fn().mockResolvedValue([]);
  chain["groupBy"] = vi.fn().mockResolvedValue([]);
  chain["limit"] = vi.fn().mockResolvedValue([]);
  chain["insert"] = vi.fn();
  chain["values"] = vi.fn().mockReturnThis();
  chain["update"] = vi.fn();
  chain["set"] = vi.fn().mockReturnThis();
  chain["returning"] = vi.fn().mockResolvedValue([]);
  chain["delete"] = vi.fn().mockReturnThis();
  chain["transaction"] = vi.fn(async (cb: (tx: typeof chain) => unknown) =>
    cb(chain),
  );

  return { chain, credChain, credState, credTable, agentChain, agentState, agentTable };
});

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  salesAgentsTable: dbMocks.agentTable,
  venueAdminCredentialsTable: dbMocks.credTable,
  // Tables referenced by the router but not needed for these tests
  venueOwnerProfilesTable: { id: "id", assignedAgentId: "assignedAgentId" },
  venueApplicationHistoryTable: {},
  venueEventsTable: {},
  venueEventRsvpsTable: {},
  venueRewardsTable: {},
  venueAnnouncementsTable: {},
  hubCheckinsTable: {},
  profilesTable: {},
  venueBusinessesTable: {},
  venueMembershipsTable: {},
  venueMembershipAuditTable: {},
  venueManagerRegistrationTokensTable: {},
  venueManagersTable: {},
  venueManagerSessionsTable: {},
  venueManagerTokensTable: {},
}));

vi.mock("../middlewares/requireUid", () => ({
  requireUid: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../middlewares/rateLimit", () => ({
  createUserRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createIpRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/push", () => ({ sendPush: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../lib/email.js", () => ({
  sendVenueApprovedEmail: vi.fn().mockResolvedValue(undefined),
  sendVenueRejectedEmail: vi.fn().mockResolvedValue(undefined),
  sendVenueChangesRequestedEmail: vi.fn().mockResolvedValue(undefined),
  sendRegistrationLinkEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../lib/firebaseAdmin", () => ({ adminStorage: {} }));

import crypto from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import venueOwnerRouter from "./venueOwner";

const SESSION_SECRET = "test-session-secret";
const AGENT_COOKIE_NAME = "met_agent_session";

const app = express();
app.use(express.json());
app.use(cookieParser(SESSION_SECRET));
app.use("/api", venueOwnerRouter);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a supertest agent with an active admin session. */
async function signedInAdmin() {
  const admin = request.agent(app);
  const res = await admin.post("/api/admin/venue-owner/setup").send({
    bootstrapCode: "test-admin-bootstrap",
    password: "SecurePassword1",
  });
  expect(res.status).toBe(200);
  return admin;
}

/**
 * Crafts a signed agent session cookie the same way the server does.
 * cookie-parser uses `cookie-signature` which signs via HMAC-SHA256 and
 * prefixes with "s:". Inlining the algorithm avoids a direct dependency on
 * the transitive `cookie-signature` package.
 *
 * Cookie value format: `agentId.sessionVersion.expiresAt`
 */
function makeAgentCookie(agentId: number, sessionVersion: number): string {
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const val = `${agentId}.${sessionVersion}.${expiresAt}`;
  const hmac = crypto.createHmac("sha256", SESSION_SECRET).update(val).digest("base64").replace(/=+$/, "");
  return `s:${val}.${hmac}`;
}

// ---------------------------------------------------------------------------
// Reset state before every test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Reset credential state
  dbMocks.credState.rows = [];
  dbMocks.credState.pendingWrite = null;

  // Reset agent state
  dbMocks.agentState.row = null;

  // Restore chain defaults
  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.set.mockReturnThis();
  dbMocks.chain.values.mockReturnThis();
  dbMocks.chain.orderBy.mockResolvedValue([]);
  dbMocks.chain.groupBy.mockResolvedValue([]);
  dbMocks.chain.limit.mockResolvedValue([]);
  dbMocks.chain.returning.mockResolvedValue([]);

  // Route from() by table: cred → credChain, agent → agentChain, else → chain
  dbMocks.chain.from.mockImplementation((table: unknown) => {
    if (table === dbMocks.credTable) return dbMocks.credChain;
    if (table === dbMocks.agentTable) return dbMocks.agentChain;
    return dbMocks.chain;
  });

  // Route insert() / update() similarly
  dbMocks.chain.insert.mockImplementation((table: unknown) => {
    if (table === dbMocks.credTable) return dbMocks.credChain;
    if (table === dbMocks.agentTable) return dbMocks.agentChain;
    return dbMocks.chain;
  });
  dbMocks.chain.update.mockImplementation((table: unknown) => {
    if (table === dbMocks.credTable) return dbMocks.credChain;
    if (table === dbMocks.agentTable) return dbMocks.agentChain;
    return dbMocks.chain;
  });
  dbMocks.chain.transaction.mockImplementation(
    async (cb: (tx: typeof dbMocks.chain) => unknown) => cb(dbMocks.chain),
  );
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("agent session lockout on deactivation", () => {
  it("accepts an active agent's session cookie on a protected endpoint", async () => {
    const AGENT_ID = 42;
    const SESSION_VERSION = 1;

    // Seed a live, active agent in the mock DB
    dbMocks.agentState.row = {
      id: AGENT_ID,
      email: "agent@example.com",
      displayName: "Test Agent",
      isActive: true,
      sessionVersion: SESSION_VERSION,
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const cookie = makeAgentCookie(AGENT_ID, SESSION_VERSION);
    const res = await request(app)
      .get("/api/admin/agent/session")
      .set("Cookie", `${AGENT_COOKIE_NAME}=${cookie}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ authenticated: true });
  });

  it("immediately rejects the existing session cookie after the agent is deactivated", async () => {
    const AGENT_ID = 42;
    const SESSION_VERSION = 1;

    // Seed the agent as active
    dbMocks.agentState.row = {
      id: AGENT_ID,
      email: "agent@example.com",
      displayName: "Test Agent",
      isActive: true,
      sessionVersion: SESSION_VERSION,
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const cookie = makeAgentCookie(AGENT_ID, SESSION_VERSION);

    // Confirm the session works before deactivation
    const before = await request(app)
      .get("/api/admin/agent/session")
      .set("Cookie", `${AGENT_COOKIE_NAME}=${cookie}`);
    expect(before.status).toBe(200);

    // Deactivate via the admin PATCH endpoint — let the mock chain apply the state change
    const admin = await signedInAdmin();
    const patch = await admin.patch(`/api/admin/venue-owner/agents/${AGENT_ID}`).send({
      isActive: false,
    });
    expect(patch.status).toBe(200);
    // The mock chain's set() has applied {isActive: false} to agentState.row; confirm it
    expect(dbMocks.agentState.row?.["isActive"]).toBe(false);

    // The same cookie must now be rejected — no new login required for lockout
    const after = await request(app)
      .get("/api/admin/agent/session")
      .set("Cookie", `${AGENT_COOKIE_NAME}=${cookie}`);
    expect(after.status).toBe(401);
  });

  it("restores access immediately when the agent is reactivated", async () => {
    const AGENT_ID = 42;
    const SESSION_VERSION = 1;

    // Start deactivated
    dbMocks.agentState.row = {
      id: AGENT_ID,
      email: "agent@example.com",
      displayName: "Test Agent",
      isActive: false,
      sessionVersion: SESSION_VERSION,
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const cookie = makeAgentCookie(AGENT_ID, SESSION_VERSION);

    // Confirm locked out
    const locked = await request(app)
      .get("/api/admin/agent/session")
      .set("Cookie", `${AGENT_COOKIE_NAME}=${cookie}`);
    expect(locked.status).toBe(401);

    // Reactivate via the admin PATCH endpoint — let the mock chain apply the state change
    const admin = await signedInAdmin();
    const patch = await admin.patch(`/api/admin/venue-owner/agents/${AGENT_ID}`).send({
      isActive: true,
    });
    expect(patch.status).toBe(200);
    // The mock chain's set() has applied {isActive: true} to agentState.row; confirm it
    expect(dbMocks.agentState.row?.["isActive"]).toBe(true);

    // The existing cookie must now succeed — no new login needed
    const restored = await request(app)
      .get("/api/admin/agent/session")
      .set("Cookie", `${AGENT_COOKIE_NAME}=${cookie}`);
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ authenticated: true });
  });

  it("rejects a cookie whose sessionVersion no longer matches (e.g. after a password reset)", async () => {
    const AGENT_ID = 42;
    const STALE_VERSION = 1;
    const CURRENT_VERSION = 2; // bumped by password change

    dbMocks.agentState.row = {
      id: AGENT_ID,
      email: "agent@example.com",
      displayName: "Test Agent",
      isActive: true,
      sessionVersion: CURRENT_VERSION,
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Cookie carries the old sessionVersion
    const staleCookie = makeAgentCookie(AGENT_ID, STALE_VERSION);
    const res = await request(app)
      .get("/api/admin/agent/session")
      .set("Cookie", `${AGENT_COOKIE_NAME}=${staleCookie}`);

    expect(res.status).toBe(401);
  });

  it("rejects a tampered or unsigned cookie", async () => {
    dbMocks.agentState.row = {
      id: 1,
      email: "agent@example.com",
      displayName: "Test Agent",
      isActive: true,
      sessionVersion: 1,
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Craft cookie without the "s:" prefix (not signed)
    const unsigned = `1.1.${Date.now() + 8 * 60 * 60 * 1000}`;
    const res = await request(app)
      .get("/api/admin/agent/session")
      .set("Cookie", `${AGENT_COOKIE_NAME}=${unsigned}`);

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// assign-agent: isActive guard
// ---------------------------------------------------------------------------

describe("assign-agent: inactive agent guard", () => {
  it("returns 404 when attempting to assign a venue to an inactive agent", async () => {
    const AGENT_ID = 7;
    const PROFILE_ID = 99;

    // Simulate the DB query for isActive=true returning nothing (agent is inactive).
    // PUT /admin/venue-owner/applications/:id/assign-agent does:
    //   db.select({id}).from(salesAgentsTable).where(and(eq(id,agentId), eq(isActive,true))).limit(1)
    // The mock chain returns agentState.row when it exists; null here means no row found.
    dbMocks.agentState.row = null;

    const admin = await signedInAdmin();
    const res = await admin
      .put(`/api/admin/venue-owner/applications/${PROFILE_ID}/assign-agent`)
      .send({ agentId: AGENT_ID });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ message: "Agent not found or inactive." });
  });

  it("returns 200 and persists the assignment once the agent is reactivated", async () => {
    const AGENT_ID = 7;
    const PROFILE_ID = 99;

    // Agent is now active — the isActive=true filter will find them.
    dbMocks.agentState.row = {
      id: AGENT_ID,
      email: "agent@example.com",
      displayName: "Reactivated Agent",
      isActive: true,
      sessionVersion: 1,
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // The route then updates venueOwnerProfilesTable and calls .returning().
    // Venue profile updates go through the generic chain; prime it with a result.
    dbMocks.chain.returning.mockResolvedValueOnce([
      { id: PROFILE_ID, assignedAgentId: AGENT_ID },
    ]);

    const admin = await signedInAdmin();
    const res = await admin
      .put(`/api/admin/venue-owner/applications/${PROFILE_ID}/assign-agent`)
      .send({ agentId: AGENT_ID });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: PROFILE_ID, assignedAgentId: AGENT_ID });
  });
});
