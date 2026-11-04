import crypto from "node:crypto";
import { Router, type Request, type RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, venueEmailTemplatesTable, venueOutreachEmailLogsTable, venueApplicationInviteTokensTable, venueOwnerProfilesTable, venueOutreachEmailSuppressionsTable } from "@workspace/db";
import { CreateVenueEmailTemplateBody, UpdateVenueEmailTemplateBody, SendManualVenueEmailBody } from "@workspace/api-zod";
import { getMetAppIntroVideoAssets, getVenueManagerBaseUrl } from "../lib/email.js";
import { sendGmailHtmlEmail } from "../lib/gmail.js";
import { GmailSendError, gmailFailureStatus } from "../lib/gmailDeliveryStatus.js";
import {
  defaultManualEmailTemplates,
  GLOBAL_VENUE_PROSPECT_TEMPLATE_IDS,
  mergeBuiltinOutreachTemplateAdditions,
  renderManualVenueEmail,
  unknownEmailVariables,
  type ManualEmailTemplate,
} from "../lib/manualVenueEmail.js";

const EMAIL_ATOM = "[A-Z0-9!#$%&'*+/=?^_`{|}~-]+";
const EMAIL_DOMAIN_LABEL = "[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?";
const RFC_DOT_ATOM_EMAIL = new RegExp(
  `^${EMAIL_ATOM}(?:\\.${EMAIL_ATOM})*@${EMAIL_DOMAIN_LABEL}(?:\\.${EMAIL_DOMAIN_LABEL})+$`,
  "i",
);

export function isSupportedManualEmailAddress(value: string): boolean {
  const candidate = value.trim();
  if (candidate.length > 255 || !candidate.includes("@")) return false;
  const localPart = candidate.slice(0, candidate.lastIndexOf("@"));
  if (localPart.length > 64) return false;
  return z.string().email().safeParse(candidate).success || RFC_DOT_ATOM_EMAIL.test(candidate);
}

const ManualVenueEmailBody = SendManualVenueEmailBody.extend({
  recipientEmail: z.string().max(255).refine(isSupportedManualEmailAddress, "Invalid email"),
});

async function availableTemplates(): Promise<ManualEmailTemplate[]> {
  const defaults = defaultManualEmailTemplates(getVenueManagerBaseUrl(), getMetAppIntroVideoAssets());
  const defaultsById = new Map(defaults.map((template) => [template.id, template]));
  const rows = await db.select().from(venueEmailTemplatesTable);
  const templates = new Map(defaultsById);
  for (const row of rows) {
    if (row.deletedAt) templates.delete(row.id);
    else {
      const defaultTemplate = defaultsById.get(row.id);
      const savedTemplate: ManualEmailTemplate = {
      id: row.id, name: row.name, subject: row.subject, body: row.body, format: row.format,
        builtin: Boolean(defaultTemplate),
      };
      templates.set(
        row.id,
        defaultTemplate
          ? mergeBuiltinOutreachTemplateAdditions(savedTemplate, defaultTemplate)
          : savedTemplate,
      );
    }
  }
  return [...templates.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function createVenueEmailTemplatesRouter(
  requireAdmin: RequestHandler, actor: (req: Request) => string | null,
): Router {
  const router = Router();
  const base = "/admin/venue-owner/email-templates";
  router.get(base, requireAdmin, async (_req, res) => {
    res.json(await availableTemplates());
  });
  router.post(base, requireAdmin, async (req, res) => {
    const parsed = CreateVenueEmailTemplateBody.safeParse(req.body);
    if (!parsed.success || !validTemplate(parsed.data)) {
      res.status(400).json({ message: "Enter a name, one-line subject and body. Use only the supported personalization fields." }); return;
    }
    const id = `custom_${crypto.randomUUID()}`;
    await db.insert(venueEmailTemplatesTable).values({ id, ...parsed.data });
    res.status(201).json({ id, ...parsed.data, builtin: false });
  });
  router.put(`${base}/:id`, requireAdmin, async (req, res) => {
    const id = String(req.params.id);
    const parsed = UpdateVenueEmailTemplateBody.safeParse(req.body);
    if (!parsed.success || !validTemplate(parsed.data)) {
      res.status(400).json({ message: "Enter a name, one-line subject and body. Use only the supported personalization fields." }); return;
    }
    const existing = (await availableTemplates()).find((template) => template.id === id);
    if (!existing) { res.status(404).json({ message: "Template not found." }); return; }
    await db.insert(venueEmailTemplatesTable).values({ id, ...parsed.data })
      .onConflictDoUpdate({ target: venueEmailTemplatesTable.id, set: { ...parsed.data, updatedAt: new Date() } });
    res.json({ id, ...parsed.data, builtin: existing.builtin });
  });
  router.delete(`${base}/:id`, requireAdmin, async (req, res) => {
    const id = String(req.params.id);
    const existing = (await availableTemplates()).find((template) => template.id === id);
    if (!existing) { res.status(404).json({ message: "Template not found." }); return; }
    const { builtin: _builtin, ...data } = existing;
    await db.insert(venueEmailTemplatesTable).values({ ...data, deletedAt: new Date() })
      .onConflictDoUpdate({ target: venueEmailTemplatesTable.id, set: { deletedAt: new Date(), updatedAt: new Date() } });
    res.status(204).end();
  });
  router.post("/admin/venue-owner/outreach/manual-send", requireAdmin, async (req, res) => {
    const parsed = ManualVenueEmailBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Enter a venue, email address and template." }); return; }
    const input = parsed.data;
    const template = (await availableTemplates()).find((item) => item.id === input.templateId);
    if (!template) { res.status(400).json({ message: "This template was removed. Refresh the template list." }); return; }
    const recipientEmail = input.recipientEmail.trim().toLowerCase();
    const businessName = input.businessName.trim();
    if (!businessName || !recipientEmail) { res.status(400).json({ message: "Enter a venue and recipient." }); return; }
    let pdfAttachment: { filename: string; content: Buffer; contentType: string } | undefined;
    if (input.pdfAttachment) {
      if (!GLOBAL_VENUE_PROSPECT_TEMPLATE_IDS.has(template.id) && template.id !== "venue_no_reply_follow_up") {
        res.status(400).json({ message: "Personalized venue PDFs are only supported for venue introduction campaigns." });
        return;
      }
      const { fileName, contentBase64 } = input.pdfAttachment;
      if (!/^[A-Za-z0-9][A-Za-z0-9 ._()-]*\.pdf$/i.test(fileName)) {
        res.status(400).json({ message: "The personalized PDF filename is invalid." });
        return;
      }
      const content = Buffer.from(contentBase64, "base64");
      if (
        content.length === 0 ||
        content.length > 6_000_000 ||
        content.subarray(0, 5).toString("ascii") !== "%PDF-" ||
        content.toString("base64") !== contentBase64
      ) {
        res.status(400).json({ message: "The personalized PDF is invalid or exceeds the 6 MB attachment limit." });
        return;
      }
      pdfAttachment = { filename: fileName, content, contentType: "application/pdf" };
    }
    let retryRootLogId: number | null = null;
    if (input.retryOfLogId !== undefined) {
      const [retrySource] = await db.select({
        id: venueOutreachEmailLogsTable.id,
        retryOfLogId: venueOutreachEmailLogsTable.retryOfLogId,
        businessName: venueOutreachEmailLogsTable.businessName,
        recipientEmail: venueOutreachEmailLogsTable.recipientEmail,
        deliveryStatus: venueOutreachEmailLogsTable.deliveryStatus,
      }).from(venueOutreachEmailLogsTable)
        .where(eq(venueOutreachEmailLogsTable.id, input.retryOfLogId))
        .limit(1);
      if (
        !retrySource ||
        retrySource.deliveryStatus !== "bounced" ||
        retrySource.recipientEmail.trim().toLowerCase() !== recipientEmail ||
        retrySource.businessName.trim().toLowerCase() !== businessName.toLowerCase()
      ) {
        res.status(409).json({ message: "The bounced send is no longer a valid retry source. Refresh the history and review it again." });
        return;
      }

      retryRootLogId = retrySource.retryOfLogId ?? retrySource.id;
      const [retryRoot] = await db.select({
        id: venueOutreachEmailLogsTable.id,
        businessName: venueOutreachEmailLogsTable.businessName,
        recipientEmail: venueOutreachEmailLogsTable.recipientEmail,
        deliveryStatus: venueOutreachEmailLogsTable.deliveryStatus,
      }).from(venueOutreachEmailLogsTable)
        .where(eq(venueOutreachEmailLogsTable.id, retryRootLogId))
        .limit(1);
      if (
        !retryRoot ||
        retryRoot.deliveryStatus !== "bounced" ||
        retryRoot.recipientEmail.trim().toLowerCase() !== recipientEmail ||
        retryRoot.businessName.trim().toLowerCase() !== businessName.toLowerCase()
      ) {
        res.status(409).json({ message: "The original bounced send is no longer available for retry. Refresh the history and review it again." });
        return;
      }
    }
    if (GLOBAL_VENUE_PROSPECT_TEMPLATE_IDS.has(template.id) && !input.venueFitReason?.trim()) {
      res.status(400).json({ message: "Add a venue-specific reason before sending this invitation." }); return;
    }
    const [suppressed] = await db.select({ email: venueOutreachEmailSuppressionsTable.email })
      .from(venueOutreachEmailSuppressionsTable)
      .where(eq(venueOutreachEmailSuppressionsTable.email, recipientEmail))
      .limit(1);
    if (suppressed) {
      res.status(409).json({ message: "This email is blocked from future Venue Admin outreach." }); return;
    }
    let profileId: number | null = null;
    if (input.venueOwnerProfileId) {
      const [profile] = await db.select({ id: venueOwnerProfilesTable.id }).from(venueOwnerProfilesTable)
        .where(eq(venueOwnerProfilesTable.id, input.venueOwnerProfileId)).limit(1);
      profileId = profile?.id ?? null;
    }
    const managerUrl = getVenueManagerBaseUrl().replace(/\/$/, "");
    let applicationUrl = `${managerUrl}/apply`;
    let inviteId: number | null = null;
    if (/\{\{\s*applicationUrl\s*\}\}/.test(`${template.body} ${template.subject}`)) {
      // An application invitation permits submission for review, not venue access.
      const token = crypto.randomBytes(32).toString("base64url");
      const [invite] = await db.insert(venueApplicationInviteTokensTable).values({
        tokenHash: crypto.createHash("sha256").update(token).digest("base64url"),
        invitedEmail: recipientEmail, businessName,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      }).returning({ id: venueApplicationInviteTokensTable.id });
      if (!invite) throw new Error("Unable to prepare application invitation.");
      inviteId = invite.id;
      applicationUrl = `${managerUrl}/apply#invite=${token}`;
    }
    const email = renderManualVenueEmail(template, {
      businessName, recipientEmail, applicationUrl, venueManagerUrl: managerUrl,
      venueFitReason: input.venueFitReason?.trim() ?? "",
    }, input.bulkInvitation === true);
    const [log] = await db.insert(venueOutreachEmailLogsTable).values({
      venueOwnerProfileId: profileId, applicationInviteTokenId: inviteId, placeId: input.placeId ?? null,
      businessName, recipientEmail, template: template.id, templateName: template.name,
      kind: inviteId ? "new_venue_outreach" : "manager_announcement", retryOfLogId: retryRootLogId,
      deliveryStatus: "sending", actorUid: actor(req),
    }).returning({ id: venueOutreachEmailLogsTable.id });
    if (!log) throw new Error("Unable to record outgoing email.");
    let gmailRfcMessageId: string | null = null;
    let gmailThreadId: string | null = null;
    try {
      const sendResult = await sendGmailHtmlEmail({
        to: recipientEmail,
        ...email,
        ...(pdfAttachment ? { attachments: [pdfAttachment] } : {}),
      });
      gmailRfcMessageId = sendResult.rfcMessageId;
      gmailThreadId = sendResult.gmailThreadId;
    } catch (error) {
      const deliveryStatus = gmailFailureStatus(error);
      const gmailStatus = error instanceof GmailSendError ? error.httpStatus : null;
      await db.update(venueOutreachEmailLogsTable).set({ deliveryStatus })
        .where(eq(venueOutreachEmailLogsTable.id, log.id));
      req.log?.warn({
        logId: log.id,
        deliveryStatus,
        gmailStatus,
        gmailErrorCode: error instanceof GmailSendError ? error.code : null,
      }, "Manual venue email delivery not confirmed");
      const message = deliveryStatus === "failed"
        ? gmailStatus === 401
          ? "The email was not sent. Gmail authentication failed (HTTP 401). Check the connected account before retrying."
          : gmailStatus === 403
            ? "The email was not sent. Gmail denied the request (HTTP 403). Check account permissions or sending limits before retrying."
            : gmailStatus === 429
              ? "The email was not sent. Gmail rate-limited the request (HTTP 429). Wait before retrying."
              : gmailStatus !== null
                ? `The email was not sent. Gmail rejected the request (HTTP ${gmailStatus}). It is marked Failed and can be cleared from Venue Admin.`
                : "The email was not sent. It is marked Failed and can be cleared from Venue Admin."
        : gmailStatus !== null
          ? `Delivery could not be confirmed (Gmail HTTP ${gmailStatus}). Check Gmail Sent before sending again.`
          : "Delivery could not be confirmed. Check Gmail Sent before sending again.";
      const responseStatus = deliveryStatus === "failed" && gmailStatus === 429 ? 429 : 503;
      res.status(responseStatus).json({ message, gmailStatus }); return;
    }
    await db.update(venueOutreachEmailLogsTable)
      .set({
        deliveryStatus: "sent",
        sentAt: new Date(),
        gmailRfcMessageId,
        gmailThreadId,
      })
      .where(eq(venueOutreachEmailLogsTable.id, log.id));
    res.status(201).json({ emailSent: true, recipientEmail });
  });
  return router;
}

function validTemplate(input: { name: string; subject: string; body: string } | undefined): boolean {
  return !!input && !!input.name.trim() && !!input.subject.trim() && !!input.body.trim() &&
    !/[\r\n]/.test(input.subject) && unknownEmailVariables(`${input.subject} ${input.body}`).length === 0;
}
