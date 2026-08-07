import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock handles — defined before vi.mock() factory runs.
// ---------------------------------------------------------------------------

const txMock = vi.hoisted(() => {
  const tx = {
    delete: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  return tx;
});

const dbMock = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: dbMock,
  profilesTable: { _name: "profiles" },
  encountersTable: { _name: "encounters" },
  revealRequestsTable: { _name: "reveal_requests" },
  referralCodesTable: { _name: "referral_codes" },
  referralRedemptionsTable: { _name: "referral_redemptions" },
  presenceTable: { _name: "presence" },
  pioneerReferralsTable: { _name: "pioneer_referrals" },
  hubCheckinsTable: { _name: "hub_checkins" },
  profileViewsTable: { _name: "profile_views" },
  reviewsTable: { _name: "reviews" },
  monthlyChampionsTable: { _name: "monthly_champions" },
  userReportsTable: { _name: "user_reports" },
  userStatsTable: { _name: "user_stats" },
  subscriptionsTable: { _name: "subscriptions" },
  networkMembersTable: { _name: "network_members" },
  networkAnnouncementsTable: { _name: "network_announcements" },
  networkPollVotesTable: { _name: "network_poll_votes" },
  networkQuestionnaireAnswersTable: { _name: "network_questionnaire_answers" },
  venueEventRsvpsTable: { _name: "venue_event_rsvps" },
}));

vi.mock("./firebaseAdmin", () => ({
  adminAuth: vi.fn(() => ({ deleteUser: vi.fn().mockResolvedValue(undefined) })),
  adminDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        collection: vi.fn(() => ({ listDocuments: vi.fn().mockResolvedValue([]) })),
        delete: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  })),
}));

vi.mock("./logger", () => ({ logger: { warn: vi.fn(), info: vi.fn() } }));

// ---------------------------------------------------------------------------
// Subject under test — imported after mocks are in place.
// ---------------------------------------------------------------------------

import { deleteUserData } from "./deleteUserData";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function captureDeletedTables(): { tables: unknown[] } {
  const tables: unknown[] = [];
  txMock.delete.mockImplementation((table: unknown) => {
    tables.push(table);
    return txMock;
  });
  return { tables };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  txMock.delete.mockReturnThis();
  txMock.where.mockResolvedValue(undefined);

  // Execute the transaction callback synchronously with the tx mock.
  dbMock.transaction.mockImplementation(async (cb: (tx: typeof txMock) => Promise<void>) => {
    await cb(txMock);
  });
});

describe("deleteUserData — Postgres cleanup", () => {
  it("deletes the user's RSVPs to other venues' events (attendee cleanup)", async () => {
    const { tables } = captureDeletedTables();
    const { venueEventRsvpsTable } = await import("@workspace/db");

    await deleteUserData("uid-alice");

    expect(tables).toContain(venueEventRsvpsTable);
  });

  it("deletes the user profile row", async () => {
    const { tables } = captureDeletedTables();
    const { profilesTable } = await import("@workspace/db");

    await deleteUserData("uid-alice");

    expect(tables).toContain(profilesTable);
  });

  it("deletes hub checkins", async () => {
    const { tables } = captureDeletedTables();
    const { hubCheckinsTable } = await import("@workspace/db");

    await deleteUserData("uid-alice");

    expect(tables).toContain(hubCheckinsTable);
  });

  it("deletes the profile row AFTER other tables (profile is last)", async () => {
    const { tables } = captureDeletedTables();
    const { profilesTable } = await import("@workspace/db");

    await deleteUserData("uid-alice");

    const profileIdx = tables.indexOf(profilesTable);
    // Profile must be last in the transaction.
    expect(profileIdx).toBe(tables.length - 1);
  });
});
