import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => {
  const limit = vi.fn();
  const chain = {
    select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(), limit,
  };
  return { chain, verify: vi.fn(), initialize: vi.fn() };
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
import { requireUid } from "./requireUid";

const app = express();
app.use(express.json());
app.use(requireUid);
app.use((req, res) => { res.json({ uid: req.uid }); });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.initialize.mockReset();
  mocks.chain.limit.mockResolvedValue([{ displayName: "Met visitor", photoUrl: null }]);
  mocks.verify.mockResolvedValue({ uid: "visitor" });
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
