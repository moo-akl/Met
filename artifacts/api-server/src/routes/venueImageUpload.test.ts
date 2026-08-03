/**
 * Venue image upload security — unit tests for the upload and confirm endpoints.
 *
 * These tests verify that the magic-byte validation step enforces real image
 * content regardless of the contentType the client declared when requesting the
 * presigned URL.  The ObjectStorageService is mocked so GCS is never called.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { inArray, like, sql } from "drizzle-orm";
import {
  db,
  venueBusinessesTable,
  venueManagersTable,
  venueManagerSessionsTable,
  venueManagerTokensTable,
  venueMembershipAuditTable,
  venueMembershipsTable,
  venueOwnerProfilesTable,
} from "@workspace/db";

// ── Rate-limiting & requireUid are not under test here ───────────────────────
vi.mock("../middlewares/rateLimit", () => ({
  createIpRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createUserRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../middlewares/requireUid", () => ({
  requireUid: (
    req: { uid?: string; header: (name: string) => string | undefined },
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: () => void,
  ) => {
    const uid = req.header("x-test-uid");
    if (!uid) { res.status(401).json({ message: "unauthenticated" }); return; }
    req.uid = uid;
    next();
  },
}));

// ── Shared mutable mock state ─────────────────────────────────────────────────
// vi.mock() factories are hoisted by Vitest before module-scope let/const
// initialisers run, so normal variables can't be read inside the factory.
// vi.hoisted() executes during the same hoisting phase and its return value
// IS available inside vi.mock factories.
const { mockState } = vi.hoisted(() => {
  const fakeDelete = { called: false, resolve: () => undefined as void };
  const fakeFile = {
    delete: function () {
      fakeDelete.called = true;
      return Promise.resolve(undefined);
    },
    _fakeDelete: fakeDelete,
  };
  return {
    mockState: {
      magicBytes: Buffer.from("bad-not-an-image"),
      fakeFile,
    },
  };
});

// Use a real class (not an arrow function) so `new ObjectStorageService()`
// succeeds in storage.ts and venueManager.ts when this file is mocked.
vi.mock("../lib/objectStorage", () => {
  class ObjectStorageService {
    getObjectEntityUploadURL() {
      return Promise.resolve(
        "https://storage.googleapis.com/bucket/objects/uploads/fake-uuid",
      );
    }
    normalizeObjectEntityPath(_url: string) {
      return "/objects/uploads/fake-uuid";
    }
    getObjectEntityFile(_path: string) {
      return Promise.resolve(mockState.fakeFile);
    }
    getObjectMagicBytes(_file: unknown, _n: number) {
      return Promise.resolve(mockState.magicBytes);
    }
  }
  return { ObjectStorageService };
});

// ── Magic byte constants ──────────────────────────────────────────────────────
const JPEG_BYTES  = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01]);
const PNG_BYTES   = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x00, 0x00, 0x00, 0x00]);
const WEBP_BYTES  = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
const GIF_BYTES   = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff]);
const BAD_BYTES   = Buffer.from("This is a plain text file, not an image at all!");
const HTML_BYTES  = Buffer.from("<!DOCTYPE html><html><body>xss</body></html>");
const PDF_BYTES   = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

// ── Test helpers ──────────────────────────────────────────────────────────────
process.env["SESSION_SECRET"] ||= "test-session-secret";

const hasDatabase = Boolean(process.env["DATABASE_URL"]);
const PREFIX = `itest-imgup-${process.pid}-${Date.now()}`;
const email = (name: string) => `${PREFIX}-${name}@example.com`;
const STRONG = "CorrectHorse99x";

async function cleanup() {
  const managers = await db.select({ id: venueManagersTable.id })
    .from(venueManagersTable)
    .where(like(venueManagersTable.email, `${PREFIX}%`));
  const managerIds = managers.map((m) => m.id);
  if (managerIds.length) {
    await db.delete(venueManagerSessionsTable).where(inArray(venueManagerSessionsTable.managerId, managerIds));
    await db.delete(venueManagerTokensTable).where(inArray(venueManagerTokensTable.managerId, managerIds));
    await db.delete(venueMembershipsTable).where(inArray(venueMembershipsTable.managerId, managerIds));
  }
  const profiles = await db.select({ id: venueOwnerProfilesTable.id })
    .from(venueOwnerProfilesTable)
    .where(sql`${venueOwnerProfilesTable.ownerUid} LIKE ${`${PREFIX}%`}`);
  const profileIds = profiles.map((p) => p.id);
  if (profileIds.length) {
    const businesses = await db.select({ id: venueBusinessesTable.id })
      .from(venueBusinessesTable)
      .where(inArray(venueBusinessesTable.venueOwnerProfileId, profileIds));
    const businessIds = businesses.map((b) => b.id);
    if (businessIds.length) {
      await db.delete(venueMembershipAuditTable).where(inArray(venueMembershipAuditTable.businessId, businessIds));
      await db.delete(venueManagerTokensTable).where(inArray(venueManagerTokensTable.businessId, businessIds));
      await db.delete(venueMembershipsTable).where(inArray(venueMembershipsTable.businessId, businessIds));
      await db.delete(venueBusinessesTable).where(inArray(venueBusinessesTable.id, businessIds));
    }
    await db.delete(venueOwnerProfilesTable).where(inArray(venueOwnerProfilesTable.id, profileIds));
  }
  if (managerIds.length) {
    await db.delete(venueManagersTable).where(inArray(venueManagersTable.id, managerIds));
  }
}

async function makeBusiness(name: string) {
  const [profile] = await db.insert(venueOwnerProfilesTable).values({
    ownerUid: `${PREFIX}-uid-${name}`,
    placeId: `${PREFIX}-place-${name}`,
    placeName: `Venue ${name}`,
    businessName: `Business ${name}`,
    verificationDocUrl: "https://example.com/proof.pdf",
    applicationStatus: "approved",
    isApproved: true,
    isVerified: true,
    approvedAt: new Date(),
  }).returning();
  const [business] = await db.insert(venueBusinessesTable).values({
    venueOwnerProfileId: profile!.id,
    placeId: profile!.placeId,
    legalName: profile!.businessName,
    createdByUid: profile!.ownerUid,
  }).returning();
  return { profile: profile!, business: business! };
}

describe.skipIf(!hasDatabase)("venue image upload security (real database)", async () => {
  const { default: app } = await import("../app");
  const api = () => request(app);

  beforeAll(cleanup);
  afterAll(cleanup);

  async function claimOwner(name: string) {
    const { profile, business } = await makeBusiness(name);
    const agent = request.agent(app);
    const res = await agent.post("/api/venue-manager/claim")
      .set("x-test-uid", profile.ownerUid)
      .send({ email: email(name), displayName: `Owner ${name}`, password: STRONG });
    expect(res.status).toBe(200);
    return { agent, csrf: res.body.csrfToken as string, business };
  }

  // ── /upload endpoint ────────────────────────────────────────────────────────

  it("upload: rejects requests without a session", async () => {
    const res = await api().post("/api/venue-manager/businesses/1/images/upload")
      .set("x-csrf-token", "any").send({ contentType: "image/jpeg" });
    expect(res.status).toBe(401);
  });

  it("upload: rejects disallowed content types (PDF)", async () => {
    const { agent, csrf, business } = await claimOwner("upload-pdf");
    const res = await agent.post(`/api/venue-manager/businesses/${business.id}/images/upload`)
      .set("x-csrf-token", csrf).send({ contentType: "application/pdf" });
    expect(res.status).toBe(400);
  });

  it("upload: rejects text/html even if caller is authenticated", async () => {
    const { agent, csrf, business } = await claimOwner("upload-html");
    const res = await agent.post(`/api/venue-manager/businesses/${business.id}/images/upload`)
      .set("x-csrf-token", csrf).send({ contentType: "text/html" });
    expect(res.status).toBe(400);
  });

  it("upload: rejects when contentType is missing", async () => {
    const { agent, csrf, business } = await claimOwner("upload-missing");
    const res = await agent.post(`/api/venue-manager/businesses/${business.id}/images/upload`)
      .set("x-csrf-token", csrf).send({});
    expect(res.status).toBe(400);
  });

  it("upload: returns a presigned URL for image/jpeg", async () => {
    const { agent, csrf, business } = await claimOwner("upload-jpeg");
    const res = await agent.post(`/api/venue-manager/businesses/${business.id}/images/upload`)
      .set("x-csrf-token", csrf).send({ contentType: "image/jpeg" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("uploadURL");
    expect(res.body).toHaveProperty("objectPath");
  });

  it("upload: returns a presigned URL for image/png", async () => {
    const { agent, csrf, business } = await claimOwner("upload-png");
    const res = await agent.post(`/api/venue-manager/businesses/${business.id}/images/upload`)
      .set("x-csrf-token", csrf).send({ contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(res.body.objectPath).toMatch(/^\/objects\//);
  });

  // ── /confirm endpoint: invalid paths ───────────────────────────────────────

  it("confirm: rejects requests without a session", async () => {
    const res = await api().post("/api/venue-manager/businesses/1/images/confirm")
      .set("x-csrf-token", "any").send({ objectPath: "/objects/uploads/fake-uuid" });
    expect(res.status).toBe(401);
  });

  it("confirm: rejects objectPath that does not start with /objects/uploads/", async () => {
    const { agent, csrf, business } = await claimOwner("confirm-badpath");
    const res = await agent.post(`/api/venue-manager/businesses/${business.id}/images/confirm`)
      .set("x-csrf-token", csrf).send({ objectPath: "/objects/other/fake-uuid" });
    expect(res.status).toBe(400);
  });

  it("confirm: rejects objectPath pointing to directory traversal attempt", async () => {
    const { agent, csrf, business } = await claimOwner("confirm-traversal");
    const res = await agent.post(`/api/venue-manager/businesses/${business.id}/images/confirm`)
      .set("x-csrf-token", csrf).send({ objectPath: "/objects/uploads/../../../etc/passwd" });
    // The path doesn't start with /objects/uploads/ after the check
    expect(res.status).toBe(400);
  });

  // ── /confirm endpoint: magic byte validation ────────────────────────────────

  it("confirm: rejects a plain-text file even when upload declared image/jpeg", async () => {
    const { agent, csrf, business } = await claimOwner("confirm-text");
    mockState.magicBytes = BAD_BYTES;
    const res = await agent.post(`/api/venue-manager/businesses/${business.id}/images/confirm`)
      .set("x-csrf-token", csrf).send({ objectPath: "/objects/uploads/fake-uuid" });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/valid image/i);
  });

  it("confirm: rejects an HTML file (potential XSS content)", async () => {
    const { agent, csrf, business } = await claimOwner("confirm-html");
    mockState.magicBytes = HTML_BYTES;
    const res = await agent.post(`/api/venue-manager/businesses/${business.id}/images/confirm`)
      .set("x-csrf-token", csrf).send({ objectPath: "/objects/uploads/fake-uuid" });
    expect(res.status).toBe(422);
  });

  it("confirm: rejects a PDF file", async () => {
    const { agent, csrf, business } = await claimOwner("confirm-pdf");
    mockState.magicBytes = PDF_BYTES;
    const res = await agent.post(`/api/venue-manager/businesses/${business.id}/images/confirm`)
      .set("x-csrf-token", csrf).send({ objectPath: "/objects/uploads/fake-uuid" });
    expect(res.status).toBe(422);
  });

  it("confirm: accepts a valid JPEG", async () => {
    const { agent, csrf, business } = await claimOwner("confirm-jpeg");
    mockState.magicBytes = JPEG_BYTES;
    const res = await agent.post(`/api/venue-manager/businesses/${business.id}/images/confirm`)
      .set("x-csrf-token", csrf).send({ objectPath: "/objects/uploads/fake-uuid" });
    expect(res.status).toBe(200);
    expect(res.body.url).toBe("/api/storage/objects/uploads/fake-uuid");
  });

  it("confirm: accepts a valid PNG", async () => {
    const { agent, csrf, business } = await claimOwner("confirm-png");
    mockState.magicBytes = PNG_BYTES;
    const res = await agent.post(`/api/venue-manager/businesses/${business.id}/images/confirm`)
      .set("x-csrf-token", csrf).send({ objectPath: "/objects/uploads/fake-uuid" });
    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^\/api\/storage\/objects\//);
  });

  it("confirm: accepts a valid WebP", async () => {
    const { agent, csrf, business } = await claimOwner("confirm-webp");
    mockState.magicBytes = WEBP_BYTES;
    const res = await agent.post(`/api/venue-manager/businesses/${business.id}/images/confirm`)
      .set("x-csrf-token", csrf).send({ objectPath: "/objects/uploads/fake-uuid" });
    expect(res.status).toBe(200);
  });

  it("confirm: accepts a valid GIF", async () => {
    const { agent, csrf, business } = await claimOwner("confirm-gif");
    mockState.magicBytes = GIF_BYTES;
    const res = await agent.post(`/api/venue-manager/businesses/${business.id}/images/confirm`)
      .set("x-csrf-token", csrf).send({ objectPath: "/objects/uploads/fake-uuid" });
    expect(res.status).toBe(200);
  });

  it("confirm: deletes the rejected object from storage", async () => {
    const { agent, csrf, business } = await claimOwner("confirm-delete");
    mockState.magicBytes = BAD_BYTES;
    mockState.fakeFile._fakeDelete.called = false;
    await agent.post(`/api/venue-manager/businesses/${business.id}/images/confirm`)
      .set("x-csrf-token", csrf).send({ objectPath: "/objects/uploads/fake-uuid" });
    expect(mockState.fakeFile._fakeDelete.called).toBe(true);
  });
});
