import { vi, describe, it, expect, beforeEach } from "vitest";

const dbMocks = vi.hoisted(() => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
  };
  return { chain };
});

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  profilesTable: {},
}));

import request from "supertest";
import app from "../app";

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockReturnThis();
});

describe("POST /api/ble/resolve privacy", () => {
  it("does not resolve a hidden user's advertised BLE hash", async () => {
    dbMocks.chain.where.mockResolvedValueOnce([
      {
        uidHash: "1111111111111111",
        uid: "visible-user",
        displayName: "Visible User",
        photoUrl: null,
        bio: null,
        socials: {},
        interests: [],
        isVisible: true,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      },
      {
        uidHash: "2222222222222222",
        uid: "hidden-user",
        displayName: "Hidden User",
        photoUrl: null,
        bio: null,
        socials: {},
        interests: [],
        isVisible: false,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      },
    ]);

    const res = await request(app)
      .post("/api/ble/resolve")
      .set("x-met-uid", "scanner")
      .send({ hashes: ["1111111111111111", "2222222222222222"] });

    expect(res.status).toBe(200);
    expect(res.body.map((entry: { profile: { uid: string } }) => entry.profile.uid))
      .toEqual(["visible-user"]);
  });
});