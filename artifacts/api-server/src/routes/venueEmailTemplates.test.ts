import express from "express";
import request from "supertest";
import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, venueEmailTemplatesTable, venueOwnerProfilesTable, venueOutreachEmailLogsTable, venueApplicationInviteTokensTable } from "@workspace/db";

const send = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("../lib/gmail.js", () => ({ sendGmailHtmlEmail: send }));
vi.mock("../lib/email.js", () => ({
  getVenueManagerBaseUrl: () => "https://manager.example.test",
  getMetAppIntroVideoAssets: () => ({
    videoUrl: "https://manager.example.test/intro.mp4",
    posterUrl: "https://manager.example.test/intro.jpg",
  }),
}));
import { createVenueEmailTemplatesRouter } from "./venueEmailTemplates.js";
import { defaultManualEmailTemplates, renderManualVenueEmail, unknownEmailVariables } from "../lib/manualVenueEmail.js";

const base = "/admin/venue-owner/email-templates";
const app = express();
app.use(express.json());
app.use(createVenueEmailTemplatesRouter((req, res, next) => {
  if (req.headers["x-test-admin"] !== "yes") { res.status(401).json({ message: "Sign in" }); return; }
  next();
}, () => "template-integration-test"));
const templateIds: string[] = [];
const profileIds: number[] = [];
const logIds: number[] = [];
const inviteIds: number[] = [];
const prefix = `template-it-${crypto.randomUUID()}`;
let templateId = "";

describe.skipIf(!process.env.DATABASE_URL)("manual venue email templates", () => {
  beforeEach(() => { send.mockReset().mockResolvedValue({}); });
  beforeAll(async () => {
    const response = await request(app).post(base).set("x-test-admin", "yes").send({
      name: prefix, subject: "Hello {{businessName}}", format: "text",
      body: "Contact {{recipientEmail}}. Venue Manager: {{venueManagerUrl}}",
    }).expect(201);
    templateId = response.body.id; templateIds.push(templateId);
  });
  afterAll(async () => {
    if (logIds.length) await db.delete(venueOutreachEmailLogsTable).where(inArray(venueOutreachEmailLogsTable.id, logIds));
    if (inviteIds.length) await db.delete(venueApplicationInviteTokensTable).where(inArray(venueApplicationInviteTokensTable.id, inviteIds));
    if (profileIds.length) await db.delete(venueOwnerProfilesTable).where(inArray(venueOwnerProfilesTable.id, profileIds));
    if (templateIds.length) await db.delete(venueEmailTemplatesTable).where(inArray(venueEmailTemplatesTable.id, templateIds));
  });
  const sendTo = async (input: Record<string, unknown>, status = 201) => {
    const response = await request(app).post("/admin/venue-owner/outreach/manual-send")
      .set("x-test-admin", "yes").send({ templateId, businessName: prefix, recipientEmail: "safe@example.test", ...input }).expect(status);
    const logs = await db.select().from(venueOutreachEmailLogsTable).where(eq(venueOutreachEmailLogsTable.businessName, prefix))
      .orderBy(venueOutreachEmailLogsTable.id);
    for (const log of logs) {
      if (!logIds.includes(log.id)) logIds.push(log.id);
      if (log.applicationInviteTokenId && !inviteIds.includes(log.applicationInviteTokenId)) inviteIds.push(log.applicationInviteTokenId);
    }
    return response;
  };
  it("requires an admin for listing, creating, editing, removing, and sending", async () => {
    await request(app).get(base).expect(401);
    await request(app).post(base).send({}).expect(401);
    await request(app).put(`${base}/${templateId}`).send({}).expect(401);
    await request(app).delete(`${base}/${templateId}`).expect(401);
    await request(app).post("/admin/venue-owner/outreach/manual-send").send({}).expect(401);
    expect(send).not.toHaveBeenCalled();
  });
  it("persists creation and edits, and uses the edited content for sending", async () => {
    await request(app).put(`${base}/${templateId}`).set("x-test-admin", "yes").send({
      name: `${prefix} edited`, subject: "Updates for {{businessName}}", body: "Hello {{businessName}} at {{recipientEmail}}.", format: "text",
    }).expect(200);
    const response = await request(app).get(base).set("x-test-admin", "yes").expect(200);
    expect(response.body.find((template: { id: string }) => template.id === templateId).name).toBe(`${prefix} edited`);
    await sendTo({});
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "safe@example.test", subject: `Updates for ${prefix}`, text: `Hello ${prefix} at safe@example.test.` }));
  });
  it("allows emails to submitted and approved applications and repeated manual sends without a cooldown", async () => {
    for (const applicationStatus of ["submitted", "approved"] as const) {
      const [profile] = await db.insert(venueOwnerProfilesTable).values({
        ownerUid: `${prefix}-${applicationStatus}`, placeId: `${prefix}-${applicationStatus}`,
        placeName: prefix, businessName: prefix, applicationStatus,
      }).returning({ id: venueOwnerProfilesTable.id });
      profileIds.push(profile.id);
      await sendTo({ venueOwnerProfileId: profile.id });
      await sendTo({ venueOwnerProfileId: profile.id });
    }
    expect(send).toHaveBeenCalledTimes(4);
  });
  it("generates working email-bound application invitations without granting venue access", async () => {
    await sendTo({ templateId: "preapproval_video_application" });
    const html = send.mock.calls[0][0].html as string;
    const token = html.match(/apply#invite=([A-Za-z0-9_-]+)/)?.[1];
    expect(token).toBeTruthy();
    const hash = crypto.createHash("sha256").update(token!).digest("base64url");
    const [invite] = await db.select().from(venueApplicationInviteTokensTable)
      .where(eq(venueApplicationInviteTokensTable.tokenHash, hash));
    expect(invite.invitedEmail).toBe("safe@example.test");
    expect(invite.applicationId).toBeNull();
    expect(invite.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
  it("allows the manager-updates template for an unlinked prospect without audience restrictions", async () => {
    await sendTo({ templateId: "latest_updates" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "safe@example.test", subject: "Great news for our venue managers." }));
  });
  it("reports uncertain transport once and retains the audit record without retrying", async () => {
    send.mockRejectedValueOnce(new Error("timeout"));
    await sendTo({}, 503);
    expect(send).toHaveBeenCalledTimes(1);
    const [log] = await db.select().from(venueOutreachEmailLogsTable)
      .where(eq(venueOutreachEmailLogsTable.id, logIds.at(-1)!));
    expect(log.deliveryStatus).toBe("delivery_uncertain");
    expect(log.sentAt).toBeNull();
  });
  it("removes a custom template permanently from available choices while keeping send history", async () => {
    await request(app).delete(`${base}/${templateId}`).set("x-test-admin", "yes").expect(204);
    const response = await request(app).get(base).set("x-test-admin", "yes").expect(200);
    expect(response.body.some((template: { id: string }) => template.id === templateId)).toBe(false);
    const logs = await db.select().from(venueOutreachEmailLogsTable).where(eq(venueOutreachEmailLogsTable.template, templateId));
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].templateName).toBe(`${prefix} edited`);
    const [record] = await db.select().from(venueEmailTemplatesTable).where(eq(venueEmailTemplatesTable.id, templateId));
    expect(record.deletedAt).not.toBeNull();
    await sendTo({}, 400);
    expect(send).not.toHaveBeenCalled();
  });
  it("rejects malformed recipients and unsupported variables before transport", async () => {
    await sendTo({ recipientEmail: "not-an-email" }, 400);
    await request(app).post(base).set("x-test-admin", "yes").send({
      name: prefix, subject: "{{password}}", body: "invalid", format: "text",
    }).expect(400);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("manual email rendering", () => {
  it("escapes personalized HTML and subjects without recursively interpreting venue names", () => {
    const template = { id: "test", name: "Test", builtin: false, format: "html" as const,
      subject: "Hello {{businessName}}", body: "<p>{{businessName}}</p><p>{{recipientEmail}}</p>" };
    const email = renderManualVenueEmail(template, {
      businessName: '<img src=x onerror="alert(1)">\r\n{{recipientEmail}}', recipientEmail: "test@example.test",
      venueManagerUrl: "https://example.test", applicationUrl: "https://example.test/apply",
    });
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.html).toContain("&lt;img");
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("{{recipientEmail}}");
  });
  it("offers all existing email kinds and previews application URLs as placeholders", () => {
    const templates = defaultManualEmailTemplates("https://example.test", {
      videoUrl: "https://example.test/intro.mp4", posterUrl: "https://example.test/intro.jpg",
    });
    expect(templates).toHaveLength(13);
    expect(templates.find((template) => template.id === "preapproval_video_application")?.body).toContain("{{applicationUrl}}");
    expect(templates.every((template) => unknownEmailVariables(`${template.subject} ${template.body}`).length === 0)).toBe(true);
    expect(templates.find((template) => template.id === "registration")?.body).not.toContain("one-time");
  });
});
