import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock handles — defined before vi.mock() factory runs.
// ---------------------------------------------------------------------------

const txMock = vi.hoisted(() => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
  };
  const tx = {
    select: vi.fn(() => selectChain),
    delete: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return tx;
});

const dbMock = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

// A `set` spy exposed so tests can assert on Firestore failure records.
const fsSetSpy = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const recursiveDeleteSpy = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

// adminDb returns a mock that handles both call paths used in deleteUserData:
//   deleteFirestoreUserData: collection("users").doc(uid).collection(sub).listDocuments()
//   deleteStorageAssets:     collection("admin").doc(...).collection("uids").doc(uid).set({})
const adminDbMock = vi.hoisted(() =>
  vi.fn(() => ({
    recursiveDelete: recursiveDeleteSpy,
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        // Used by deleteFirestoreUserData (user sub-collections).
        collection: vi.fn(() => ({
          listDocuments: vi.fn().mockResolvedValue([]),
          // Used by deleteStorageAssets (admin/failed-storage-cleanup/uids/{uid}).
          doc: vi.fn(() => ({
            set: fsSetSpy,
            delete: vi.fn().mockResolvedValue(undefined),
          })),
        })),
        delete: vi.fn().mockResolvedValue(undefined),
        set: fsSetSpy,
      })),
    })),
    batch: vi.fn(() => ({
      delete: vi.fn().mockReturnThis(),
      commit: vi.fn().mockResolvedValue(undefined),
    })),
  })),
);

// Storage bucket mock — default: getFiles returns no files.
const bucketMock = vi.hoisted(() => ({
  getFiles: vi.fn().mockResolvedValue([[]]),
}));

const adminStorageMock = vi.hoisted(() =>
  vi.fn(() => ({ bucket: vi.fn(() => bucketMock) })),
);

vi.mock("@workspace/db", () => ({
  venueGuestbookTable: { _name: "venue_guestbook" },
  venueGuestbookBlocksTable: { _name: "venue_guestbook_blocks" },
  db: dbMock,
  profilesTable: { _name: "profiles" },
  encountersTable: { _name: "encounters" },
  revealRequestsTable: { _name: "reveal_requests" },
  referralCodesTable: { _name: "referral_codes" },
  referralRedemptionsTable: { _name: "referral_redemptions" },
  presenceTable: { _name: "presence" },
  pioneerReferralsTable: { _name: "pioneer_referrals" },
  hubCheckinsTable: { _name: "hub_checkins" },
  venueQrVerificationsTable: { _name: "venue_qr_verifications" },
  venueReviewsTable: { _name: "venue_reviews" },
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
  venueEventWelcomeNoteDeliveriesTable: { _name: "venue_event_welcome_note_deliveries" },
  communityEventWelcomeNoteDeliveriesTable: { _name: "community_event_welcome_note_deliveries" },
  communityEventsTable: {
    _name: "community_events",
    id: "id",
    ownerUid: "ownerUid",
    accountId: "accountId",
    inviteeUids: "inviteeUids",
    updatedAt: "updatedAt",
  },
  communityEventRsvpsTable: { _name: "community_event_rsvps", eventId: "eventId", userUid: "userUid" },
  communityEventPlanMessagesTable: { _name: "community_event_plan_messages", senderUid: "senderUid", mediaObjectPath: "mediaObjectPath" },
  communityEventPlanMediaUploadsTable: { _name: "community_event_plan_media_uploads", ownerUid: "ownerUid", eventId: "eventId", objectPath: "objectPath" },
  communityEventPlanNotificationPreferencesTable: { _name: "community_event_plan_notification_preferences", userUid: "userUid" },
  communityEventJoinRequestsTable: { _name: "community_event_join_requests", userUid: "userUid" },
  communityEventHostRatingsTable: { _name: "community_event_host_ratings", reviewerUid: "reviewerUid" },
  eventAttendanceTable: { _name: "event_attendance", eventType: "eventType", eventId: "eventId", userUid: "userUid" },
  eventAttendanceCorrectionsTable: {
    _name: "event_attendance_corrections",
    eventType: "eventType",
    eventId: "eventId",
    userUid: "userUid",
    actorUid: "actorUid",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ op: "and", conditions }),
  eq: (column: unknown, value: unknown) => ({ op: "eq", column, value }),
  inArray: (column: unknown, values: unknown) => ({ op: "inArray", column, values }),
  or: (...conditions: unknown[]) => ({ op: "or", conditions }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    { raw: (text: string) => ({ text }) },
  ),
}));

vi.mock("./firebaseAdmin", () => ({
  adminAuth: vi.fn(() => ({ deleteUser: vi.fn().mockResolvedValue(undefined) })),
  adminDb: adminDbMock,
  adminStorage: adminStorageMock,
}));

vi.mock("./logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

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
    return await cb(txMock);
  });

  // Default: Storage lists no files — nothing to delete, no failures.
  bucketMock.getFiles.mockResolvedValue([[]]);
});

describe("deleteUserData — Postgres cleanup", () => {
  it("removes private saved places when the account is deleted", async () => {
    await deleteUserData("uid-saved");
    expect(recursiveDeleteSpy).toHaveBeenCalledOnce();
    const firestore = adminDbMock.mock.results[0]!.value;
    expect(firestore.collection).toHaveBeenCalledWith("savedPlaces");
  });
  it("removes guestbook memories and both directions of guestbook blocks", async () => {
    const { tables } = captureDeletedTables();
    const { venueGuestbookTable, venueGuestbookBlocksTable } = await import("@workspace/db");
    await deleteUserData("uid-guestbook");
    expect(tables).toContain(venueGuestbookTable);
    expect(tables).toContain(venueGuestbookBlocksTable);
  });
  it("deletes the user's RSVPs to other venues' events (attendee cleanup)", async () => {
    const { tables } = captureDeletedTables();
    const {
      venueEventRsvpsTable,
      venueEventWelcomeNoteDeliveriesTable,
      communityEventWelcomeNoteDeliveriesTable,
    } = await import("@workspace/db");

    await deleteUserData("uid-alice");

    expect(tables).toContain(venueEventRsvpsTable);
    expect(tables).toContain(venueEventWelcomeNoteDeliveriesTable);
    expect(tables).toContain(communityEventWelcomeNoteDeliveriesTable);
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

  it("erases private QR visits and venue reviews on account deletion", async () => {
    const { tables } = captureDeletedTables();
    const { venueQrVerificationsTable, venueReviewsTable } = await import("@workspace/db");
    await deleteUserData("uid-alice");
    expect(tables).toContain(venueQrVerificationsTable);
    expect(tables).toContain(venueReviewsTable);
  });
  it("purges member-created events, their dependent rows, and subscription usage sources", async () => {
    const { tables } = captureDeletedTables();
    const {
      communityEventsTable,
      communityEventRsvpsTable,
      communityEventPlanMessagesTable,
      communityEventPlanMediaUploadsTable,
      communityEventPlanNotificationPreferencesTable,
      communityEventJoinRequestsTable,
      communityEventHostRatingsTable,
      subscriptionsTable,
      eventAttendanceTable,
      eventAttendanceCorrectionsTable,
    } = await import("@workspace/db");

    await deleteUserData("uid-member", { accountId: "stable-account-id", strictCleanup: true });

    expect(tables).toContain(communityEventRsvpsTable);
    expect(tables).toContain(communityEventPlanMessagesTable);
    expect(tables).toContain(communityEventPlanMediaUploadsTable);
    expect(tables).toContain(communityEventPlanNotificationPreferencesTable);
    expect(tables).toContain(communityEventJoinRequestsTable);
    expect(tables).toContain(communityEventHostRatingsTable);
    expect(tables).toContain(communityEventsTable);
    expect(tables).toContain(subscriptionsTable);
    expect(tables).toContain(eventAttendanceTable);
    expect(tables).toContain(eventAttendanceCorrectionsTable);
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

describe("deleteUserData — Storage cleanup failure recording", () => {
  it("removes visit photos by their exact account prefix, even if profile listing fails", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    bucketMock.getFiles.mockImplementation(async ({ prefix }: { prefix: string }) => {
      if (prefix.startsWith("profile-photos/")) throw new Error("Profile list unavailable");
      return [[{ name: "venue-guestbook/uid-visit/photo.jpg", delete: remove }]];
    });
    await deleteUserData("uid-visit");
    expect(bucketMock.getFiles).toHaveBeenCalledWith({ prefix: "venue-guestbook/uid-visit/" });
    expect(remove).toHaveBeenCalledOnce();
    expect(fsSetSpy).toHaveBeenCalled(); // failed profile prefix remains retryable
  });
  it("does not write a failure record when Storage deletion succeeds", async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    bucketMock.getFiles.mockResolvedValue([
      [{ name: "profile-photos/uid-bob.jpg", delete: deleteFn }],
    ]);

    await deleteUserData("uid-bob");

    expect(deleteFn).toHaveBeenCalled();
    // No Firestore failure record should be written.
    expect(fsSetSpy).not.toHaveBeenCalled();
  });

  it("writes a failure record to Firestore when a file delete fails (non-404)", async () => {
    const storageErr = Object.assign(new Error("permission denied"), { code: 403 });
    const deleteFn = vi.fn().mockRejectedValue(storageErr);

    bucketMock.getFiles.mockResolvedValue([
      [{ name: "profile-photos/uid-carol.jpg", delete: deleteFn }],
    ]);

    await deleteUserData("uid-carol");

    expect(fsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "uid-carol",
        failedFiles: ["profile-photos/uid-carol.jpg"],
      }),
    );
  });

  it("ignores 404 file-not-found errors (file already gone) and does not record a failure", async () => {
    const notFoundErr = Object.assign(new Error("not found"), { code: 404 });
    const deleteFn = vi.fn().mockRejectedValue(notFoundErr);

    bucketMock.getFiles.mockResolvedValue([
      [{ name: "profile-photos/uid-dave.jpg", delete: deleteFn }],
    ]);

    await deleteUserData("uid-dave");

    expect(deleteFn).toHaveBeenCalled();
    // 404 means file is already gone — not a cleanup failure.
    expect(fsSetSpy).not.toHaveBeenCalled();
  });

  it("writes a failure record when getFiles itself fails (list error)", async () => {
    bucketMock.getFiles.mockRejectedValue(new Error("storage unavailable"));

    await deleteUserData("uid-eve");

    expect(fsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "uid-eve",
        error: "failed to list files",
      }),
    );
  });

  it("records only the failed files when some succeed and some fail (partial failure)", async () => {
    const deleteOk = vi.fn().mockResolvedValue(undefined);
    const deleteErr = vi.fn().mockRejectedValue(
      Object.assign(new Error("quota exceeded"), { code: 429 }),
    );

    bucketMock.getFiles.mockResolvedValue([
      [
        { name: "profile-photos/uid-frank.jpg", delete: deleteOk },
        { name: "profile-photos/uid-frank-backup.jpg", delete: deleteErr },
      ],
    ]);

    await deleteUserData("uid-frank");

    // Only the failing file is recorded; the successful one is not.
    expect(fsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "uid-frank",
        failedFiles: ["profile-photos/uid-frank-backup.jpg"],
      }),
    );
    // The successful file is NOT in the failedFiles list.
    const callArg = fsSetSpy.mock.calls[0][0] as { failedFiles: string[] };
    expect(callArg.failedFiles).not.toContain("profile-photos/uid-frank.jpg");
  });
});
