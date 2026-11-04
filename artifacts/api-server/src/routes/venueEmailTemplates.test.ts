import express from "express";
import request from "supertest";
import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, venueEmailTemplatesTable, venueOwnerProfilesTable, venueOutreachEmailLogsTable, venueApplicationInviteTokensTable, venueOutreachEmailSuppressionsTable } from "@workspace/db";

const send = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("../lib/gmail.js", () => ({ sendGmailHtmlEmail: send }));
vi.mock("../lib/email.js", () => ({
  getVenueManagerBaseUrl: () => "https://manager.example.test",
  getMetAppIntroVideoAssets: () => ({
    videoUrl: "https://manager.example.test/intro.mp4",
    posterUrl: "https://manager.example.test/intro.jpg",
  }),
}));
import { createVenueEmailTemplatesRouter, isSupportedManualEmailAddress } from "./venueEmailTemplates.js";
import { GmailSendError } from "../lib/gmailDeliveryStatus.js";
import {
  defaultManualEmailTemplates,
  mergeBuiltinOutreachTemplateAdditions,
  renderManualVenueEmail,
  unknownEmailVariables,
} from "../lib/manualVenueEmail.js";

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
const suppressedEmails: string[] = [];
const prefix = `template-it-${crypto.randomUUID()}`;
let templateId = "";

describe("manual venue email address validation", () => {
  it("accepts RFC-valid ampersands in an unquoted email local part", () => {
    expect(isSupportedManualEmailAddress("F&Breservations.doha@sheraton.com")).toBe(true);
    expect(isSupportedManualEmailAddress("first..last@example.com")).toBe(false);
  });
});

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
    if (suppressedEmails.length) await db.delete(venueOutreachEmailSuppressionsTable).where(inArray(venueOutreachEmailSuppressionsTable.email, suppressedEmails));
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
  it("sends to an RFC-valid address with an ampersand in its local part", async () => {
    await sendTo({ recipientEmail: "F&Breservations.doha@sheraton.com" });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: "f&breservations.doha@sheraton.com",
    }));
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
  it("records explicit retry lineage and rejects a bounced source for a different address", async () => {
    const [source] = await db.insert(venueOutreachEmailLogsTable).values({
      businessName: prefix,
      recipientEmail: "safe@example.test",
      template: templateId,
      kind: "new_venue_outreach",
      deliveryStatus: "bounced",
      gmailBounceMessageId: `${prefix}-${crypto.randomUUID()}`,
      sentAt: new Date(),
      bouncedAt: new Date(),
    }).returning({ id: venueOutreachEmailLogsTable.id });
    logIds.push(source!.id);

    const retryResponse = await sendTo({ retryOfLogId: source!.id });
    expect(retryResponse.body.emailSent).toBe(true);
    const rows = await db.select().from(venueOutreachEmailLogsTable)
      .where(eq(venueOutreachEmailLogsTable.businessName, prefix))
      .orderBy(venueOutreachEmailLogsTable.id);
    expect(rows.at(-1)?.retryOfLogId).toBe(source!.id);

    const [wrongAddressSource] = await db.insert(venueOutreachEmailLogsTable).values({
      businessName: prefix,
      recipientEmail: "different@example.test",
      template: templateId,
      kind: "new_venue_outreach",
      deliveryStatus: "bounced",
      gmailBounceMessageId: `${prefix}-${crypto.randomUUID()}`,
      sentAt: new Date(),
      bouncedAt: new Date(),
    }).returning({ id: venueOutreachEmailLogsTable.id });
    logIds.push(wrongAddressSource!.id);

    send.mockClear();
    await sendTo({ retryOfLogId: wrongAddressSource!.id }, 409);
    expect(send).not.toHaveBeenCalled();
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
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "safe@example.test", subject: "The latest Met updates for your venue" }));
  });
  it("sends the screenshot-only Met tour with all seven full-size images", async () => {
    await sendTo({ templateId: "a_look_into_met" });
    expect(send).toHaveBeenCalledTimes(1);
    const sent = send.mock.calls[0][0];
    expect(sent.subject).toBe("A look into Met");
    for (const filename of [
      "met-home-discovery-preview.jpg",
      "met-venue-visitors-preview.jpg",
      "met-venue-leaderboard-preview.jpg",
      "met-connections-preview.jpg",
      "met-venue-guestbook-preview.jpg",
      "met-saved-places-preview.jpg",
      "met-trophies-collection-preview.jpg",
    ]) {
      expect(sent.html).toContain(`src="https://manager.example.test/venue-admin/media/${filename}"`);
      expect(sent.text).toContain(`https://manager.example.test/venue-admin/media/${filename}`);
    }
    expect(sent.html).not.toContain("Frequently asked questions");
    expect(sent.html).not.toContain("met-home-discovery-email-thumb.jpg");
    expect(sent.html).not.toContain("A place for people to meet.");
    expect(sent.html).not.toContain("This message was sent personally");
    expect(sent.html).toContain("The Met app is totally free for users");
    expect(sent.html).toContain("designed with privacy and security in mind");
    expect(sent.html).toContain("Adding your venue to the Met world map is currently free.");
    expect(sent.html).toContain('href="https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926"');
    expect(sent.html).toContain('href="https://play.google.com/store/apps/details?id=app.met.founders"');
    expect(sent.html).toContain("Please reply to this email");
    expect(sent.html).toContain("Settings → Register your venue");
    expect(sent.text).toContain("https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926");
    expect(sent.text).toContain("https://play.google.com/store/apps/details?id=app.met.founders");
  });
  it("honors the pasted-list option without changing ordinary manual sends", async () => {
    await sendTo({ templateId: "introduction", bulkInvitation: true });
    expect(send.mock.calls[0][0].html).toContain("We’d love to invite you and your venue to use Met.");
    await sendTo({ templateId: "introduction" });
    expect(send.mock.calls[1][0].html).not.toContain("We’d love to invite you and your venue to use Met.");
    expect(send.mock.calls[1][0].html).toContain(`Hello ${prefix} team,`);
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
  it("reports the Gmail status for a definite rejection and marks it failed", async () => {
    send.mockRejectedValueOnce(new GmailSendError("Rejected", "GMAIL_DELIVERY", "failed", 429));
    const response = await sendTo({}, 429);
    expect(response.body.message).toContain("was not sent");
    expect(response.body.message).toContain("rate-limited");
    expect(response.body.gmailStatus).toBe(429);
    const [log] = await db.select().from(venueOutreachEmailLogsTable)
      .where(eq(venueOutreachEmailLogsTable.id, logIds.at(-1)!));
    expect(log.deliveryStatus).toBe("failed");
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
  it("requires and renders the personalized venue-fit reason", async () => {
    await sendTo({ templateId: "global_venue_prospect" }, 400);
    await sendTo({ templateId: "global_venue_prospect_es" }, 400);
    expect(send).not.toHaveBeenCalled();
    await sendTo({
      templateId: "global_venue_prospect",
      venueFitReason: "your weekly art workshops bring local visitors back",
    });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: "safe@example.test",
      text: expect.stringContaining("because your weekly art workshops bring local visitors back"),
    }));
  });
  it("sends the Spanish personalized invitation with its venue PDF", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4\n%%EOF\n", "ascii");
    await sendTo({
      templateId: "global_venue_prospect_es",
      venueFitReason: "su programación de conciertos invita al público a regresar",
      pdfAttachment: {
        fileName: "Venue Introduction.pdf",
        contentBase64: pdfBytes.toString("base64"),
      },
    });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: "safe@example.test",
      subject: `Una invitación para que ${prefix} conozca Met`,
      text: expect.stringMatching(/Me llamó la atención[\s\S]*su programación de conciertos invita al público a regresar/),
      attachments: [{
        filename: "Venue Introduction.pdf",
        content: pdfBytes,
        contentType: "application/pdf",
      }],
    }));
  });
  it("attaches a validated personalized PDF to a venue prospect invitation", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4\n%%EOF\n", "ascii");
    await sendTo({
      templateId: "global_venue_prospect",
      venueFitReason: "your community events bring local visitors back",
      pdfAttachment: {
        fileName: "Venue Introduction.pdf",
        contentBase64: pdfBytes.toString("base64"),
      },
    });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: "safe@example.test",
      attachments: [{
        filename: "Venue Introduction.pdf",
        content: pdfBytes,
        contentType: "application/pdf",
      }],
    }));
  });
  it("attaches a PDF to a no-reply follow-up and creates an application invitation", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4\n%%EOF\n", "ascii");
    await sendTo({
      templateId: "venue_no_reply_follow_up",
      pdfAttachment: {
        fileName: "Venue Introduction.pdf",
        contentBase64: pdfBytes.toString("base64"),
      },
    });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: "safe@example.test",
      subject: `A Met introduction for ${prefix}`,
      attachments: [{
        filename: "Venue Introduction.pdf",
        content: pdfBytes,
        contentType: "application/pdf",
      }],
    }));
    const logs = await db.select().from(venueOutreachEmailLogsTable)
      .where(eq(venueOutreachEmailLogsTable.businessName, prefix));
    const followUp = logs.find((log) => log.template === "venue_no_reply_follow_up");
    expect(followUp?.kind).toBe("new_venue_outreach");
    expect(followUp?.applicationInviteTokenId).not.toBeNull();
  });
  it("sends the first-contact introduction with a fresh application link per recipient", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4\n%%EOF\n", "ascii");
    const pdfAttachment = {
      fileName: "Venue Introduction.pdf",
      contentBase64: pdfBytes.toString("base64"),
    };
    const firstRecipient = `${prefix}-first@example.test`;
    const secondRecipient = `${prefix}-second@example.test`;
    const sendFirstContact = (recipientEmail: string) => sendTo({
      templateId: "global_venue_prospect_first_contact",
      recipientEmail,
      venueFitReason: "your community events give local guests a reason to return",
      pdfAttachment,
    });

    await sendFirstContact(firstRecipient);
    const firstEmail = send.mock.calls.at(-1)?.[0];
    expect(firstEmail).toEqual(expect.objectContaining({
      to: firstRecipient,
      subject: `A complete introduction to Met for ${prefix}`,
      text: expect.stringContaining(`I’m reaching out with a complete introduction to Met for ${prefix}.`),
      attachments: [{
        filename: "Venue Introduction.pdf",
        content: pdfBytes,
        contentType: "application/pdf",
      }],
    }));
    expect(firstEmail.text).toContain("We believe Met, when used well, could have a huge impact on your business traffic");
    expect(firstEmail.text).not.toContain("I’m following up");
    const firstLink = firstEmail.text.match(/https:\/\/manager\.example\.test\/apply#invite=[A-Za-z0-9_-]+/)?.[0];
    expect(firstLink).toBeTruthy();

    await sendFirstContact(secondRecipient);
    const secondEmail = send.mock.calls.at(-1)?.[0];
    const secondLink = secondEmail.text.match(/https:\/\/manager\.example\.test\/apply#invite=[A-Za-z0-9_-]+/)?.[0];
    expect(secondEmail.to).toBe(secondRecipient);
    expect(secondLink).toBeTruthy();
    expect(secondLink).not.toBe(firstLink);

    const logs = await db.select().from(venueOutreachEmailLogsTable)
      .where(eq(venueOutreachEmailLogsTable.businessName, prefix));
    const firstContactSends = logs.filter((log) => log.template === "global_venue_prospect_first_contact");
    expect(firstContactSends).toHaveLength(2);
    expect(firstContactSends.every((log) => log.applicationInviteTokenId !== null)).toBe(true);
  });
  it("rejects invalid PDFs and attachments on other templates before transport", async () => {
    await sendTo({
      templateId: "global_venue_prospect",
      venueFitReason: "your public events bring local visitors back",
      pdfAttachment: {
        fileName: "Venue Introduction.pdf",
        contentBase64: Buffer.from("not a PDF", "ascii").toString("base64"),
      },
    }, 400);
    await sendTo({
      pdfAttachment: {
        fileName: "Venue Introduction.pdf",
        contentBase64: Buffer.from("%PDF-1.4\n%%EOF\n", "ascii").toString("base64"),
      },
    }, 400);
    expect(send).not.toHaveBeenCalled();
  });
  it("blocks manual sends to globally suppressed email addresses", async () => {
    const email = `${prefix}-suppressed@example.test`.toLowerCase();
    await db.insert(venueOutreachEmailSuppressionsTable).values({ email, actorUid: "template-integration-test" });
    suppressedEmails.push(email);
    await sendTo({
      templateId: "global_venue_prospect",
      recipientEmail: email,
      venueFitReason: "your public events bring local visitors back",
    }, 409);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("manual email rendering", () => {
  it("uses the invitation opening only for pasted-list sends in both HTML and plain text", () => {
    const values = { businessName: "your venue", recipientEmail: "owner@example.test",
      venueManagerUrl: "https://example.test", applicationUrl: "https://example.test/apply#invite=unique" };
    const templates = defaultManualEmailTemplates(values.venueManagerUrl, {
      videoUrl: "https://example.test/intro.mp4", posterUrl: "https://example.test/intro.jpg",
    });
    for (const template of templates) {
      const regular = renderManualVenueEmail(template, values);
      const bulk = renderManualVenueEmail(template, values, true);
      const opening = template.id === "global_venue_prospect_es"
        ? "Nos gustaría invitarles a conocer Met."
        : "We’d love to invite you and your venue to use Met.";
      expect(bulk.html).toContain(opening);
      expect(bulk.text).toContain(opening);
      expect(bulk.html).not.toMatch(/(?:Hello|Hi|Dear|Hola|Estimad[oa]) your venue(?: team)?[,<]/i);
      expect(regular.html).not.toContain(opening);
      expect(bulk.subject).toBe(regular.subject);
      const links = regular.html.match(/href="[^"]*"/g) ?? [];
      expect(bulk.html.match(/href="[^"]*"/g) ?? []).toEqual(links);
    }
  });

  it("keeps branding before HTML greetings and preserves all content after the greeting", () => {
    const template = { id: "test", name: "Test", builtin: false, format: "html" as const,
      subject: "Invitation", body: '<html><body><p>Met venues</p><p style="color:green">Hello {{businessName}} team,</p><p>Keep this content.</p></body></html>' };
    const email = renderManualVenueEmail(template, {
      businessName: "your venue", recipientEmail: "owner@example.test",
      venueManagerUrl: "https://example.test", applicationUrl: "https://example.test/apply",
    }, true);
    expect(email.html).toBe('<html><body><p>Met venues</p><p style="color:green">We’d love to invite you and your venue to use Met.</p><p>Keep this content.</p></body></html>');
  });

  it("adds the opening without discarding custom template content when there is no greeting", () => {
    for (const format of ["html", "text"] as const) {
      const body = format === "html" ? "<html><body><p>Your event is ready.</p></body></html>" : "Your event is ready.";
      const email = renderManualVenueEmail({ id: "custom", name: "Custom", builtin: false, format, subject: "Event", body }, {
        businessName: "your venue", recipientEmail: "owner@example.test",
        venueManagerUrl: "https://example.test", applicationUrl: "https://example.test/apply",
      }, true);
      expect(email.html).toContain("Your event is ready.");
      expect(email.text).toMatch(/^We’d love to invite you and your venue to use Met\./);
    }
  });

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
    expect(templates).toHaveLength(19);
    const screenshotTour = templates.find((template) => template.id === "a_look_into_met");
    expect(screenshotTour?.name).toBe("A look into Met");
    expect(screenshotTour?.subject).toBe("A look into Met");
    expect(screenshotTour?.body.match(/<img src="https:\/\/example\.test\/venue-admin\/media\/[^"]+\.jpg"/g)).toHaveLength(7);
    expect(screenshotTour?.body).not.toContain("Frequently asked questions");
    expect(mergeBuiltinOutreachTemplateAdditions(screenshotTour!, screenshotTour!).body).toBe(screenshotTour?.body);
    const registration = templates.find((template) => template.id === "registration");
    expect(registration?.body).toContain("Settings → Register your venue");
    expect(registration?.body).toContain("guestbook");
    expect(registration?.body).toContain("apps.apple.com");
    expect(registration?.body).toContain("play.google.com");
    expect(templates.find((template) => template.id === "preapproval_video_application")?.body).toContain("{{applicationUrl}}");
    expect(templates.every((template) => unknownEmailVariables(`${template.subject} ${template.body}`).length === 0)).toBe(true);
    expect(templates.find((template) => template.id === "registration")?.body).not.toContain("one-time");
    const prospect = templates.find((template) => template.id === "global_venue_prospect");
    expect(prospect?.body).toContain("{{venueFitReason}}");
    expect(prospect?.format).toBe("html");
    expect(prospect?.body.match(/<img src="https:\/\/example\.test\/venue-admin\/media\/[^"]+\.jpg"/g)).toHaveLength(2);
    const personalized = renderManualVenueEmail(prospect!, {
      businessName: "Example venue",
      recipientEmail: "owner@example.test",
      venueManagerUrl: "https://example.test",
      applicationUrl: "https://example.test/apply",
      venueFitReason: '<img src=x onerror="alert(1)">',
    });
    expect(personalized.text).toContain("because <img src=x onerror=\"alert(1)\">");
    expect(personalized.text).toContain("https://example.test/venue-admin/media/met-home-discovery-preview.jpg");
    expect(personalized.text).toContain("https://example.test/venue-admin/media/met-venue-visitors-preview.jpg");
    expect(personalized.html).toContain("&lt;img");
    expect(personalized.html).not.toContain('<img src=x onerror="alert(1)">');
    const spanishProspect = templates.find((template) => template.id === "global_venue_prospect_es");
    expect(spanishProspect?.subject).toContain("{{businessName}}");
    expect(spanishProspect?.body).toContain("{{venueFitReason}}");
    expect(spanishProspect?.body.match(/<li>/g)).toHaveLength(4);
    expect(spanishProspect?.body).toContain("Ajustes → Registra tu local");
    expect(spanishProspect?.body).toContain("¿Les interesaría una breve presentación?");
    const noReply = templates.find((template) => template.id === "venue_no_reply_follow_up");
    expect(noReply?.name).toContain("No-reply follow-up");
    expect(noReply?.body).toContain("{{applicationUrl}}");
    const followUpEmail = renderManualVenueEmail(noReply!, {
      businessName: "Example venue",
      recipientEmail: "owner@example.test",
      venueManagerUrl: "https://example.test",
      applicationUrl: "https://example.test/apply#invite=unique",
    });
    expect(followUpEmail.subject).toBe("A Met introduction for Example venue");
    expect(followUpEmail.text).toContain("https://example.test/apply#invite=unique");
    expect(followUpEmail.text).toContain("attached venue-specific PDF for a clearer picture of Met");
    expect(followUpEmail.text).toContain("could have a huge impact on your business traffic");
    expect(followUpEmail.text).toContain("strengthen your relationship with your customers");
    expect(followUpEmail.text).toContain("encourage them to return again and again");
    expect(followUpEmail.text).toContain("Met is free to use!");
    expect(followUpEmail.text).toContain("visionary partners");
    expect(followUpEmail.text).toContain("something is stopping you from using Met");
    expect(unknownEmailVariables(`${noReply?.subject} ${noReply?.body}`)).toEqual([]);
    const firstContact = templates.find((template) => template.id === "global_venue_prospect_first_contact");
    expect(firstContact?.name).toContain("first contact");
    expect(firstContact?.format).toBe("text");
    expect(firstContact?.body).toContain("I’m reaching out with a complete introduction to Met for {{businessName}}.");
    const firstContactEmail = renderManualVenueEmail(firstContact!, {
      businessName: "Roseleaf",
      recipientEmail: "manager@example.test",
      venueManagerUrl: "https://example.test/venue-manager",
      applicationUrl: "https://example.test/venue-manager/apply#invite=preview-only",
    });
    expect(firstContactEmail.subject).toBe("A complete introduction to Met for Roseleaf");
    for (const phrase of [
      "Hello Roseleaf team,",
      "We hope you’ll take a look at the attached venue-specific PDF",
      "could have a huge impact on your business traffic",
      "We’re hoping to find visionary partners",
      "We’d also appreciate your honest feedback",
      "Applications are reviewed; this link does not grant account access.",
      "If someone else handles venue partnerships or guest engagement",
      "Regards,\nThe Met venues team\nmetapp.contact@gmail.com",
    ]) {
      expect(firstContactEmail.text).toContain(phrase);
    }
    expect(firstContactEmail.text).not.toContain("I’m following up");
    expect(firstContactEmail.text).toContain("https://example.test/venue-manager/apply#invite=preview-only");
    expect(unknownEmailVariables(`${firstContact?.subject} ${firstContact?.body}`)).toEqual([]);
  });

  it("refreshes added no-reply copy in saved built-ins without replacing admin wording", () => {
    const templates = defaultManualEmailTemplates("https://example.test", {
      videoUrl: "https://example.test/intro.mp4", posterUrl: "https://example.test/intro.jpg",
    });
    const latestDefault = templates.find((template) => template.id === "venue_no_reply_follow_up")!;
    const legacyIntro =
      "I’m following up with a complete introduction to Met for {{businessName}}. I’ve attached a venue-specific PDF showing how guests can discover a venue, check in on site, save visit memories, and find reasons to return.";
    const oldHtmlBody = latestDefault.body
      .replace(/<!-- MET_NO_REPLY_FOLLOWUP_SECTION_START -->[\s\S]*?<!-- MET_NO_REPLY_FOLLOWUP_SECTION_END -->/, "")
      .replace("I’m following up with a complete introduction to Met for {{businessName}}.", legacyIntro)
      .replace("<p>Regards,", "<p>Keep this admin-authored note.</p><p>Regards,");
    const savedHtml = {
      ...latestDefault,
      name: "Admin-edited no-reply follow-up",
      subject: "Custom follow-up subject",
      body: oldHtmlBody,
    };

    const mergedHtml = mergeBuiltinOutreachTemplateAdditions(savedHtml, latestDefault);
    expect(mergedHtml.name).toBe(savedHtml.name);
    expect(mergedHtml.subject).toBe(savedHtml.subject);
    expect(mergedHtml.body).toContain("Keep this admin-authored note.");
    expect(mergedHtml.body).toContain("Met is free to use!");
    expect(mergedHtml.body).toContain("something is stopping you from using Met");
    expect(mergeBuiltinOutreachTemplateAdditions(mergedHtml, latestDefault).body).toBe(mergedHtml.body);

    const savedText = {
      ...savedHtml,
      format: "text" as const,
      body: "Hello {{businessName}} team,\n\nAdmin-approved introduction.\n\nIf you’d like to explore managing your venue, see {{applicationUrl}}.\n\nRegards,\nThe Met venues team",
    };
    const mergedText = mergeBuiltinOutreachTemplateAdditions(savedText, latestDefault);
    expect(mergedText.format).toBe("text");
    expect(mergedText.body).toContain("Admin-approved introduction.");
    expect(mergedText.body).toContain("Met is free to use!");
    expect(mergedText.body).toContain("{{applicationUrl}}");
    expect(mergedText.body).not.toContain("<p>");
    expect(mergeBuiltinOutreachTemplateAdditions(mergedText, latestDefault).body).toBe(mergedText.body);

    const savedTextWithPreviousCopy = {
      ...savedText,
      body: [
        "Hello {{businessName}} team,",
        "Admin-approved introduction.",
        "We hope you’ll take a look at the attached venue-specific PDF for a clearer picture of Met and how it works.",
        "We believe Met, when used well, could help bring more guests through your doors, strengthen your relationship with them, and give them reasons to return. Met is free for venues to use.",
        "We’re hoping to find visionary partners who can see that potential and imagine what Met could make possible for their venue.",
        "We’d also appreciate your honest feedback: if something is stopping you from using Met, please tell us what it is. Your feedback will help us understand what’s getting in the way and how we can improve.",
        "If you’d like to explore managing your venue, see {{applicationUrl}}.",
        "Regards,\nThe Met venues team",
      ].join("\n\n"),
    };
    const refreshedText = mergeBuiltinOutreachTemplateAdditions(savedTextWithPreviousCopy, latestDefault);
    expect(refreshedText.body).toContain("Admin-approved introduction.");
    expect(refreshedText.body).toContain("could have a huge impact on your business traffic");
    expect(refreshedText.body).not.toContain("could help bring more guests through your doors");
    expect(mergeBuiltinOutreachTemplateAdditions(refreshedText, latestDefault).body).toBe(refreshedText.body);
  });

  it("adds two screenshots to saved personalized text templates without replacing admin copy", () => {
    const templates = defaultManualEmailTemplates("https://example.test", {
      videoUrl: "https://example.test/intro.mp4", posterUrl: "https://example.test/intro.jpg",
    });
    const latestDefault = templates.find((template) => template.id === "global_venue_prospect")!;
    const saved = {
      ...latestDefault,
      format: "text" as const,
      name: "Admin-edited invitation",
      subject: "Custom invitation subject",
      body: "Approved custom opening.\n\nI thought {{businessName}} could be a good fit because {{venueFitReason}}.\n\nApproved custom sign-off.",
    };

    const merged = mergeBuiltinOutreachTemplateAdditions(saved, latestDefault);

    expect(merged.format).toBe("html");
    expect(merged.name).toBe(saved.name);
    expect(merged.subject).toBe(saved.subject);
    expect(merged.body).toContain("Approved custom opening.");
    expect(merged.body).toContain("Approved custom sign-off.");
    expect(merged.body).toContain("{{venueFitReason}}");
    expect(merged.body.match(/<img src="https:\/\/example\.test\/venue-admin\/media\/[^"]+\.jpg"/g)).toHaveLength(2);
    expect(mergeBuiltinOutreachTemplateAdditions(merged, latestDefault).body).toBe(merged.body);
  });

  it("serves the media screenshot and FAQ in built-in guest-facing templates", () => {
    const templates = defaultManualEmailTemplates("https://example.test", {
      videoUrl: "https://example.test/intro.mp4", posterUrl: "https://example.test/intro.jpg",
    });
    const updatedTemplateIds = [
      "met_launch_with_links",
      "met_launch_without_links",
      "introduction",
      "benefits",
      "events",
      "rewards",
      "follow_up",
      "latest_updates",
      "latest_updates_prospect",
    ];

    for (const id of updatedTemplateIds) {
      const template = templates.find((candidate) => candidate.id === id);
      expect(template?.body).toContain('src="https://example.test/venue-admin/media/met-home-discovery-email-thumb.jpg"');
      expect(template?.body).toContain('src="https://example.test/venue-admin/media/met-venue-visitors-email-thumb.jpg"');
      expect(template?.body).toContain('src="https://example.test/venue-admin/media/met-venue-leaderboard-email-thumb.jpg"');
      expect(template?.body).toContain('src="https://example.test/venue-admin/media/met-connections-email-thumb.jpg"');
      expect(template?.body).toContain('href="https://example.test/venue-admin/media/met-home-discovery-preview.jpg"');
      expect(template?.body).toContain('href="https://example.test/venue-admin/media/met-venue-visitors-preview.jpg"');
      expect(template?.body).toContain('href="https://example.test/venue-admin/media/met-venue-guestbook-preview.jpg"');
      expect(template?.body).toContain('href="https://example.test/venue-admin/media/met-venue-leaderboard-preview.jpg"');
      expect(template?.body).toContain('href="https://example.test/venue-admin/media/met-saved-places-preview.jpg"');
      expect(template?.body).toContain('href="https://example.test/venue-admin/media/met-trophies-collection-preview.jpg"');
      expect(template?.body).toContain('href="https://example.test/venue-admin/media/met-connections-preview.jpg"');
      expect(template?.body).toContain("Frequently asked questions");
      expect(template?.body).toContain("Saving a place is not a check-in.");
      expect(template?.body).toContain("4. Can a user hide from nearby discovery at any time?");
      expect(template?.body).toContain("5. Does nearby visibility share my precise GPS location?");
      expect(template?.body).not.toContain("Are the sample questionnaires venue FAQs?");
      expect(template?.body).not.toContain("Is Met completely secure");
    }
  });

  it("adds missing sections to saved built-ins without replacing admin copy or duplicating sections", () => {
    const latestDefault = defaultManualEmailTemplates("https://example.test", {
      videoUrl: "https://example.test/intro.mp4", posterUrl: "https://example.test/intro.jpg",
    }).find((template) => template.id === "introduction")!;
    const footerRow =
      '<tr><td style="padding:23px 36px 27px;background:#f5f5ef;border-top:1px solid #e5e7df;">';
    const saved = {
      ...latestDefault,
      name: "My edited introduction",
      subject: "A note from your local venues team",
      body: `<html><body><table><tr><td><p>Admin-approved custom paragraph.</p></td></tr>${footerRow}<p>Custom footer.</p></td></tr></table></body></html>`,
    };

    const merged = mergeBuiltinOutreachTemplateAdditions(saved, latestDefault);
    expect(merged.name).toBe(saved.name);
    expect(merged.subject).toBe(saved.subject);
    expect(merged.body).toContain("Admin-approved custom paragraph.");
    expect(merged.body).toContain("Custom footer.");
    expect(merged.body).toContain('src="https://example.test/venue-admin/media/met-home-discovery-email-thumb.jpg"');
    expect(merged.body).toContain('src="https://example.test/venue-admin/media/met-venue-visitors-email-thumb.jpg"');
    expect(merged.body).toContain('src="https://example.test/venue-admin/media/met-venue-leaderboard-email-thumb.jpg"');
    expect(merged.body).toContain('src="https://example.test/venue-admin/media/met-connections-email-thumb.jpg"');
    expect(merged.body).toContain('href="https://example.test/venue-admin/media/met-home-discovery-preview.jpg"');
    expect(merged.body).toContain('href="https://example.test/venue-admin/media/met-venue-visitors-preview.jpg"');
    expect(merged.body).toContain('href="https://example.test/venue-admin/media/met-venue-guestbook-preview.jpg"');
    expect(merged.body).toContain('href="https://example.test/venue-admin/media/met-venue-leaderboard-preview.jpg"');
    expect(merged.body).toContain('href="https://example.test/venue-admin/media/met-saved-places-preview.jpg"');
    expect(merged.body).toContain('href="https://example.test/venue-admin/media/met-trophies-collection-preview.jpg"');
    expect(merged.body).toContain('href="https://example.test/venue-admin/media/met-connections-preview.jpg"');
    expect(merged.body).toContain("Frequently asked questions");
    expect(merged.body).toContain("4. Can a user hide from nearby discovery at any time?");
    expect(merged.body).toContain("5. Does nearby visibility share my precise GPS location?");
    expect(merged.body).not.toContain("Are the sample questionnaires venue FAQs?");
    expect(merged.body).not.toContain("Is Met completely secure");
    expect(merged.body.indexOf("met-venue-visitors-preview.jpg")).toBeLessThan(merged.body.indexOf(footerRow));
    expect(mergeBuiltinOutreachTemplateAdditions(merged, latestDefault).body).toBe(merged.body);

    const previouslyUpdated = {
      ...saved,
      body: '<html><body><p>Existing screenshot is already here.</p><img src="https://example.test/venue-admin/media/met-venue-visitors-preview.jpg" alt="Venue page" /></body></html>',
    };
    const completedGallery = mergeBuiltinOutreachTemplateAdditions(previouslyUpdated, latestDefault);
    expect(completedGallery.body.match(/src="https:\/\/example\.test\/venue-admin\/media\/met-venue-visitors-preview\.jpg"/g)).toHaveLength(1);
    expect(completedGallery.body).toContain('src="https://example.test/venue-admin/media/met-venue-visitors-email-thumb.jpg"');
    expect(completedGallery.body).toContain("met-venue-guestbook-preview.jpg");
    expect(completedGallery.body).toContain("met-venue-leaderboard-preview.jpg");
    expect(completedGallery.body).toContain("met-home-discovery-preview.jpg");
    expect(completedGallery.body).toContain("met-saved-places-preview.jpg");
    expect(completedGallery.body).toContain("met-trophies-collection-preview.jpg");
    expect(completedGallery.body).toContain("met-connections-preview.jpg");
    expect(completedGallery.body).toContain("Frequently asked questions");

    const customTemplate = { ...saved, id: "custom_example", builtin: false };
    expect(mergeBuiltinOutreachTemplateAdditions(customTemplate, latestDefault)).toEqual(customTemplate);

    const textOverride = { ...saved, format: "text" as const, body: "Keep this plain-text template unchanged." };
    expect(mergeBuiltinOutreachTemplateAdditions(textOverride, latestDefault)).toEqual(textOverride);
  });

  it("replaces the managed FAQ in saved built-ins while preserving surrounding copy", () => {
    const latestDefault = defaultManualEmailTemplates("https://example.test", {
      videoUrl: "https://example.test/intro.mp4", posterUrl: "https://example.test/intro.jpg",
    }).find((template) => template.id === "introduction")!;
    const staleFaq =
      '<!-- met-venue-faq:start --><table><tr><td>Frequently asked questions</td></tr><tr><td>Old safety assurance.</td></tr></table><!-- met-venue-faq:end -->';
    const saved = {
      ...latestDefault,
      name: "Edited intro",
      subject: "Custom subject",
      body: `<html><body><p>Approved copy stays.</p>${staleFaq}<p>Custom footer stays.</p></body></html>`,
    };

    const merged = mergeBuiltinOutreachTemplateAdditions(saved, latestDefault);

    expect(merged.name).toBe(saved.name);
    expect(merged.subject).toBe(saved.subject);
    expect(merged.body).toContain("Approved copy stays.");
    expect(merged.body).toContain("Custom footer stays.");
    expect(merged.body).not.toContain("Old safety assurance.");
    expect(merged.body).not.toContain("Is Met completely secure");
    expect(merged.body).not.toContain("Are the sample questionnaires venue FAQs?");
    expect(merged.body).toContain("4. Can a user hide from nearby discovery at any time?");
    expect(merged.body).toContain("5. Does nearby visibility share my precise GPS location?");
    expect(merged.body.match(/4\. Can a user hide from nearby discovery at any time\?/g)).toHaveLength(1);
  });

  it("replaces legacy stacked managed screenshots with the compact grid while preserving saved copy", () => {
    const latestDefault = defaultManualEmailTemplates("https://example.test", {
      videoUrl: "https://example.test/intro.mp4", posterUrl: "https://example.test/intro.jpg",
    }).find((template) => template.id === "introduction")!;
    const legacyScreens = [
      ["met-venue-media-screenshot", "met-venue-visitors-preview.jpg"],
      ["met-venue-guestbook-screenshot", "met-venue-guestbook-preview.jpg"],
      ["met-venue-leaderboard-screenshot", "met-venue-leaderboard-preview.jpg"],
      ["met-venue-saved-screenshot", "met-saved-places-preview.jpg"],
      ["met-venue-trophies-screenshot", "met-trophies-collection-preview.jpg"],
      ["met-venue-home-screenshot", "met-home-discovery-preview.jpg"],
      ["met-venue-connections-screenshot", "met-connections-preview.jpg"],
    ].map(([marker, filename]) =>
      `<!-- ${marker}:start --><table><tr><td><img src="https://example.test/venue-admin/media/${filename}" /></td></tr></table><!-- ${marker}:end -->`,
    ).join("");
    const saved = {
      ...latestDefault,
      name: "Edited intro",
      subject: "Custom subject",
      body: `<html><body><p>Keep this approved copy.</p>${legacyScreens}</body></html>`,
    };

    const migrated = mergeBuiltinOutreachTemplateAdditions(saved, latestDefault);

    expect(migrated.name).toBe(saved.name);
    expect(migrated.subject).toBe(saved.subject);
    expect(migrated.body).toContain("Keep this approved copy.");
    expect(migrated.body).toContain('src="https://example.test/venue-admin/media/met-home-discovery-email-thumb.jpg"');
    expect(migrated.body).toContain('src="https://example.test/venue-admin/media/met-connections-email-thumb.jpg"');
    expect(migrated.body).not.toContain("met-venue-home-screenshot:start");
    expect(migrated.body.match(/href="https:\/\/example\.test\/venue-admin\/media\/met-home-discovery-preview\.jpg"/g)).toHaveLength(1);
  });
});
