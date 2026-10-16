import crypto from "node:crypto";
import { Router, type Request, type RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db, venueEmailTemplatesTable, venueOutreachEmailLogsTable, venueApplicationInviteTokensTable, venueOwnerProfilesTable } from "@workspace/db";
import { CreateVenueEmailTemplateBody, UpdateVenueEmailTemplateBody, SendManualVenueEmailBody } from "@workspace/api-zod";
import { getMetAppIntroVideoAssets, getVenueManagerBaseUrl } from "../lib/email.js";
import { sendGmailHtmlEmail } from "../lib/gmail.js";
import { defaultManualEmailTemplates, renderManualVenueEmail, unknownEmailVariables, type ManualEmailTemplate } from "../lib/manualVenueEmail.js";

async function availableTemplates(): Promise<ManualEmailTemplate[]> {
  const defaults = defaultManualEmailTemplates(getVenueManagerBaseUrl(), getMetAppIntroVideoAssets());
  const rows = await db.select().from(venueEmailTemplatesTable);
  const templates = new Map(defaults.map((template) => [template.id, template]));
  for (const row of rows) {
    if (row.deletedAt) templates.delete(row.id);
    else templates.set(row.id, {
      id: row.id, name: row.name, subject: row.subject, body: row.body, format: row.format,
      builtin: defaults.some((template) => template.id === row.id),
    });
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
    const parsed = SendManualVenueEmailBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Enter a venue, email address and template." }); return; }
    const input = parsed.data;
    const template = (await availableTemplates()).find((item) => item.id === input.templateId);
    if (!template) { res.status(400).json({ message: "This template was removed. Refresh the template list." }); return; }
    const recipientEmail = input.recipientEmail.trim().toLowerCase();
    const businessName = input.businessName.trim();
    if (!businessName || !recipientEmail) { res.status(400).json({ message: "Enter a venue and recipient." }); return; }
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
    });
    const [log] = await db.insert(venueOutreachEmailLogsTable).values({
      venueOwnerProfileId: profileId, applicationInviteTokenId: inviteId, placeId: input.placeId ?? null,
      businessName, recipientEmail, template: template.id, templateName: template.name,
      kind: inviteId ? "new_venue_outreach" : "manager_announcement",
      deliveryStatus: "sending", actorUid: actor(req),
    }).returning({ id: venueOutreachEmailLogsTable.id });
    if (!log) throw new Error("Unable to record outgoing email.");
    try {
      await sendGmailHtmlEmail({ to: recipientEmail, ...email });
    } catch (error) {
      await db.update(venueOutreachEmailLogsTable).set({ deliveryStatus: "delivery_uncertain" })
        .where(eq(venueOutreachEmailLogsTable.id, log.id));
      req.log?.warn({ logId: log.id }, "Manual venue email delivery not confirmed");
      res.status(503).json({ message: "Delivery could not be confirmed. Check Gmail Sent before sending again." }); return;
    }
    await db.update(venueOutreachEmailLogsTable).set({ deliveryStatus: "sent", sentAt: new Date() })
      .where(eq(venueOutreachEmailLogsTable.id, log.id));
    res.status(201).json({ emailSent: true, recipientEmail });
  });
  return router;
}

function validTemplate(input: { name: string; subject: string; body: string } | undefined): boolean {
  return !!input && !!input.name.trim() && !!input.subject.trim() && !!input.body.trim() &&
    !/[\r\n]/.test(input.subject) && unknownEmailVariables(`${input.subject} ${input.body}`).length === 0;
}
