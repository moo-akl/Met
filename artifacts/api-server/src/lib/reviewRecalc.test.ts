import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// DB mock — must be hoisted before vi.mock() factory runs.
// ---------------------------------------------------------------------------

const dbMocks = vi.hoisted(() => {
  const updateSetChain = {
    where: vi.fn().mockResolvedValue(undefined),
  };
  const updateChain = {
    set: vi.fn().mockReturnValue(updateSetChain),
  };
  const insertChain = {
    values: vi.fn().mockResolvedValue(undefined),
  };

  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };

  const chain = {
    select: vi.fn().mockReturnValue(selectChain),
    update: vi.fn().mockReturnValue(updateChain),
    insert: vi.fn().mockReturnValue(insertChain),
  };

  return { chain, selectChain, updateChain, updateSetChain, insertChain };
});

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  reviewsTable: {},
  userStatsTable: {},
}));

// ---------------------------------------------------------------------------
// Import the real helper — NOT mocked.
// ---------------------------------------------------------------------------

import { recalcUserRating } from "./reviewRecalc";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();

  dbMocks.updateSetChain.where.mockResolvedValue(undefined);
  dbMocks.updateChain.set.mockReturnValue(dbMocks.updateSetChain);
  dbMocks.insertChain.values.mockResolvedValue(undefined);

  const sel = dbMocks.selectChain;
  sel.from.mockReturnThis();
  sel.where.mockReturnThis();
  sel.limit.mockResolvedValue([]);

  dbMocks.chain.select.mockReturnValue(sel);
  dbMocks.chain.update.mockReturnValue(dbMocks.updateChain);
  dbMocks.chain.insert.mockReturnValue(dbMocks.insertChain);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("recalcUserRating", () => {
  it("writes averageRating=0, reviewCount=0, communityStanding=0 when no reviews remain", async () => {
    // The reviews query ends with .where() — resolve it to [] (no reviews left).
    // The stats row query uses .limit() — resolve to an existing row (UPDATE path).
    dbMocks.selectChain.where
      .mockResolvedValueOnce([])  // reviews query: where(...) → []
      .mockReturnThis();           // stats select: where(...) → chain (then .limit())

    dbMocks.selectChain.limit.mockResolvedValueOnce([
      { userUid: "alice", trustScore: 100 },
    ]);

    await recalcUserRating("alice");

    expect(dbMocks.updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        averageRating: "0",
        reviewCount: 0,
        communityStanding: 0,
      }),
    );
  });

  it("inserts a new stats row (with zeroed values) when no stats row exists yet", async () => {
    // Reviews query → no remaining reviews; stats query → no existing row → INSERT
    dbMocks.selectChain.where
      .mockResolvedValueOnce([])  // reviews
      .mockReturnThis();           // stats select chain

    dbMocks.selectChain.limit.mockResolvedValueOnce([]); // no stats row

    await recalcUserRating("newuser");

    expect(dbMocks.insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userUid: "newuser",
        averageRating: "0",
        reviewCount: 0,
        communityStanding: 0,
      }),
    );
  });

  it("computes the correct weighted average when a review remains after partial removal", async () => {
    // One remaining review: starRating=4 from reviewer "bob" with trust 100
    dbMocks.selectChain.where
      .mockResolvedValueOnce([{ starRating: 4, reviewerUid: "bob" }]) // reviews
      .mockReturnThis()   // bob's trust-score select chain
      .mockReturnThis();  // stats select chain

    dbMocks.selectChain.limit
      .mockResolvedValueOnce([{ trustScore: 100 }])                   // bob's stats
      .mockResolvedValueOnce([{ userUid: "alice", trustScore: 100 }]); // alice's stats

    await recalcUserRating("alice");

    // Weighted avg = (4 * 1.0) / 1.0 = 4
    // communityStanding = ((4 - 1) / 4) * 100 = 75
    expect(dbMocks.updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        averageRating: "4",
        reviewCount: 1,
        communityStanding: 75,
      }),
    );
  });

  it("uses trust weight 1.0 (default) when reviewer has no stats row", async () => {
    // Reviewer has no user_stats row → weight defaults to 100/100 = 1.0
    dbMocks.selectChain.where
      .mockResolvedValueOnce([{ starRating: 5, reviewerUid: "unknown" }]) // reviews
      .mockReturnThis()  // reviewer stats chain
      .mockReturnThis(); // receiver stats chain

    dbMocks.selectChain.limit
      .mockResolvedValueOnce([])                                        // reviewer stats → absent
      .mockResolvedValueOnce([{ userUid: "alice", trustScore: 100 }]); // receiver stats

    await recalcUserRating("alice");

    // avg = 5, communityStanding = ((5-1)/4)*100 = 100
    expect(dbMocks.updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        averageRating: "5",
        reviewCount: 1,
        communityStanding: 100,
      }),
    );
  });
});
