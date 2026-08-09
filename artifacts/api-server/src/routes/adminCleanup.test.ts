/**
 * Route tests for the admin Storage-cleanup endpoints:
 *   GET /api/admin/cleanup/orphaned-photos
 *   GET /api/admin/cleanup/failed-storage-cleanup
 */
import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Environment — set before any module loads.
// ---------------------------------------------------------------------------

process.env["ADMIN_SECRET"] = "test-admin-secret";
process.env["SESSION_SECRET"] = "test-session";
process.env["FIREBASE_SERVICE_ACCOUNT_JSON"] = JSON.stringify({
  project_id: "test",
  client_email: "test@test.com",
  private_key: "fake",
});

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

// Spy for the ordered .get() used by the failed-storage-cleanup list endpoint.
const fsGetSpy = vi.hoisted(() => vi.fn());
// Spy for the direct collection .get() used to reconcile stale queue records.
const fsQueueGetSpy = vi.hoisted(() => vi.fn().mockResolvedValue({ docs: [] }));
const fsBatchDeleteSpy = vi.hoisted(() => vi.fn().mockReturnThis());
const fsBatchCommitSpy = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

// Bucket mock — tests override getFiles and individual file.delete per case.
const bucketMock = vi.hoisted(() => ({
  getFiles: vi.fn().mockResolvedValue([[]]),
}));

// DB mock for Postgres profilesTable queries.
const dbMock = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../lib/firebaseAdmin", () => ({
  adminAuth: vi.fn(() => ({ deleteUser: vi.fn(), getUser: vi.fn() })),
  adminDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        collection: vi.fn(() => ({
          // Used by GET /api/admin/cleanup/failed-storage-cleanup (ordered list).
          orderBy: vi.fn(() => ({
            get: fsGetSpy,
          })),
          // Used by GET /api/admin/cleanup/orphaned-photos?dry_run=false
          // to reconcile stale queue records (direct collection get).
          get: fsQueueGetSpy,
          doc: vi.fn(() => ({
            delete: vi.fn().mockResolvedValue(undefined),
          })),
          listDocuments: vi.fn().mockResolvedValue([]),
        })),
        delete: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    batch: vi.fn(() => ({
      delete: fsBatchDeleteSpy,
      commit: fsBatchCommitSpy,
    })),
  })),
  adminStorage: vi.fn(() => ({
    bucket: vi.fn(() => bucketMock),
  })),
  adminMessaging: vi.fn(),
  tryInitAdmin: vi.fn(() => null),
}));

vi.mock("@workspace/db", () => ({
  db: dbMock,
  profilesTable: { uid: "uid" },
  // Other tables referenced by the app module at import time.
  encountersTable: {},
  revealRequestsTable: {},
  referralCodesTable: {},
  referralRedemptionsTable: {},
  presenceTable: {},
  pioneerReferralsTable: {},
  hubCheckinsTable: {},
  profileViewsTable: {},
  reviewsTable: {},
  monthlyChampionsTable: {},
  userReportsTable: {},
  userStatsTable: {},
  subscriptionsTable: {},
  networkMembersTable: {},
  networkAnnouncementsTable: {},
  networkPollVotesTable: {},
  networkQuestionnaireAnswersTable: {},
  venueEventRsvpsTable: {},
  venueOwnerProfilesTable: {},
  venueApplicationHistoryTable: {},
  venueAdminCredentialsTable: {},
  venueBusinessesTable: {},
  venueMembershipsTable: {},
  venueMembershipAuditTable: {},
  venueEventsTable: {},
  venueRewardsTable: {},
  venueAnnouncementsTable: {},
}));

vi.mock("drizzle-orm", async (importActual) => {
  const actual = await importActual<typeof import("drizzle-orm")>();
  return { ...actual };
});

vi.mock("../middlewares/requireUid", () => ({
  requireUid: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../middlewares/rateLimit", () => ({
  createUserRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createIpRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// ---------------------------------------------------------------------------
// App — imported after mocks are registered.
// ---------------------------------------------------------------------------

import request from "supertest";
import app from "../app";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_HEADER = { "x-admin-secret": "test-admin-secret" };

/** Create a fake Storage file object with a controllable delete. */
function makeFile(name: string, deleteFn = vi.fn().mockResolvedValue(undefined)) {
  return { name, delete: deleteFn };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeAll(() => {
  delete process.env["REDIS_URL"];
});

beforeEach(() => {
  vi.clearAllMocks();
  bucketMock.getFiles.mockResolvedValue([[]]);
  dbMock.select.mockReturnThis();
  dbMock.from.mockReturnThis();
  dbMock.where.mockResolvedValue([]);
  fsBatchCommitSpy.mockResolvedValue(undefined);
  fsBatchDeleteSpy.mockReturnThis();
  fsGetSpy.mockResolvedValue({ docs: [] });
  // Default: failure queue is empty — no stale records to reconcile.
  fsQueueGetSpy.mockResolvedValue({ docs: [] });
});

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe("GET /api/admin/cleanup/orphaned-photos — auth", () => {
  it("returns 401 when the admin secret is wrong", async () => {
    const res = await request(app)
      .get("/api/admin/cleanup/orphaned-photos")
      .set("x-admin-secret", "wrong");
    expect(res.status).toBe(401);
  });

  it("returns 503 when ADMIN_SECRET is not set", async () => {
    const saved = process.env["ADMIN_SECRET"];
    delete process.env["ADMIN_SECRET"];
    const res = await request(app)
      .get("/api/admin/cleanup/orphaned-photos")
      .set(ADMIN_HEADER);
    expect(res.status).toBe(503);
    process.env["ADMIN_SECRET"] = saved;
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/cleanup/orphaned-photos — dry run (default)
// ---------------------------------------------------------------------------

describe("GET /api/admin/cleanup/orphaned-photos — dry run", () => {
  it("returns orphaned UIDs without deleting anything when no profiles exist", async () => {
    bucketMock.getFiles.mockResolvedValue([
      [makeFile("profile-photos/uid-deleted.jpg")],
    ]);
    // Postgres has no matching profile row → orphaned.
    dbMock.where.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/admin/cleanup/orphaned-photos?dry_run=true")
      .set(ADMIN_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.orphaned_uids).toContain("uid-deleted");
    expect(res.body.deleted).toBe(false);
  });

  it("does NOT flag a photo as orphaned when the owner profile still exists", async () => {
    bucketMock.getFiles.mockResolvedValue([
      [makeFile("profile-photos/active-user.jpg")],
    ]);
    // Postgres returns a matching row → active user.
    dbMock.where.mockResolvedValue([{ uid: "active-user" }]);

    const res = await request(app)
      .get("/api/admin/cleanup/orphaned-photos?dry_run=true")
      .set(ADMIN_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.orphaned_uids).not.toContain("active-user");
    expect(res.body.orphaned_count).toBe(0);
  });

  it("correctly extracts UIDs that contain periods (dotted UIDs must not be truncated)", async () => {
    // Firebase UIDs may contain periods — "user.name" must not be truncated to "user".
    bucketMock.getFiles.mockResolvedValue([
      [makeFile("profile-photos/user.name.jpg")],
    ]);
    // Postgres has no matching row for the full UID "user.name".
    dbMock.where.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/admin/cleanup/orphaned-photos?dry_run=true")
      .set(ADMIN_HEADER);

    expect(res.status).toBe(200);
    // The returned UID must be the full "user.name", not just "user".
    expect(res.body.orphaned_uids).toContain("user.name");
    expect(res.body.orphaned_uids).not.toContain("user");
  });

  it("does not return files that have no recognised image extension", async () => {
    bucketMock.getFiles.mockResolvedValue([
      [makeFile("profile-photos/uid-noext")],
    ]);
    dbMock.where.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/admin/cleanup/orphaned-photos?dry_run=true")
      .set(ADMIN_HEADER);

    expect(res.status).toBe(200);
    // Files without a recognised extension are skipped.
    expect(res.body.orphaned_uids).not.toContain("uid-noext");
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/cleanup/orphaned-photos — dry_run=false (deletion)
// ---------------------------------------------------------------------------

describe("GET /api/admin/cleanup/orphaned-photos — deletion", () => {
  it("deletes orphaned files and clears the Firestore failure record on full success", async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    bucketMock.getFiles.mockResolvedValue([
      [makeFile("profile-photos/gone-uid.jpg", deleteFn)],
    ]);
    dbMock.where.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/admin/cleanup/orphaned-photos?dry_run=false")
      .set(ADMIN_HEADER);

    expect(res.status).toBe(200);
    expect(deleteFn).toHaveBeenCalled();
    expect(res.body.deleted_files).toContain("profile-photos/gone-uid.jpg");
    // Firestore batch commit should be called to clear the failure record.
    expect(fsBatchCommitSpy).toHaveBeenCalled();
  });

  it("does NOT clear the Firestore failure record when a file deletion fails (partial failure)", async () => {
    const deleteOk = vi.fn().mockResolvedValue(undefined);
    const deleteErr = vi.fn().mockRejectedValue(new Error("quota exceeded"));
    // Both files resolve to the same uid "partial-uid" so they are treated as
    // one uid group — if any file fails, the uid must not be cleared.
    bucketMock.getFiles.mockResolvedValue([
      [
        makeFile("profile-photos/partial-uid.jpg", deleteOk),
        makeFile("profile-photos/partial-uid.png", deleteErr),
      ],
    ]);
    dbMock.where.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/admin/cleanup/orphaned-photos?dry_run=false")
      .set(ADMIN_HEADER);

    expect(res.status).toBe(200);
    // One file succeeded, one failed.
    expect(res.body.deleted_files).toContain("profile-photos/partial-uid.jpg");
    expect(res.body.errors).toHaveLength(1);
    // The Firestore failure record must NOT be cleared because not all files were removed.
    expect(fsBatchCommitSpy).not.toHaveBeenCalled();
  });

  it("does not delete files belonging to active users", async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    bucketMock.getFiles.mockResolvedValue([
      [makeFile("profile-photos/active-uid.jpg", deleteFn)],
    ]);
    // Active profile exists in Postgres.
    dbMock.where.mockResolvedValue([{ uid: "active-uid" }]);

    const res = await request(app)
      .get("/api/admin/cleanup/orphaned-photos?dry_run=false")
      .set(ADMIN_HEADER);

    expect(res.status).toBe(200);
    expect(deleteFn).not.toHaveBeenCalled();
    expect(res.body.deleted_count).toBe(0);
  });

  it("treats a 404 Storage response as success (file already gone) and clears the Firestore record", async () => {
    // The file is already absent — delete() throws a 404.
    const alreadyGone = vi.fn().mockRejectedValue(
      Object.assign(new Error("not found"), { code: 404 }),
    );
    bucketMock.getFiles.mockResolvedValue([
      [makeFile("profile-photos/already-gone.jpg", alreadyGone)],
    ]);
    dbMock.where.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/admin/cleanup/orphaned-photos?dry_run=false")
      .set(ADMIN_HEADER);

    expect(res.status).toBe(200);
    // 404 is a success — no errors reported.
    expect(res.body.errors).toHaveLength(0);
    // The uid is fully cleaned → Firestore failure record should be cleared.
    expect(fsBatchCommitSpy).toHaveBeenCalled();
  });

  it("clears a stale Firestore failure record when a queued uid has no Storage files left", async () => {
    // Storage has no files at all for this run.
    bucketMock.getFiles.mockResolvedValue([[]]);
    dbMock.where.mockResolvedValue([]);

    // But the Firestore queue has a stale record for a uid whose files are gone.
    fsQueueGetSpy.mockResolvedValue({
      docs: [{ id: "stale-uid", data: () => ({ uid: "stale-uid" }) }],
    });

    const res = await request(app)
      .get("/api/admin/cleanup/orphaned-photos?dry_run=false")
      .set(ADMIN_HEADER);

    expect(res.status).toBe(200);
    // The stale queue record for "stale-uid" should be reconciled/cleared.
    expect(fsBatchCommitSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/cleanup/failed-storage-cleanup
// ---------------------------------------------------------------------------

describe("GET /api/admin/cleanup/failed-storage-cleanup", () => {
  it("returns 401 when the admin secret is wrong", async () => {
    const res = await request(app)
      .get("/api/admin/cleanup/failed-storage-cleanup")
      .set("x-admin-secret", "wrong");
    expect(res.status).toBe(401);
  });

  it("returns an empty list when there are no failure records", async () => {
    fsGetSpy.mockResolvedValue({ docs: [] });

    const res = await request(app)
      .get("/api/admin/cleanup/failed-storage-cleanup")
      .set(ADMIN_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.records).toEqual([]);
  });

  it("returns persisted failure records ordered by failedAt", async () => {
    const record = { uid: "uid-carol", failedAt: "2026-08-01T00:00:00.000Z", failedFiles: ["profile-photos/uid-carol.jpg"] };
    fsGetSpy.mockResolvedValue({
      docs: [{ data: () => record }],
    });

    const res = await request(app)
      .get("/api/admin/cleanup/failed-storage-cleanup")
      .set(ADMIN_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.records[0]).toMatchObject({ uid: "uid-carol" });
  });
});
