import { vi, describe, it, expect, beforeEach } from "vitest";

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
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn(),
    transaction: vi.fn(),
  };
  return { chain };
});

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  presenceTable: {},
  profilesTable: {},
}));

import request from "supertest";
import app from "../app";

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockReturnThis();
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.delete.mockReturnThis();
  dbMocks.chain.execute.mockResolvedValue({ rows: [] });
  dbMocks.chain.transaction.mockImplementation(
    async (callback: (tx: typeof dbMocks.chain) => Promise<unknown>) =>
      callback(dbMocks.chain),
  );
  dbMocks.chain.insert.mockReturnThis();
  dbMocks.chain.values.mockReturnThis();
  dbMocks.chain.onConflictDoUpdate.mockReturnThis();
  dbMocks.chain.limit.mockResolvedValue([]);
});

describe("presence privacy", () => {
  it("does not store or return submitted GPS coordinates for a hidden account", async () => {
    dbMocks.chain.limit.mockResolvedValueOnce([{ isVisible: false }]);

    const res = await request(app)
      .put("/api/presence")
      .set("x-met-uid", "hidden-user")
      .send({ lat: 42.36, lng: -71.06, accuracyM: 8 });

    expect(res.status).toBe(204);
    expect(dbMocks.chain.insert).not.toHaveBeenCalled();
    expect(dbMocks.chain.delete).toHaveBeenCalled();
  });

  it("returns no nearby presence rows when the visible-only lookup is empty", async () => {
    dbMocks.chain.execute.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get("/api/presence/nearby?lat=42.36&lng=-71.06")
      .set("x-met-uid", "viewer");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});