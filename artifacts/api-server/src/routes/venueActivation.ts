import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { and, count, eq, gte, isNotNull, isNull, lte, or } from "drizzle-orm";
import {
  db,
  hubCheckinsTable,
  venueActivationPoliciesTable,
  venueApplicationHistoryTable,
  venueAdminCredentialsTable,
  venueBusinessesTable,
  venueManagerRegistrationTokensTable,
  venueOwnerProfilesTable,
} from "@workspace/db";
import { z } from "zod/v4";
import crypto from "node:crypto";
import { sendVenueRegistrationReminderEmail } from "../lib/email.js";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const ADMIN_SESSION_COOKIE = "met_venue_admin";
const DAY_MS = 24 * 60 * 60 * 1000;

type ActivationSession = { credentialId: number; sessionVersion: number; expiresAt: number };

function readActivationSession(req: Request): ActivationSession | null {
  if (!process.env["SESSION_SECRET"]) return null;
  const raw = req.signedCookies?.[ADMIN_SESSION_COOKIE];
  if (typeof raw !== "string") return null;
  const [id, version, expiry] = raw.split(".");
  const credentialId = Number(id);
  const sessionVersion = Number(version);
  const expiresAt = Number(expiry);
  if (!Number.isInteger(credentialId) || !Number.isInteger(sessionVersion) ||
      !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return { credentialId, sessionVersion, expiresAt };
}

async function requireActivationAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!process.env["SESSION_SECRET"]) {
    res.status(503).json({ message: "Admin sessions are not enabled" });
    return;
  }
  const session = readActivationSession(req);
  if (!session) {
    res.status(401).json({ message: "Your admin session has expired. Unlock the dashboard again." });
    return;
  }
  const [credential] = await db
    .select({ sessionVersion: venueAdminCredentialsTable.sessionVersion })
    .from(venueAdminCredentialsTable)
    .where(eq(venueAdminCredentialsTable.id, session.credentialId))
    .limit(1);
  if (credential?.sessionVersion !== session.sessionVersion) {
    res.status(401).json({ message: "Your admin session has expired. Unlock the dashboard again." });
    return;
  }
  next();
}

function parseProfileId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

function toIso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

async function activationResponse(profileId: number) {
  const [policy] = await db
    .select()
    .from(venueActivationPoliciesTable)
    .where(eq(venueActivationPoliciesTable.profileId, profileId))
    .limit(1);
  let qrVerifiedCheckins = 0;
  if (policy?.registeredAt && policy.qrDeadline) {
    const [row] = await db
      .select({ total: count(hubCheckinsTable.id) })
      .from(hubCheckinsTable)
      .innerJoin(
        venueOwnerProfilesTable,
        eq(venueOwnerProfilesTable.placeId, hubCheckinsTable.placeId),
      )
      .where(and(
        eq(venueOwnerProfilesTable.id, profileId),
        eq(hubCheckinsTable.source, "qr_verified"),
        gte(hubCheckinsTable.createdAt, policy.registeredAt),
        lte(hubCheckinsTable.createdAt, policy.qrDeadline),
      ));
    qrVerifiedCheckins = Number(row?.total ?? 0);
  }
  return {
    activation: {
      firstInvitationSentAt: toIso(policy?.firstInvitationSentAt ?? null),
      registrationDeadline: toIso(policy?.registrationDeadline ?? null),
      registeredAt: toIso(policy?.registeredAt ?? null),
      qrDeadline: toIso(policy?.qrDeadline ?? null),
      qrVerifiedCheckins,
      reminder5SentAt: toIso(policy?.reminder5SentAt ?? null),
      reminder10SentAt: toIso(policy?.reminder10SentAt ?? null),
      reminder5AttemptedAt: toIso(policy?.reminder5AttemptedAt ?? null),
      reminder10AttemptedAt: toIso(policy?.reminder10AttemptedAt ?? null),
      unlistedAt: toIso(policy?.unlistedAt ?? null),
      removalReason: policy?.removalReason ?? null,
      exempt: policy?.exempt ?? false,
    },
  };
}

async function getInvitedProfile(profileId: number) {
  const [profile] = await db
    .select({
      id: venueOwnerProfilesTable.id,
      businessName: venueOwnerProfilesTable.businessName,
      contactEmail: venueOwnerProfilesTable.contactEmail,
      ownerUid: venueOwnerProfilesTable.ownerUid,
      placeId: venueOwnerProfilesTable.placeId,
      applicationStatus: venueOwnerProfilesTable.applicationStatus,
      isApproved: venueOwnerProfilesTable.isApproved,
      tagline: venueOwnerProfilesTable.tagline,
      description: venueOwnerProfilesTable.description,
      coverPhotoUrl: venueOwnerProfilesTable.coverPhotoUrl,
    })
    .from(venueOwnerProfilesTable)
    .where(eq(venueOwnerProfilesTable.id, profileId))
    .limit(1);
  return profile;
}

function isAdminManaged(ownerUid: string): boolean {
  return ownerUid.startsWith("admin-managed:");
}

async function auditActivation(
  profileId: number,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(venueApplicationHistoryTable).values({
    venueOwnerProfileId: profileId,
    eventType: "review_note_added",
    actorRole: "admin",
    internalNote: `Venue activation: ${action}`,
    metadata: { activationAction: action, ...metadata },
  });
}

router.get(
  "/admin/venue-owner/applications/:id/activation",
  requireActivationAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const profileId = parseProfileId(req.params["id"]);
    if (profileId === null) {
      res.status(400).json({ message: "Invalid profile id" });
      return;
    }
    const profile = await getInvitedProfile(profileId);
    if (!profile) {
      res.status(404).json({ message: "Application not found" });
      return;
    }
    res.json(await activationResponse(profileId));
  },
);

router.post(
  "/admin/venue-owner/applications/:id/activation/reminder",
  requireActivationAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const profileId = parseProfileId(req.params["id"]);
    if (profileId === null) {
      res.status(400).json({ message: "Invalid profile id" });
      return;
    }
    const parsed = z.object({}).strict().safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "Request body must be empty" });
      return;
    }
    const profile = await getInvitedProfile(profileId);
    if (!profile) {
      res.status(404).json({ message: "Application not found" });
      return;
    }
    if (!profile.isApproved || profile.applicationStatus !== "approved" || isAdminManaged(profile.ownerUid)) {
      res.status(409).json({ message: "Only approved, invited venues can receive activation reminders." });
      return;
    }
    if (!profile.contactEmail) {
      res.status(409).json({ message: "No owner contact email is available for this venue." });
      return;
    }
    const [policy] = await db
      .select()
      .from(venueActivationPoliciesTable)
      .where(eq(venueActivationPoliciesTable.profileId, profileId))
      .limit(1);
    if (!policy?.firstInvitationSentAt || !policy.registrationDeadline ||
        policy.registeredAt || policy.unlistedAt) {
      res.status(409).json({ message: "This venue is not eligible for a registration reminder." });
      return;
    }
    const baseUrl = process.env["VENUE_MANAGER_BASE_URL"];
    if (!baseUrl) {
      res.status(503).json({ message: "Venue Manager registration links are not configured." });
      return;
    }
    const now = new Date();
    if (now >= policy.registrationDeadline) {
      res.status(409).json({ message: "The registration deadline has passed." });
      return;
    }
    // Manual messages do not claim either automatic reminder milestone.
    const emailDay: 5 | 10 =
      now.getTime() < policy.firstInvitationSentAt.getTime() + 10 * DAY_MS ? 5 : 10;
    const [business] = await db
      .select({ id: venueBusinessesTable.id })
      .from(venueBusinessesTable)
      .where(eq(venueBusinessesTable.venueOwnerProfileId, profileId))
      .limit(1);
    if (!business) {
      res.status(409).json({ message: "Business record not set up yet — try again shortly." });
      return;
    }
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("base64url");
    await db.insert(venueManagerRegistrationTokensTable).values({
      businessId: business.id,
      tokenHash,
      expiresAt: policy.registrationDeadline,
    });
    await auditActivation(profileId, "manual_reminder_attempted", {
      day: emailDay,
      sentTo: profile.contactEmail,
    });
    let sent = false;
    try {
      sent = await sendVenueRegistrationReminderEmail({
        to: profile.contactEmail,
        businessName: profile.businessName,
        registrationUrl: `${baseUrl.replace(/\/$/, "")}/register?token=${rawToken}`,
        registrationDeadline: policy.registrationDeadline,
        day: emailDay,
        manual: true,
        preview: {
          tagline: profile.tagline,
          description: profile.description,
          coverPhotoUrl: profile.coverPhotoUrl,
        },
      });
    } catch (err) {
      logger.warn({ err, profileId, day: emailDay }, "Manually requested venue activation reminder failed");
    }
    if (sent) {
      await auditActivation(profileId, "manual_reminder_sent", {
        day: emailDay,
        sentTo: profile.contactEmail,
      });
    }
    res.json({ sent, ...(await activationResponse(profileId)) });
  },
);

router.post(
  "/admin/venue-owner/applications/:id/activation/exception",
  requireActivationAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const profileId = parseProfileId(req.params["id"]);
    if (profileId === null) {
      res.status(400).json({ message: "Invalid profile id" });
      return;
    }
    const bodySchema = z.object({ exempt: z.boolean(), reason: z.string().trim().min(1).max(1000) }).strict();
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "A boolean exempt flag and non-empty reason are required." });
      return;
    }
    const profile = await getInvitedProfile(profileId);
    if (!profile) {
      res.status(404).json({ message: "Application not found" });
      return;
    }
    if (!profile.isApproved || profile.applicationStatus !== "approved" || isAdminManaged(profile.ownerUid)) {
      res.status(409).json({ message: "Activation policies apply only to approved, invited venues." });
      return;
    }
    const updated = await db.transaction(async (tx) => {
      const [policy] = await tx
        .update(venueActivationPoliciesTable)
        .set({ exempt: parsed.data.exempt, exceptionReason: parsed.data.reason, updatedAt: new Date() })
        .where(eq(venueActivationPoliciesTable.profileId, profileId))
        .returning({ profileId: venueActivationPoliciesTable.profileId });
      if (!policy) return false;
      await tx.insert(venueApplicationHistoryTable).values({
        venueOwnerProfileId: profileId,
        eventType: "review_note_added",
        actorRole: "admin",
        internalNote: `Venue activation: exception updated — ${parsed.data.reason}`,
        metadata: {
          activationAction: "exception_updated",
          exempt: parsed.data.exempt,
          reason: parsed.data.reason,
        },
      });
      return true;
    });
    if (!updated) {
      res.status(409).json({ message: "This venue has not opted in to activation tracking." });
      return;
    }
    res.json(await activationResponse(profileId));
  },
);

router.post(
  "/admin/venue-owner/applications/:id/activation/reinstate",
  requireActivationAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const profileId = parseProfileId(req.params["id"]);
    if (profileId === null) {
      res.status(400).json({ message: "Invalid profile id" });
      return;
    }
    const parsed = z.object({ reason: z.string().trim().min(1).max(1000) }).strict().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "A non-empty reinstatement reason is required." });
      return;
    }
    const profile = await getInvitedProfile(profileId);
    if (!profile) {
      res.status(404).json({ message: "Application not found" });
      return;
    }
    if (profile.applicationStatus !== "approved" || isAdminManaged(profile.ownerUid)) {
      res.status(409).json({ message: "Only an approved, invited venue can be reinstated." });
      return;
    }
    const now = new Date();
    const reinstated = await db.transaction(async (tx) => {
      const [policy] = await tx
        .update(venueActivationPoliciesTable)
        .set({
          unlistedAt: null,
          removalReason: null,
          exempt: true,
          exceptionReason: parsed.data.reason,
          updatedAt: now,
        })
        .where(and(
          eq(venueActivationPoliciesTable.profileId, profileId),
          isNotNull(venueActivationPoliciesTable.unlistedAt),
        ))
        .returning({ profileId: venueActivationPoliciesTable.profileId });
      if (!policy) return false;
      const [updatedProfile] = await tx
        .update(venueOwnerProfilesTable)
        .set({ isApproved: true, updatedAt: now })
        .where(and(
          eq(venueOwnerProfilesTable.id, profileId),
          eq(venueOwnerProfilesTable.applicationStatus, "approved"),
        ))
        .returning({ id: venueOwnerProfilesTable.id });
      if (!updatedProfile) throw new Error("Activation reinstatement profile update lost its compare-and-set.");
      await tx.insert(venueApplicationHistoryTable).values({
        venueOwnerProfileId: profileId,
        eventType: "review_note_added",
        actorRole: "admin",
        internalNote: `Venue activation: reinstated — ${parsed.data.reason}`,
        metadata: {
          activationAction: "reinstated",
          reason: parsed.data.reason,
          exempt: true,
        },
      });
      return true;
    });
    if (!reinstated) {
      res.status(409).json({ message: "This venue is not currently activation-delisted." });
      return;
    }
    res.json(await activationResponse(profileId));
  },
);

async function softUnlist(
  profileId: number,
  reason: "registration" | "qr_checkins",
  at: Date,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [policy] = await tx
      .select()
      .from(venueActivationPoliciesTable)
      .where(eq(venueActivationPoliciesTable.profileId, profileId))
      .for("update")
      .limit(1);
    if (!policy || policy.exempt || policy.unlistedAt) return false;
    if (reason === "registration" &&
        (policy.registeredAt || !policy.registrationDeadline || policy.registrationDeadline > at)) return false;
    if (reason === "qr_checkins" &&
        (!policy.registeredAt || !policy.qrDeadline || policy.qrDeadline > at)) return false;

    if (reason === "qr_checkins") {
      const [venue] = await tx
        .select({ placeId: venueOwnerProfilesTable.placeId })
        .from(venueOwnerProfilesTable)
        .where(eq(venueOwnerProfilesTable.id, profileId))
        .limit(1);
      if (!venue) return false;
      const [checkins] = await tx
        .select({ total: count(hubCheckinsTable.id) })
        .from(hubCheckinsTable)
        .where(and(
          eq(hubCheckinsTable.placeId, venue.placeId),
          eq(hubCheckinsTable.source, "qr_verified"),
          gte(hubCheckinsTable.createdAt, policy.registeredAt!),
          lte(hubCheckinsTable.createdAt, policy.qrDeadline!),
        ));
      if (Number(checkins?.total ?? 0) >= 10) return false;
    }

    const [profile] = await tx
      .update(venueOwnerProfilesTable)
      .set({ isApproved: false, updatedAt: at })
      .where(and(
        eq(venueOwnerProfilesTable.id, profileId),
        eq(venueOwnerProfilesTable.isApproved, true),
        eq(venueOwnerProfilesTable.applicationStatus, "approved"),
      ))
      .returning({ id: venueOwnerProfilesTable.id });
    if (!profile) return false;
    const [claim] = await tx
      .update(venueActivationPoliciesTable)
      .set({ unlistedAt: at, removalReason: reason, updatedAt: at })
      .where(and(
        eq(venueActivationPoliciesTable.profileId, profileId),
        eq(venueActivationPoliciesTable.exempt, false),
        isNull(venueActivationPoliciesTable.unlistedAt),
        reason === "registration"
          ? isNull(venueActivationPoliciesTable.registeredAt)
          : isNotNull(venueActivationPoliciesTable.registeredAt),
      ))
      .returning({ profileId: venueActivationPoliciesTable.profileId });
    if (!claim) throw new Error("Activation delisting policy update lost its compare-and-set.");
    await tx.insert(venueApplicationHistoryTable).values({
      venueOwnerProfileId: profileId,
      eventType: "review_note_added",
      actorRole: "system",
      internalNote: `Venue activation: soft-unlisted for ${reason}. Application status and venue data were preserved.`,
      metadata: { activationAction: "soft_unlisted", reason, at: at.toISOString() },
    });
    return true;
  }, { isolationLevel: "serializable" });
}

router.post("/venue-owner/process-activation", async (req: Request, res: Response): Promise<void> => {
  const secret = process.env["CRON_SECRET"];
  if (!secret) {
    res.status(503).json({ message: "Cron endpoints are not enabled" });
    return;
  }
  if (req.header("x-cron-secret") !== secret) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const now = new Date();
  const rows = await db.select().from(venueActivationPoliciesTable).where(and(
    or(
      isNotNull(venueActivationPoliciesTable.firstInvitationSentAt),
      isNotNull(venueActivationPoliciesTable.registeredAt),
    ),
    eq(venueActivationPoliciesTable.exempt, false),
    isNull(venueActivationPoliciesTable.unlistedAt),
  ));
  let reminderSent = 0;
  let remindersClaimed = 0;
  let unlistedRegistration = 0;
  let unlistedQrCheckins = 0;
  const baseUrl = process.env["VENUE_MANAGER_BASE_URL"];

  for (const row of rows) {
    const profile = await getInvitedProfile(row.profileId);
    if (!profile || !profile.isApproved || profile.applicationStatus !== "approved" || isAdminManaged(profile.ownerUid)) continue;

    if (row.registeredAt && row.qrDeadline && now >= row.qrDeadline) {
      if (await softUnlist(row.profileId, "qr_checkins", now)) {
        unlistedQrCheckins += 1;
      }
      continue;
    }

    if (!row.registeredAt && row.registrationDeadline && now >= row.registrationDeadline) {
      if (await softUnlist(row.profileId, "registration", now)) unlistedRegistration += 1;
      continue;
    }

    if (!baseUrl || !profile.contactEmail || !row.firstInvitationSentAt || !row.registrationDeadline ||
        row.registeredAt || row.unlistedAt) continue;
    if (now >= row.registrationDeadline) continue;
    const day: 5 | 10 | null =
      now.getTime() >= row.firstInvitationSentAt.getTime() + 5 * DAY_MS &&
      !row.reminder5SentAt && !row.reminder5AttemptedAt
        ? 5
        : now.getTime() >= row.firstInvitationSentAt.getTime() + 10 * DAY_MS &&
          !row.reminder10SentAt && !row.reminder10AttemptedAt
          ? 10
          : null;
    if (!day) continue;
    const [business] = await db
      .select({ id: venueBusinessesTable.id })
      .from(venueBusinessesTable)
      .where(eq(venueBusinessesTable.venueOwnerProfileId, profile.id))
      .limit(1);
    if (!business) continue;
    const [claim] = await db
      .update(venueActivationPoliciesTable)
      .set(day === 5
        ? { reminder5AttemptedAt: now, updatedAt: now }
        : { reminder10AttemptedAt: now, updatedAt: now })
      .where(and(
        eq(venueActivationPoliciesTable.profileId, row.profileId),
        isNull(day === 5
          ? venueActivationPoliciesTable.reminder5AttemptedAt
          : venueActivationPoliciesTable.reminder10AttemptedAt),
        isNull(day === 5 ? venueActivationPoliciesTable.reminder5SentAt : venueActivationPoliciesTable.reminder10SentAt),
        isNull(venueActivationPoliciesTable.registeredAt),
        isNull(venueActivationPoliciesTable.unlistedAt),
        eq(venueActivationPoliciesTable.exempt, false),
      ))
      .returning({ profileId: venueActivationPoliciesTable.profileId });
    if (!claim) continue;
    remindersClaimed += 1;

    try {
      const rawToken = crypto.randomBytes(32).toString("base64url");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("base64url");
      await db.insert(venueManagerRegistrationTokensTable).values({
        businessId: business.id,
        tokenHash,
        expiresAt: row.registrationDeadline,
      });
      const delivered = await sendVenueRegistrationReminderEmail({
        to: profile.contactEmail,
        businessName: profile.businessName,
        registrationUrl: `${baseUrl.replace(/\/$/, "")}/register?token=${rawToken}`,
        registrationDeadline: row.registrationDeadline,
        day,
        preview: {
          tagline: profile.tagline,
          description: profile.description,
          coverPhotoUrl: profile.coverPhotoUrl,
        },
      });
      if (delivered) {
        const sentAt = new Date();
        await db
          .update(venueActivationPoliciesTable)
          .set(day === 5
            ? { reminder5SentAt: sentAt, updatedAt: sentAt }
            : { reminder10SentAt: sentAt, updatedAt: sentAt })
          .where(and(
            eq(venueActivationPoliciesTable.profileId, row.profileId),
            isNotNull(day === 5
              ? venueActivationPoliciesTable.reminder5AttemptedAt
              : venueActivationPoliciesTable.reminder10AttemptedAt),
            isNull(day === 5
              ? venueActivationPoliciesTable.reminder5SentAt
              : venueActivationPoliciesTable.reminder10SentAt),
          ));
        reminderSent += 1;
        await db.insert(venueApplicationHistoryTable).values({
          venueOwnerProfileId: profile.id,
          eventType: "email_sent",
          actorRole: "system",
          internalNote: `Activation reminder day ${day} delivered.`,
          metadata: { activationAction: "reminder_sent", day, sentTo: profile.contactEmail },
        });
      }
    } catch (err) {
      // Attempt is claimed before delivery, while SentAt is written only after
      // Gmail confirms acceptance. Ambiguous outcomes are never auto-retried.
      logger.warn({ err, profileId: profile.id, day }, "Venue activation reminder failed after claim");
    }
  }
  res.json({ remindersClaimed, reminderSent, unlistedRegistration, unlistedQrCheckins });
});

export default router;