import { beforeEach, describe, expect, it, vi } from "vitest";

const activationMocks = vi.hoisted(() => {
  const table = (columns: string[]) =>
    Object.fromEntries(columns.map((column) => [column, `${column}`]));
  const tables = {
    venueActivationPoliciesTable: table([
      "id", "profileId", "firstInvitationSentAt", "registrationDeadline", "registeredAt",
      "qrDeadline", "reminder5SentAt", "reminder10SentAt", "reminder5AttemptedAt",
      "reminder10AttemptedAt", "unlistedAt", "removalReason", "exempt", "exceptionReason",
      "updatedAt",
    ]),
    venueOwnerProfilesTable: table([
      "id", "placeId", "ownerUid", "businessName", "contactEmail", "applicationStatus",
      "isApproved", "tagline", "description", "coverPhotoUrl", "updatedAt",
    ]),
    venueApplicationHistoryTable: table(["venueOwnerProfileId", "eventType"]),
    venueAdminCredentialsTable: table(["id", "sessionVersion"]),
    venueBusinessesTable: table(["id", "venueOwnerProfileId"]),
    venueManagerRegistrationTokensTable: table(["businessId", "tokenHash", "expiresAt"]),
    hubCheckinsTable: table(["id", "placeId", "source", "createdAt"]),
  };

  const selectResults: unknown[][] = [];
  const returningResults: unknown[][] = [];
  const selects: { table?: unknown; where?: unknown }[] = [];
  const updates: { table: unknown; set?: unknown; where?: unknown }[] = [];
  const inserts: { table: unknown; values?: unknown }[] = [];

  function selectBuilder() {
    const call: { table?: unknown; where?: unknown } = {};
    selects.push(call);
    let value: unknown[] | undefined;
    const builder: Record<string | symbol, unknown> = {
      from(source: unknown) {
        call.table = source;
        return builder;
      },
      innerJoin() { return builder; },
      where(condition: unknown) {
        call.where = condition;
        return builder;
      },
      limit() { return builder; },
      for() { return builder; },
      then(resolve: (result: unknown[]) => unknown, reject?: (error: unknown) => unknown) {
        if (!value) value = selectResults.shift() ?? [];
        return Promise.resolve(value).then(resolve, reject);
      },
    };
    return builder;
  }

  function mutationBuilder(kind: "update" | "insert", target: unknown) {
    const call = kind === "update"
      ? { table: target, set: undefined as unknown, where: undefined as unknown }
      : { table: target, values: undefined as unknown };
    if (kind === "update") updates.push(call as (typeof updates)[number]);
    else inserts.push(call as (typeof inserts)[number]);
    const builder: Record<string | symbol, unknown> = {
      set(values: unknown) {
        if ("set" in call) call.set = values;
        return builder;
      },
      values(values: unknown) {
        if ("values" in call) call.values = values;
        return builder;
      },
      where(condition: unknown) {
        if ("where" in call) call.where = condition;
        return builder;
      },
      onConflictDoUpdate() { return builder; },
      returning() { return Promise.resolve(returningResults.shift() ?? []); },
      then(resolve: (result: unknown) => unknown, reject?: (error: unknown) => unknown) {
        return Promise.resolve(undefined).then(resolve, reject);
      },
    };
    return builder;
  }

  const db = {
    select: vi.fn(() => selectBuilder()),
    update: vi.fn((target: unknown) => mutationBuilder("update", target)),
    insert: vi.fn((target: unknown) => mutationBuilder("insert", target)),
    transaction: vi.fn(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)),
  };
  return {
    db,
    tables,
    selectResults,
    returningResults,
    selects,
    updates,
    inserts,
    email: vi.fn(),
    eq: vi.fn((column: unknown, value: unknown) => ({ op: "eq", column, value })),
    and: vi.fn((...conditions: unknown[]) => ({ op: "and", conditions })),
    gte: vi.fn((column: unknown, value: unknown) => ({ op: "gte", column, value })),
    lte: vi.fn((column: unknown, value: unknown) => ({ op: "lte", column, value })),
    isNull: vi.fn((column: unknown) => ({ op: "isNull", column })),
    isNotNull: vi.fn((column: unknown) => ({ op: "isNotNull", column })),
    or: vi.fn((...conditions: unknown[]) => ({ op: "or", conditions })),
    count: vi.fn((column: unknown) => ({ op: "count", column })),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
  };
});

vi.mock("@workspace/db", () => ({
  db: activationMocks.db,
  ...activationMocks.tables,
}));

vi.mock("drizzle-orm", () => ({
  eq: activationMocks.eq,
  and: activationMocks.and,
  gte: activationMocks.gte,
  lte: activationMocks.lte,
  isNull: activationMocks.isNull,
  isNotNull: activationMocks.isNotNull,
  or: activationMocks.or,
  count: activationMocks.count,
  sql: activationMocks.sql,
}));

vi.mock("../lib/email.js", () => ({
  sendVenueRegistrationReminderEmail: activationMocks.email,
}));

vi.mock("../lib/logger", () => ({
  logger: { warn: vi.fn() },
}));

import express from "express";
import request from "supertest";
import { eq, gte, lte } from "drizzle-orm";
import { markVenueRegistered, recordVenueInvitation } from "./venueActivation";
import venueActivationRouter from "../routes/venueActivation";

const policies = activationMocks.tables.venueActivationPoliciesTable;
const profiles = activationMocks.tables.venueOwnerProfilesTable;
const checkins = activationMocks.tables.hubCheckinsTable;
const testApp = express();
testApp.use(express.json());
testApp.use((req, _res, next) => {
  (req as typeof req & { signedCookies?: Record<string, string> }).signedCookies = {
    met_venue_admin: `9.2.${Date.now() + 60_000}`,
  };
  next();
});
testApp.use("/api", venueActivationRouter);
testApp.use((err: unknown, _req: unknown, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
});

const fakeProfile = {
  id: 27,
  placeId: "test-place-27",
  ownerUid: "test-owner",
  businessName: "Test Venue",
  contactEmail: "owner@example.test",
  applicationStatus: "approved",
  isApproved: true,
  tagline: null,
  description: null,
  coverPhotoUrl: null,
};

function enqueueSelects(...rows: unknown[][]): void {
  activationMocks.selectResults.push(...rows);
}

function enqueueReturning(...rows: unknown[][]): void {
  activationMocks.returningResults.push(...rows);
}

function collectConditions(value: unknown): { op: string; column?: unknown; value?: unknown }[] {
  if (!value || typeof value !== "object") return [];
  const condition = value as { op?: string; column?: unknown; value?: unknown; conditions?: unknown[] };
  return [
    ...(condition.op ? [{ op: condition.op, column: condition.column, value: condition.value }] : []),
    ...(condition.conditions ?? []).flatMap(collectConditions),
  ];
}

beforeEach(() => {
  activationMocks.selectResults.length = 0;
  activationMocks.returningResults.length = 0;
  activationMocks.selects.length = 0;
  activationMocks.updates.length = 0;
  activationMocks.inserts.length = 0;
  vi.clearAllMocks();
  process.env["CRON_SECRET"] = "activation-test-secret";
  process.env["SESSION_SECRET"] = "activation-test-session";
  process.env["VENUE_MANAGER_BASE_URL"] = "https://manager.example.test";
});

describe("venue activation policy", () => {
  it("does not create a policy for previously registered venues without an opted-in policy row", async () => {
    enqueueSelects([]);

    const response = await request(testApp)
      .post("/api/venue-owner/process-activation")
      .set("x-cron-secret", "activation-test-secret");

    expect(response.status, response.text).toBe(200);
    expect(activationMocks.db.insert).not.toHaveBeenCalled();
    expect(activationMocks.db.update).not.toHaveBeenCalled();
    expect(activationMocks.email).not.toHaveBeenCalled();
  });

  it("keeps the first invitation deadline unchanged when recording a resend", async () => {
    const firstSent = new Date("2026-01-01T00:00:00.000Z");
    const fixedDeadline = new Date("2026-01-15T00:00:00.000Z");
    enqueueReturning(
      [{ firstInvitationSentAt: firstSent, registrationDeadline: fixedDeadline }],
      [{ firstInvitationSentAt: firstSent, registrationDeadline: fixedDeadline }],
    );

    const first = await recordVenueInvitation(27, firstSent);
    const resend = await recordVenueInvitation(27, new Date("2026-01-04T00:00:00.000Z"));

    expect(first).toEqual(firstSent);
    expect(resend).toEqual(firstSent);
    expect(activationMocks.inserts).toHaveLength(2);
    expect(activationMocks.inserts[0]?.values).toMatchObject({
      firstInvitationSentAt: firstSent,
      registrationDeadline: fixedDeadline,
    });
  });

  it("starts the 30-day QR activation window when an opted-in venue registers", async () => {
    const registeredAt = new Date("2026-02-01T12:00:00.000Z");
    enqueueSelects([{
      profileId: 27,
      firstInvitationSentAt: new Date("2026-01-20T12:00:00.000Z"),
      registrationDeadline: new Date("2026-02-03T12:00:00.000Z"),
      registeredAt: null,
      unlistedAt: null,
      exempt: false,
    }]);

    await markVenueRegistered(27, registeredAt);

    expect(activationMocks.updates[0]?.set).toMatchObject({
      registeredAt,
      qrDeadline: new Date("2026-03-03T12:00:00.000Z"),
    });
  });

  it("counts only QR-verified check-ins within the registration-to-QR-deadline window", async () => {
    const registeredAt = new Date("2026-02-01T00:00:00.000Z");
    const qrDeadline = new Date("2026-03-03T00:00:00.000Z");
    enqueueSelects(
      [{
        profileId: 27,
        registeredAt,
        qrDeadline,
        firstInvitationSentAt: new Date("2026-01-10T00:00:00.000Z"),
        exempt: false,
        unlistedAt: null,
      }],
      [fakeProfile],
      [{ registeredAt, qrDeadline, exempt: false, unlistedAt: null }],
      [{ placeId: fakeProfile.placeId }],
      [{ total: 10 }],
    );

    const response = await request(testApp)
      .post("/api/venue-owner/process-activation")
      .set("x-cron-secret", "activation-test-secret");

    expect(response.status).toBe(200);
    expect(activationMocks.updates).toHaveLength(0);
    expect(eq).toHaveBeenCalledWith(checkins.source, "qr_verified");
    expect(gte).toHaveBeenCalledWith(checkins.createdAt, registeredAt);
    expect(lte).toHaveBeenCalledWith(checkins.createdAt, qrDeadline);
  });

  it("soft-unlists a registration deadline transactionally and reinstates with a lasting exemption", async () => {
    const expiredPolicy = {
      profileId: 27,
      firstInvitationSentAt: new Date("2026-01-01T00:00:00.000Z"),
      registrationDeadline: new Date("2026-01-15T00:00:00.000Z"),
      registeredAt: null,
      exempt: false,
      unlistedAt: null,
    };
    enqueueSelects([expiredPolicy], [fakeProfile], [expiredPolicy]);
    enqueueReturning([{ id: 27 }], [{ profileId: 27 }]);

    const removal = await request(testApp)
      .post("/api/venue-owner/process-activation")
      .set("x-cron-secret", "activation-test-secret");

    expect(removal.status).toBe(200);
    expect(removal.body.unlistedRegistration).toBe(1);
    expect(activationMocks.updates[0]?.set).toMatchObject({ isApproved: false });
    expect(activationMocks.updates[0]?.set).not.toHaveProperty("applicationStatus");
    expect(activationMocks.updates[1]?.set).toMatchObject({ removalReason: "registration" });

    enqueueSelects(
      [{ sessionVersion: 2 }],
      [fakeProfile],
      [{ ...expiredPolicy, unlistedAt: new Date(), removalReason: "registration" }],
      [{ ...expiredPolicy, unlistedAt: null, removalReason: null, exempt: true }],
    );
    enqueueReturning([{ profileId: 27 }], [{ id: 27 }]);
    const reinstatement = await request(testApp)
      .post("/api/admin/venue-owner/applications/27/activation/reinstate")
      .send({ reason: "Test support exception" });

    expect(reinstatement.status).toBe(200);
    expect(activationMocks.updates.at(-2)?.set).toMatchObject({
      unlistedAt: null,
      exempt: true,
      exceptionReason: "Test support exception",
    });
    expect(activationMocks.updates.at(-1)?.set).toMatchObject({ isApproved: true });

    activationMocks.updates.length = 0;
    enqueueSelects([]);
    const nextCron = await request(testApp)
      .post("/api/venue-owner/process-activation")
      .set("x-cron-secret", "activation-test-secret");
    expect(nextCron.status).toBe(200);
    expect(activationMocks.updates).toHaveLength(0);
    expect(eq).toHaveBeenCalledWith(policies.exempt, false);
  });

  it("claims reminder attempts separately and records sent time only after Gmail succeeds", async () => {
    const firstInvitationSentAt = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const policy = {
      profileId: 27,
      firstInvitationSentAt,
      registrationDeadline: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      registeredAt: null,
      reminder5AttemptedAt: null,
      reminder5SentAt: null,
      reminder10AttemptedAt: null,
      reminder10SentAt: null,
      exempt: false,
      unlistedAt: null,
    };
    enqueueSelects([policy], [fakeProfile], [{ id: 91 }]);
    enqueueReturning([{ profileId: 27 }]);
    activationMocks.email.mockResolvedValueOnce(true);

    const response = await request(testApp)
      .post("/api/venue-owner/process-activation")
      .set("x-cron-secret", "activation-test-secret");

    expect(response.status).toBe(200);
    expect(activationMocks.updates[0]?.set).toHaveProperty("reminder5AttemptedAt");
    expect(activationMocks.updates[0]?.set).not.toHaveProperty("reminder5SentAt");
    expect(activationMocks.updates[1]?.set).toHaveProperty("reminder5SentAt");
    expect(activationMocks.email).toHaveBeenCalledOnce();
  });

  it("retains a reminder attempt but does not set SentAt after an ambiguous Gmail failure", async () => {
    const firstInvitationSentAt = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    enqueueSelects(
      [{
        profileId: 27,
        firstInvitationSentAt,
        registrationDeadline: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        registeredAt: null,
        reminder5AttemptedAt: null,
        reminder5SentAt: null,
        reminder10AttemptedAt: null,
        reminder10SentAt: null,
        exempt: false,
        unlistedAt: null,
      }],
      [fakeProfile],
      [{ id: 91 }],
    );
    enqueueReturning([{ profileId: 27 }]);
    activationMocks.email.mockRejectedValueOnce(new Error("ambiguous delivery"));

    const response = await request(testApp)
      .post("/api/venue-owner/process-activation")
      .set("x-cron-secret", "activation-test-secret");

    expect(response.status).toBe(200);
    expect(activationMocks.updates).toHaveLength(1);
    expect(activationMocks.updates[0]?.set).toHaveProperty("reminder5AttemptedAt");
    expect(activationMocks.updates[0]?.set).not.toHaveProperty("reminder5SentAt");
  });
});