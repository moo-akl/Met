import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

const dbMocks = vi.hoisted(() => {
  const chain = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    onConflictDoUpdate: vi.fn(),
    returning: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };
  return { chain };
});

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  networksTable: { id: "network.id", inviteCode: "network.inviteCode" },
  networkMembersTable: {
    networkId: "member.networkId",
    uid: "member.uid",
    status: "member.status",
  },
  profilesTable: { uid: "profile.uid", isVisible: "profile.isVisible" },
  networkAnnouncementsTable: {},
  networkPollOptionsTable: {},
  networkPollVotesTable: {},
  networkQuestionnaireQuestionsTable: {},
  networkQuestionnaireAnswersTable: {},
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...parts: unknown[]) => ({ op: "and", parts })),
  desc: vi.fn((value: unknown) => ({ op: "desc", value })),
  eq: vi.fn((left: unknown, right: unknown) => ({ op: "eq", left, right })),
  ilike: vi.fn((left: unknown, right: unknown) => ({ op: "ilike", left, right })),
  inArray: vi.fn((left: unknown, right: unknown) => ({ op: "inArray", left, right })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    { raw: (value: string) => value },
  ),
}));

vi.mock("../lib/firebaseAdmin", () => ({
  adminAuth: vi.fn(),
  adminDb: vi.fn(),
  adminStorage: vi.fn(),
  tryInitAdmin: vi.fn(() => null),
}));

import request from "supertest";
import app from "../app";

beforeAll(() => {
  delete process.env["REDIS_URL"];
});

beforeEach(() => {
  Object.values(dbMocks.chain).forEach((mock) => mock.mockReset());
  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockReturnThis();
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.limit.mockResolvedValue([]);
  dbMocks.chain.insert.mockReturnThis();
  dbMocks.chain.values.mockReturnThis();
  dbMocks.chain.onConflictDoUpdate.mockReturnThis();
  dbMocks.chain.returning.mockResolvedValue([]);
  dbMocks.chain.update.mockReturnThis();
  dbMocks.chain.set.mockReturnThis();
  dbMocks.chain.delete.mockReturnThis();
});

const networkFixture = { id: 7, name: "Test network" };
const activeAdmin = { networkId: 7, uid: "admin", role: "admin", status: "active" };
const pendingMember = {
  networkId: 7,
  uid: "hidden-user",
  role: "member",
  status: "pending",
  joinedAt: new Date("2025-01-01T00:00:00Z"),
};

describe("hidden profile network discovery privacy", () => {
  it("does not allow a hidden user to create a newly discoverable network", async () => {
    dbMocks.chain.limit.mockResolvedValueOnce([{ isVisible: false }]);

    const res = await request(app)
      .post("/api/networks")
      .set("x-met-uid", "hidden-user")
      .send({ name: "Hidden user's network", category: "custom" });

    expect(res.status).toBe(404);
    expect(dbMocks.chain.insert).not.toHaveBeenCalled();
  });

  it("does not allow a hidden user to join a network", async () => {
    dbMocks.chain.limit
      .mockResolvedValueOnce([networkFixture])
      .mockResolvedValueOnce([{ isVisible: false }]);

    const res = await request(app)
      .post("/api/networks/7/join")
      .set("x-met-uid", "hidden-user")
      .send({});

    expect(res.status).toBe(404);
    expect(dbMocks.chain.insert).not.toHaveBeenCalled();
  });

  it("does not allow an inviter to add a hidden user to a network", async () => {
    dbMocks.chain.limit
      .mockResolvedValueOnce([networkFixture])
      .mockResolvedValueOnce([activeAdmin])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ isVisible: false }]);

    const res = await request(app)
      .post("/api/networks/7/invite")
      .set("x-met-uid", "admin")
      .send({ uid: "hidden-user" });

    expect(res.status).toBe(404);
    expect(dbMocks.chain.insert).not.toHaveBeenCalled();
  });

  it("does not approve a pending membership after the user has hidden their profile", async () => {
    dbMocks.chain.limit
      .mockResolvedValueOnce([activeAdmin])
      .mockResolvedValueOnce([pendingMember])
      .mockResolvedValueOnce([{ isVisible: false }]);

    const res = await request(app)
      .post("/api/networks/7/members/hidden-user/approve")
      .set("x-met-uid", "admin")
      .send({ approve: true });

    expect(res.status).toBe(404);
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
  });

  it("omits hidden users from the pending-members discovery list", async () => {
    dbMocks.chain.limit
      .mockResolvedValueOnce([{ id: networkFixture.id }])
      .mockResolvedValueOnce([activeAdmin])
      .mockResolvedValueOnce([pendingMember]);
    dbMocks.chain.where
      .mockImplementationOnce(() => dbMocks.chain)
      .mockImplementationOnce(() => dbMocks.chain)
      .mockImplementationOnce(() => dbMocks.chain)
      .mockResolvedValueOnce([
        { uid: "hidden-user", isVisible: false },
      ]);

    const res = await request(app)
      .get("/api/networks/7/pending")
      .set("x-met-uid", "admin");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});