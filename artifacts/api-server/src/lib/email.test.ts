import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendMail: vi.fn(), sendGmail: vi.fn() }));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail: mocks.sendMail }),
  },
}));
vi.mock("./gmail.js", () => ({ sendGmailHtmlEmail: mocks.sendGmail }));

import {
  sendAdminVenueRemovalRequestEmail,
  sendClaimLinkOverdueAlertEmail,
  sendVenueApprovedEmail,
  sendVenueContactRequestEmail,
  sendVenueRegistrationReminderEmail,
} from "./email.js";

describe("transactional venue emails", () => {
  beforeEach(() => {
    vi.stubEnv("SMTP_HOST", "smtp.example.test");
    vi.stubEnv("SMTP_USER", "sender@example.test");
    vi.stubEnv("SMTP_PASS", "test-only-password");
    mocks.sendMail.mockReset().mockResolvedValue({});
    mocks.sendGmail.mockReset().mockResolvedValue(true);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("welcomes an approved venue with current guest and manager features", async () => {
    await sendVenueApprovedEmail({
      to: "owner@example.test",
      businessName: "The Gallery",
      registrationUrl: "https://manager.example.test/register?token=test&source=email",
      registrationDeadline: new Date(2027, 1, 5),
    });

    const sent = mocks.sendMail.mock.calls[0]![0] as {
      subject: string;
      html: string;
      text: string;
    };
    expect(sent.subject).toContain("The Gallery");
    expect(sent.html).toContain("Complete registration by");
    expect(sent.html).toContain("February 5, 2027");
    expect(sent.html).toContain('href="https://manager.example.test/register?token=test&amp;source=email"');
    expect(sent.text).toContain("https://manager.example.test/register?token=test&source=email");
    expect(sent.text).toContain("Complete registration by February 5, 2027.");
    expect(sent.html).toContain("venue page");
    expect(sent.html).toContain("visit notes and photos");
    expect(sent.html).toContain("Gold, Silver, or Bronze trophies");
    expect(sent.html).toContain("manage multiple venues");
    expect(sent.html).toContain("https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926");
    expect(sent.html).toContain("https://play.google.com/store/apps/details?id=app.met.founders");
    expect(sent.text).toContain("venue page");
    expect(sent.text).toContain("visit notes and photos");
    expect(sent.text).toContain("Gold, Silver, or Bronze trophies");
    expect(sent.text).toContain("manage multiple venues");
    expect(sent.text).toContain("https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926");
    expect(sent.text).toContain("https://play.google.com/store/apps/details?id=app.met.founders");
  });

  it("returns Gmail message and thread IDs for venue contact requests", async () => {
    mocks.sendGmail.mockResolvedValueOnce({
      rfcMessageId: "contact-request@example.test",
      gmailThreadId: "gmail-thread-123",
    });

    await expect(sendVenueContactRequestEmail({
      to: "owner@example.test",
      businessName: "The Gallery",
    })).resolves.toEqual({
      rfcMessageId: "contact-request@example.test",
      gmailThreadId: "gmail-thread-123",
    });
  });

  it("refreshes registration reminders without losing the deadline and activation requirements", async () => {
    await sendVenueRegistrationReminderEmail({
      to: "owner@example.test",
      day: 5,
      registrationUrl: "https://manager.example.test/register?token=test&source=email",
      businessName: "The Gallery",
      registrationDeadline: new Date(2027, 1, 5),
      preview: { tagline: null, description: null, coverPhotoUrl: null },
    });

    const sent = mocks.sendGmail.mock.calls[0]![0] as {
      subject: string;
      html: string;
      text: string;
    };
    expect(sent.subject).toContain("The Gallery");
    expect(sent.html).toContain("day 5 reminder");
    expect(sent.html).toContain("February 5, 2027");
    expect(sent.html).toContain('href="https://manager.example.test/register?token=test&amp;source=email"');
    expect(sent.text).toContain("day 5 reminder");
    expect(sent.text).toContain("February 5, 2027");
    expect(sent.text).toContain("https://manager.example.test/register?token=test&source=email");
    expect(sent.html).toContain("finish setting up");
    expect(sent.html).toContain("guestbook");
    expect(sent.html).toContain("10 genuine guest check-ins verified by its Met QR code");
    expect(sent.html).toContain("may be delisted");
    expect(sent.html).toContain("https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926");
    expect(sent.html).toContain("https://play.google.com/store/apps/details?id=app.met.founders");
    expect(sent.text).toContain("finish setting up");
    expect(sent.text).toContain("guestbook");
    expect(sent.text).toContain("10 genuine guest check-ins verified by its Met QR code");
    expect(sent.text).toContain("may be delisted");
    expect(sent.text).toContain("30 days");
    expect(sent.text).toContain("delisting is reversible by contacting support");
    expect(sent.text).toContain("https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926");
    expect(sent.text).toContain("https://play.google.com/store/apps/details?id=app.met.founders");
  });

  it("sends overdue claim alerts with matching text and HTML venue details", async () => {
    await sendClaimLinkOverdueAlertEmail({
      to: "ops@example.test",
      venues: [
        {
          id: 42,
          businessName: "The Gallery",
          placeName: "Downtown",
          agentId: 17,
          approvedAt: new Date(2027, 1, 5),
        },
        {
          id: 43,
          businessName: "Northside Cafe",
          placeName: "Northside",
          agentId: 18,
          approvedAt: new Date(2027, 1, 6),
        },
      ],
    });

    const sent = mocks.sendMail.mock.calls[0]![0] as {
      subject: string;
      html: string;
      text: string;
    };
    for (const value of [
      "#42",
      "The Gallery",
      "Downtown",
      "#17",
      "Feb 5, 2027",
      "never had a claim link sent",
      "follow up with the assigned agent",
      "more than 3 days",
      "in 7 days",
      "#43",
      "Northside Cafe",
      "Northside",
      "#18",
      "Feb 6, 2027",
    ]) {
      expect(sent.html).toContain(value);
      expect(sent.text).toContain(value);
    }
    expect(sent.subject).toContain("2 venues awaiting claim link");
  });

  it("sends venue removal alerts with matching text and HTML details and follow-up", async () => {
    await sendAdminVenueRemovalRequestEmail({
      to: "ops@example.test",
      businessName: "The Gallery",
      reason: "Moving to a new location",
      managerId: 17,
      businessId: 42,
    });

    const sent = mocks.sendMail.mock.calls[0]![0] as {
      subject: string;
      html: string;
      text: string;
    };
    for (const value of [
      "The Gallery",
      "removal request",
      "#42",
      "#17",
      "Moving to a new location",
      "admin dashboard",
      "2–3 business days",
    ]) {
      expect(sent.html).toContain(value);
      expect(sent.text).toContain(value);
    }
    expect(sent.subject).toContain("Venue removal requested");
  });

  it("uses the same no-reason status in both venue removal alert formats", async () => {
    await sendAdminVenueRemovalRequestEmail({
      to: "ops@example.test",
      businessName: "The Gallery",
      reason: null,
      managerId: 17,
      businessId: 42,
    });

    const sent = mocks.sendMail.mock.calls[0]![0] as { html: string; text: string };
    expect(sent.html).toContain("No reason provided");
    expect(sent.text).toContain("Reason: No reason provided");
  });
});
