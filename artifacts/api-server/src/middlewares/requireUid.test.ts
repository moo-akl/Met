import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => {
  const limit = vi.fn();
  const chain = {
    select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(), limit,
  };
  return {
    chain,
    verify: vi.fn(),
    initialize: vi.fn(),
    account: {
      accountId: "met-account-visitor",
      status: "active",
      purgeAfter: null as Date | null,
      firebaseUid: "visitor",
    },
  };
});
vi.mock("@workspace/db", () => ({
  db: mocks.chain, profilesTable: { uid: "uid", displayName: "name", photoUrl: "photo" },
}));
vi.mock("../lib/firebaseAdmin", () => ({
  adminAuth: () => {
    mocks.initialize();
    return { verifyIdToken: mocks.verify };
  },
}));
vi.mock("../lib/userAccountIdentity", () => ({
  ensureUserAccount: vi.fn(async (uid: string) => ({
    ...mocks.account,
    firebaseUid: uid,
  })),
}));
import { requireUid } from "./requireUid";

const app = express();
app.use(express.json());
app.use(requireUid);
app.use((req, res) => {
  res.json({
    uid: req.uid,
    accountId: req.accountId,
    accountStatus: req.accountStatus,
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.initialize.mockReset();
  mocks.chain.limit.mockResolvedValue([{ displayName: "Met visitor", photoUrl: null }]);
  mocks.verify.mockResolvedValue({ uid: "visitor" });
  mocks.account.status = "active";
});

describe("authenticated private visitor enforcement", () => {
  it.each([
    ["get", "/profiles/me"],
    ["post", "/profiles/me/photo"],
    ["post", "/hubs/qr-verify"],
  ] as const)("reports unavailable server auth without blaming a valid session: %s %s", async (method, path) => {
    mocks.initialize.mockImplementation(() => {
      throw new Error("private server configuration diagnostic");
    });
    const res = await request(app)[method](path)
      .set("Authorization", "Bearer test-token")
      .set("x-met-uid", "unverified-visitor");
    expect(res.status).toBe(503);
    expect(res.headers["retry-after"]).toBe("30");
    expect(res.body.code).toBe("AUTH_SERVICE_UNAVAILABLE");
    expect(JSON.stringify(res.body)).not.toContain("private server configuration");
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.chain.select).not.toHaveBeenCalled();
    expect(res.body.uid).toBeUndefined();
  });
  it("continues rejecting invalid ID tokens as unauthorized", async () => {
    mocks.verify.mockRejectedValueOnce(new Error("invalid token"));
    const res = await request(app).get("/profiles/me")
      .set("Authorization", "Bearer invalid-token")
      .set("x-met-uid", "unverified-visitor");
    expect(res.status).toBe(401);
    expect(res.body.code).not.toBe("AUTH_SERVICE_UNAVAILABLE");
    expect(mocks.chain.select).not.toHaveBeenCalled();
  });
  it("denies social access even with a valid Firebase token", async () => {
    const res = await request(app).post("/reveals").set("Authorization", "Bearer test-token");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("PROFILE_COMPLETION_REQUIRED");
  });
  it("also enforces the development identity path", async () => {
    const res = await request(app).post("/networks/2/join").set("x-met-uid", "visitor");
    expect(res.status).toBe(403);
  });
  it("allows an existing completed profile to use social features", async () => {
    mocks.chain.limit.mockResolvedValue([{ displayName: "Ada", photoUrl: "https://example.com/photo.jpg" }]);
    const res = await request(app).post("/reveals").set("Authorization", "Bearer test-token");
    expect(res.status).toBe(200);
    expect(res.body.uid).toBe("visitor");
  });
  it("blocks normal API access while deletion is pending", async () => {
    mocks.account.status = "pending_deletion";
    mocks.account.purgeAfter = new Date("2026-12-22T12:00:00.000Z");
    const res = await request(app)
      .get("/profiles/me")
      .set("Authorization", "Bearer test-token");
    expect(res.status).toBe(423);
    expect(res.body.code).toBe("ACCOUNT_PENDING_DELETION");
    expect(res.body.purgeAfter).toBe("2026-12-22T12:00:00.000Z");
  });
  it.each([
    ["get", "/profiles/me/account-status"],
    ["post", "/profiles/me/recover-deletion"],
  ] as const)("keeps account status and recovery available while pending: %s %s", async (method, path) => {
    mocks.account.status = "pending_deletion";
    const res = await request(app)[method](path)
      .set("Authorization", "Bearer test-token");
    expect(res.status).toBe(200);
    expect(res.body.accountStatus).toBe("pending_deletion");
  });
  it.each([
    ["post", "/hubs/qr-verify"], ["get", "/profiles/me"],
    ["delete", "/profiles/me"], ["post", "/reports"],
    ["post", "/connections/remove"], ["post", "/reveals/decline"],
  ] as const)("retains private and safety access: %s %s", async (method, path) => {
    const res = await request(app)[method](path).set("Authorization", "Bearer test-token");
    expect(res.status).toBe(200);
    expect(mocks.chain.select).not.toHaveBeenCalled();
  });
  it("does not allow unauthenticated private check-in", async () => {
    expect((await request(app).post("/hubs/qr-verify")).status).toBe(401);
  });
});
