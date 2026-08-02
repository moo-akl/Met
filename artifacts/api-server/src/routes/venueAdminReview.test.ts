/**
 * Venue Admin review workspace — route coverage.
 *
 * Focus is the reviewer-facing contract: only the session-backed API is
 * reachable, the queue only offers genuinely actionable applications, a
 * repeated or concurrent decision cannot overwrite a newer one, and internal
 * reviewer notes never leak into applicant-facing responses.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env["ADMIN_SECRET"] = "test-admin-secret";
process.env["SESSION_SECRET"] = "test-session-secret";

const dbMocks = vi.hoisted(() => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn(),
    groupBy: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    transaction: vi.fn(),
  };
  return { chain };
});

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  venueOwnerProfilesTable: {
    id: "id",
    ownerUid: "ownerUid",
    placeId: "placeId",
    applicationStatus: "applicationStatus",
    submittedAt: "submittedAt",
    createdAt: "createdAt",
  },
  venueApplicationHistoryTable: {
    id: "id",
    venueOwnerProfileId: "venueOwnerProfileId",
    eventType: "eventType",
    fromStatus: "fromStatus",
    toStatus: "toStatus",
    actorRole: "actorRole",
    actorUid: "actorUid",
    applicantMessage: "applicantMessage",
    internalNote: "internalNote",
    metadata: "metadata",
    createdAt: "createdAt",
  },
  venueEventsTable: {},
  venueEventRsvpsTable: {},
  venueRewardsTable: {},
  venueAnnouncementsTable: {},
  hubCheckinsTable: {},
  profilesTable: {},
}));

vi.mock("../middlewares/requireUid", () => ({
  requireUid: (req: { uid?: string }, _res: unknown, next: () => void) => {
    req.uid = "venue-owner-uid";
    next();
  },
}));

vi.mock("../middlewares/rateLimit", () => ({
  createUserRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createIpRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const pushMock = vi.fn().mockResolvedValue(undefined);
vi.mock("../lib/push", () => ({ sendPush: (...args: unknown[]) => pushMock(...args) }));

import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import venueOwnerRouter from "./venueOwner";

const app = express();
app.use(express.json());
app.use(cookieParser(process.env["SESSION_SECRET"]));
app.use("/api", venueOwnerRouter);

type Status =
  | "submitted"
  | "under_review"
  | "resubmitted"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "expired";

function application(overrides: { id?: number; applicationStatus?: Status } = {}) {
  return {
    id: overrides.id ?? 7,
    ownerUid: "venue-owner-uid",
    placeId: "google-place-1",
    placeName: "The Corner",
    businessName: "Corner Social",
    lat: "40.7128",
    lng: "-74.006",
    tagline: null,
    description: null,
    coverPhotoUrl: null,
    logoUrl: null,
    verificationDocUrl: "https://example.com/proof.pdf",
    registrationNotes: null,
    isApproved: false,
    isVerified: false,
    rejectionReason: null,
    applicationStatus: overrides.applicationStatus ?? "submitted",
    submittedAt: new Date("2026-07-01T10:00:00.000Z"),
    reviewedAt: null,
    approvedAt: null,
    rejectedAt: null,
    withdrawnAt: null,
    expiredAt: null,
    createdAt: new Date("2026-07-01T10:00:00.000Z"),
    updatedAt: new Date("2026-07-01T10:00:00.000Z"),
  };
}

/** Signs in and returns a supertest agent carrying the HttpOnly session cookie. */
async function signedInAgent() {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/admin/venue-owner/session")
    .send({ secret: "test-admin-secret" });
  expect(res.status).toBe(200);
  return agent;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockReturnThis();
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.insert.mockReturnThis();
  dbMocks.chain.update.mockReturnThis();
  dbMocks.chain.set.mockReturnThis();
  dbMocks.chain.values.mockResolvedValue(undefined);
  dbMocks.chain.orderBy.mockResolvedValue([]);
  dbMocks.chain.groupBy.mockResolvedValue([]);
  dbMocks.chain.limit.mockResolvedValue([]);
  dbMocks.chain.returning.mockResolvedValue([]);
  dbMocks.chain.transaction.mockImplementation(
    async (cb: (tx: typeof dbMocks.chain) => unknown) => cb(dbMocks.chain),
  );
});

describe("admin session authorization", () => {
  const guarded: Array<[string, string]> = [
    ["get", "/api/admin/venue-owner/applications"],
    ["get", "/api/admin/venue-owner/applications/7"],
    ["post", "/api/admin/venue-owner/applications/7/start-review"],
    ["post", "/api/admin/venue-owner/applications/7/approve"],
    ["post", "/api/admin/venue-owner/applications/7/reject"],
    ["post", "/api/admin/venue-owner/applications/7/request-changes"],
    ["post", "/api/admin/venue-owner/applications/7/withdraw"],
    ["post", "/api/admin/venue-owner/applications/7/notes"],
  ];

  it.each(guarded)("rejects %s %s without a session", async (method, path) => {
    const res = await (method === "get"
      ? request(app).get(path)
      : request(app).post(path).send({ reason: "not ok", message: "fix it", internalNote: "x" }));
    expect(res.status).toBe(401);
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
  });

  it("refuses a wrong admin credential without issuing a cookie", async () => {
    const res = await request(app)
      .post("/api/admin/venue-owner/session")
      .send({ secret: "wrong-secret" });
    expect(res.status).toBe(401);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("does not accept the retired header-secret review endpoints", async () => {
    const res = await request(app)
      .get("/api/admin/venue-owner/pending")
      .set("x-admin-secret", "test-admin-secret");
    expect(res.status).toBe(404);
  });
});

describe("review queue filtering", () => {
  it("defaults to applications that are actually awaiting a decision", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.orderBy.mockResolvedValueOnce([application()]);
    dbMocks.chain.groupBy.mockResolvedValueOnce([
      { status: "submitted", total: 1 },
      { status: "approved", total: 4 },
    ]);

    const res = await agent.get("/api/admin/venue-owner/applications");

    expect(res.status).toBe(200);
    expect(res.body.applications).toHaveLength(1);
    expect(res.body.applications[0].status).toBe("submitted");
    expect(res.body.applications[0].statusLabel).toBe("Submitted");
    // Counts span every status so the reviewer can see decided work exists.
    expect(res.body.counts).toEqual({ submitted: 1, approved: 4 });
  });

  it("rejects an unknown status filter instead of silently returning the queue", async () => {
    const agent = await signedInAgent();
    const res = await agent.get("/api/admin/venue-owner/applications?status=nonsense");
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("nonsense");
  });

  it("rejects an unparseable date filter", async () => {
    const agent = await signedInAgent();
    const res = await agent.get("/api/admin/venue-owner/applications?from=not-a-date");
    expect(res.status).toBe(400);
  });

  it("accepts an explicit multi-status filter and a date window", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.orderBy.mockResolvedValueOnce([application({ applicationStatus: "approved" })]);
    const res = await agent.get(
      "/api/admin/venue-owner/applications?status=approved,rejected&from=2026-01-01T00:00:00.000Z&to=2026-12-31T00:00:00.000Z",
    );
    expect(res.status).toBe(200);
    expect(res.body.applications[0].status).toBe("approved");
  });

  it("returns a recently resubmitted application in the date-filtered review queue", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.orderBy.mockResolvedValueOnce([
      {
        ...application({ applicationStatus: "resubmitted" }),
        createdAt: new Date("2025-01-01T10:00:00.000Z"),
        submittedAt: new Date("2026-08-01T10:00:00.000Z"),
      },
    ]);

    const res = await agent.get(
      "/api/admin/venue-owner/applications?status=queue&from=2026-08-01T00:00:00.000Z&to=2026-08-02T00:00:00.000Z&search=Corner",
    );

    expect(res.status).toBe(200);
    expect(res.body.applications).toHaveLength(1);
    expect(res.body.applications[0].status).toBe("resubmitted");
    expect(dbMocks.chain.where).toHaveBeenCalled();
    expect(dbMocks.chain.orderBy).toHaveBeenCalled();
  });
});

describe("review detail and notes", () => {
  it("returns the full audit trail including internal notes", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application()]);
    dbMocks.chain.orderBy.mockResolvedValueOnce([
      {
        id: 1,
        eventType: "submitted",
        fromStatus: null,
        toStatus: "submitted",
        actorRole: "applicant",
        actorUid: "venue-owner-uid",
        applicantMessage: "Application submitted for review.",
        internalNote: null,
        createdAt: new Date("2026-07-01T10:00:00.000Z"),
      },
      {
        id: 2,
        eventType: "review_note_added",
        fromStatus: "submitted",
        toStatus: "submitted",
        actorRole: "admin",
        actorUid: null,
        applicantMessage: null,
        internalNote: "Proof looks photoshopped, second opinion needed",
        createdAt: new Date("2026-07-02T10:00:00.000Z"),
      },
    ]);

    const res = await agent.get("/api/admin/venue-owner/applications/7");

    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(2);
    expect(res.body.history[1].internalNote).toContain("second opinion");
    expect(res.body.history[1].actorRole).toBe("admin");
  });

  it("records an internal note without changing the decision", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application()]);

    const res = await agent
      .post("/api/admin/venue-owner/applications/7/notes")
      .send({ internalNote: "Called the owner, awaiting a utility bill" });

    expect(res.status).toBe(201);
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
    expect(dbMocks.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "review_note_added",
        internalNote: "Called the owner, awaiting a utility bill",
        actorRole: "admin",
        fromStatus: "submitted",
        toStatus: "submitted",
      }),
    );
  });

  it("requires a non-empty internal note", async () => {
    const agent = await signedInAgent();
    const res = await agent
      .post("/api/admin/venue-owner/applications/7/notes")
      .send({ internalNote: "   " });
    expect(res.status).toBe(400);
  });

  it("keeps internal notes out of the applicant-facing status response", async () => {
    dbMocks.chain.limit.mockResolvedValueOnce([application()]);
    dbMocks.chain.orderBy.mockResolvedValueOnce([
      {
        id: 2,
        eventType: "review_note_added",
        fromStatus: "submitted",
        toStatus: "submitted",
        applicantMessage: null,
        createdAt: new Date(),
      },
    ]);

    const res = await request(app).get("/api/venue-owner/me/application");

    expect(res.status).toBe(200);
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("internalNote");
    expect(serialized).not.toContain("actorUid");
  });
});

describe("decisions are single-shot", () => {
  it("approves an application awaiting review and notifies the applicant", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application()]);
    dbMocks.chain.returning.mockResolvedValueOnce([
      { ...application(), applicationStatus: "approved", isApproved: true },
    ]);

    const res = await agent
      .post("/api/admin/venue-owner/applications/7/approve")
      .send({ internalNote: "Deed matches the business name" });

    expect(res.status).toBe(200);
    expect(res.body.profile.status).toBe("approved");
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(dbMocks.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "approved",
        fromStatus: "submitted",
        toStatus: "approved",
        internalNote: "Deed matches the business name",
      }),
    );
  });

  it("refuses a repeated decision on an already-approved application", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application({ applicationStatus: "approved" })]);

    const res = await agent.post("/api/admin/venue-owner/applications/7/approve").send({});

    expect(res.status).toBe(409);
    expect(res.body.currentStatus).toBe("approved");
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("refuses to overwrite a decision made while the reviewer was deciding", async () => {
    const agent = await signedInAgent();
    // Reviewer opened the dialog on `submitted`; a colleague already rejected it.
    dbMocks.chain.limit.mockResolvedValueOnce([application({ applicationStatus: "rejected" })]);

    const res = await agent
      .post("/api/admin/venue-owner/applications/7/approve")
      .send({ expectedStatus: "submitted" });

    expect(res.status).toBe(409);
    expect(res.body.currentStatus).toBe("rejected");
    expect(res.body.message).toContain("Refresh");
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
  });

  it("reports a conflict when the row moves between the read and the write", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application()]);
    // The guarded UPDATE matches nothing because a concurrent decision landed first.
    dbMocks.chain.returning.mockResolvedValueOnce([]);

    const res = await agent.post("/api/admin/venue-owner/applications/7/approve").send({});

    expect(res.status).toBe(409);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("requires an applicant-facing reason to reject", async () => {
    const agent = await signedInAgent();
    const res = await agent
      .post("/api/admin/venue-owner/applications/7/reject")
      .send({ internalNote: "obvious spam" });
    expect(res.status).toBe(400);
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
  });

  it("separates the applicant message from the internal note when rejecting", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application()]);
    dbMocks.chain.returning.mockResolvedValueOnce([
      { ...application(), applicationStatus: "rejected" },
    ]);

    const res = await agent.post("/api/admin/venue-owner/applications/7/reject").send({
      reason: "The ownership document is illegible.",
      internalNote: "Third attempt from this owner",
    });

    expect(res.status).toBe(200);
    expect(dbMocks.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        applicantMessage: "The ownership document is illegible.",
        internalNote: "Third attempt from this owner",
      }),
    );
    expect(pushMock).toHaveBeenCalledWith(
      "venue-owner-uid",
      expect.objectContaining({
        data: { type: "venue_owner_rejected", placeId: "google-place-1" },
      }),
    );
  });

  it("hands an application back for changes without ending the claim", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application()]);
    dbMocks.chain.returning.mockResolvedValueOnce([
      { ...application(), applicationStatus: "changes_requested" },
    ]);

    const res = await agent
      .post("/api/admin/venue-owner/applications/7/request-changes")
      .send({ message: "Send a utility bill showing the venue address." });

    expect(res.status).toBe(200);
    expect(res.body.profile.status).toBe("changes_requested");
    expect(res.body.profile.statusLabel).toBe("Changes requested");
    expect(dbMocks.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "changes_requested",
        toStatus: "changes_requested",
        applicantMessage: "Send a utility bill showing the venue address.",
      }),
    );
    expect(pushMock).toHaveBeenCalledWith(
      "venue-owner-uid",
      expect.objectContaining({
        data: { type: "venue_owner_changes_requested", placeId: "google-place-1" },
      }),
    );
  });

  it("requires a message when asking the applicant for changes", async () => {
    const agent = await signedInAgent();
    const res = await agent
      .post("/api/admin/venue-owner/applications/7/request-changes")
      .send({ message: "no" });
    expect(res.status).toBe(400);
  });

  it("lets a reviewer withdraw an application that is still with the applicant", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([
      application({ applicationStatus: "changes_requested" }),
    ]);
    dbMocks.chain.returning.mockResolvedValueOnce([
      { ...application(), applicationStatus: "withdrawn" },
    ]);

    const res = await agent
      .post("/api/admin/venue-owner/applications/7/withdraw")
      .send({ reason: "Duplicate of an existing claim." });

    expect(res.status).toBe(200);
    expect(res.body.profile.status).toBe("withdrawn");
    expect(pushMock).toHaveBeenCalledWith(
      "venue-owner-uid",
      expect.objectContaining({
        data: { type: "venue_owner_withdrawn", placeId: "google-place-1" },
      }),
    );
  });

  it("cannot withdraw an approved venue", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application({ applicationStatus: "approved" })]);

    const res = await agent
      .post("/api/admin/venue-owner/applications/7/withdraw")
      .send({ reason: "Changed my mind" });

    expect(res.status).toBe(409);
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
  });

  it("claims an application for review", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application()]);
    dbMocks.chain.returning.mockResolvedValueOnce([
      { ...application(), applicationStatus: "under_review" },
    ]);

    const res = await agent
      .post("/api/admin/venue-owner/applications/7/start-review")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.profile.status).toBe("under_review");
  });

  it("cannot re-claim an application that is already under review", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([application({ applicationStatus: "under_review" })]);

    const res = await agent
      .post("/api/admin/venue-owner/applications/7/start-review")
      .send({});

    expect(res.status).toBe(409);
  });

  it("returns 404 for an application that does not exist", async () => {
    const agent = await signedInAgent();
    dbMocks.chain.limit.mockResolvedValueOnce([]);
    const res = await agent.post("/api/admin/venue-owner/applications/999/approve").send({});
    expect(res.status).toBe(404);
  });

  it("rejects a non-numeric application id", async () => {
    const agent = await signedInAgent();
    const res = await agent.post("/api/admin/venue-owner/applications/abc/approve").send({});
    expect(res.status).toBe(400);
  });
});
