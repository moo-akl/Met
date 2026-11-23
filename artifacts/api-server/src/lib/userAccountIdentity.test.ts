import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const chain = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    onConflictDoNothing: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
  };
  for (const method of [
    chain.select,
    chain.from,
    chain.insert,
    chain.values,
    chain.onConflictDoNothing,
    chain.update,
    chain.set,
  ]) {
    method.mockReturnValue(chain);
  }
  chain.where.mockReturnValue(chain);
  return {
    chain,
    db: {
      transaction: vi.fn(),
    },
  };
});

vi.mock("@workspace/db", () => ({
  db: mocks.db,
  communityEventsTable: { id: "event_id", ownerUid: "owner_uid", accountId: "account_id" },
  profilesTable: { uid: "profile_uid" },
  subscriptionsTable: { userUid: "subscription_uid", accountId: "subscription_account_id" },
  userAccountsTable: { accountId: "account_id", firebaseUid: "firebase_uid" },
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ op: "and", conditions }),
  eq: (column: unknown, value: unknown) => ({ op: "eq", column, value }),
  isNull: (column: unknown) => ({ op: "isNull", column }),
}));

import { ensureUserAccount } from "./userAccountIdentity";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.chain.select.mockReturnValue(mocks.chain);
  mocks.chain.from.mockReturnValue(mocks.chain);
  mocks.chain.where.mockReturnValue(mocks.chain);
  mocks.chain.insert.mockReturnValue(mocks.chain);
  mocks.chain.values.mockReturnValue(mocks.chain);
  mocks.chain.onConflictDoNothing.mockReturnValue(mocks.chain);
  mocks.chain.update.mockReturnValue(mocks.chain);
  mocks.chain.set.mockReturnValue(mocks.chain);
  mocks.db.transaction.mockImplementation(
    async (callback: (tx: typeof mocks.chain) => Promise<unknown>) => callback(mocks.chain),
  );
});

describe("ensureUserAccount", () => {
  it("keeps an existing account ID stable", async () => {
    const account = {
      accountId: "stable-met-id",
      firebaseUid: "legacy-user",
      status: "active",
      purgeAfter: null,
    };
    mocks.chain.limit.mockResolvedValueOnce([account]);

    const result = await ensureUserAccount("legacy-user");

    expect(result.accountId).toBe("stable-met-id");
    expect(mocks.chain.insert).not.toHaveBeenCalled();
    expect(mocks.chain.update).toHaveBeenCalledTimes(2);
  });

  it("keeps the Firebase UID for accounts with legacy profile, subscription, or event data", async () => {
    mocks.chain.limit
      .mockResolvedValueOnce([]) // account mapping
      .mockResolvedValueOnce([]) // profile lookup
      .mockResolvedValueOnce([{ userUid: "legacy-subscriber" }])
      .mockResolvedValueOnce([]) // event lookup
      .mockResolvedValueOnce([{
        accountId: "legacy-subscriber",
        firebaseUid: "legacy-subscriber",
        status: "active",
        purgeAfter: null,
      }]);

    await ensureUserAccount("legacy-subscriber");

    expect(mocks.chain.values).toHaveBeenCalledWith({
      accountId: "legacy-subscriber",
      firebaseUid: "legacy-subscriber",
    });
  });

  it("assigns new accounts an opaque stable ID", async () => {
    mocks.chain.limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        accountId: "generated-account-id",
        firebaseUid: "new-user",
        status: "active",
        purgeAfter: null,
      }]);

    await ensureUserAccount("new-user");

    const inserted = mocks.chain.values.mock.calls[0]?.[0] as {
      accountId: string;
      firebaseUid: string;
    };
    expect(inserted.firebaseUid).toBe("new-user");
    expect(inserted.accountId).not.toBe("new-user");
  });
});
