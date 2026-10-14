import crypto from "node:crypto";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cascade: vi.fn(), files: vi.fn(), transaction: vi.fn(),
}));
vi.mock("../lib/deleteVenueOwnerProfile", () => ({ deleteVenueOwnerProfile: mocks.cascade }));
vi.mock("../lib/deleteVenueStorageFiles", () => ({ deleteVenueStorageFiles: mocks.files }));
vi.mock("../middlewares/rateLimit", () => ({
  createIpRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createUserRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return {
    ...actual,
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            limit: async () => table === actual.venueAdminCredentialsTable
              ? [{ id: 1, sessionVersion: 1 }]
              : [{ id: 42, placeId: "test-place", ownerUid: "test-owner", businessName: "Test venue" }],
          }),
        }),
      }),
      transaction: mocks.transaction,
    },
  };
});

const secret = "throwaway-venue-delete-test-secret";
vi.stubEnv("SESSION_SECRET", secret);

describe("admin venue deletion completion", () => {
  let app: typeof import("../app").default;
  beforeAll(async () => { ({ default: app } = await import("../app")); });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cascade.mockResolvedValue(["/api/storage/objects/uploads/5c2a6b71-f6b8-42ee-832c-562c73f13798"]);
    mocks.files.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (run: (tx: object) => Promise<void>) => run({}));
  });
  const cookie = () => {
    const value = `1.1.${Date.now() + 60_000}`;
    const signature = crypto.createHmac("sha256", secret).update(value).digest("base64").replace(/=+$/, "");
    return `met_venue_admin=${encodeURIComponent(`s:${value}.${signature}`)}`;
  };
  it("requires an admin session", async () => {
    expect((await request(app).delete("/api/admin/venue-owner/venues/42")).status).toBe(401);
    expect(mocks.cascade).not.toHaveBeenCalled();
  });
  it("does not report success or commit when owned file cleanup fails", async () => {
    mocks.files.mockRejectedValueOnce(new Error("storage unavailable"));
    let committed = false;
    mocks.transaction.mockImplementationOnce(async (run: (tx: object) => Promise<void>) => {
      await run({});
      committed = true;
    });
    const response = await request(app).delete("/api/admin/venue-owner/venues/42").set("Cookie", cookie());
    expect(response.status).toBe(503);
    expect(response.body.message).toContain("records were kept");
    expect(committed).toBe(false);
  });
  it("finishes only after the transaction's owned file cleanup succeeds", async () => {
    const response = await request(app).delete("/api/admin/venue-owner/venues/42").set("Cookie", cookie());
    expect(response.status).toBe(200);
    expect(mocks.cascade).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 42 }));
    expect(mocks.files).toHaveBeenCalledWith(expect.any(Array), { profileId: 42 }, { requireComplete: true });
  });
});
