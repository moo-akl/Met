import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ proxy: vi.fn() }));

vi.mock("@replit/connectors-sdk", () => ({
  ReplitConnectors: class {
    proxy = mocks.proxy;
  },
}));

import { sendGmailHtmlEmail } from "./gmail.js";

describe("sendGmailHtmlEmail", () => {
  beforeEach(() => {
    mocks.proxy.mockReset();
  });

  it("sends a MIME message using the connected Gmail account", async () => {
    mocks.proxy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ emailAddress: "sender@example.com" }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    await sendGmailHtmlEmail({
      to: "owner@example.com",
      subject: 'Your venue setup link',
      html: "<p>Open your registration link</p>",
    });

    expect(mocks.proxy).toHaveBeenCalledTimes(2);
    const [name, path, options] = mocks.proxy.mock.calls[1]!;
    expect(name).toBe("google-mail");
    expect(path).toBe("/gmail/v1/users/me/messages/send");
    expect(options.method).toBe("POST");
    const mime = Buffer.from(options.body.raw, "base64url").toString("utf8");
    expect(mime).toContain("From: Met Venues <sender@example.com>");
    expect(mime).toContain("To: owner@example.com");
    expect(mime).toContain("Subject: Your venue setup link");
  });

  it("preserves a Check In poster PDF attachment in the Gmail MIME message", async () => {
    mocks.proxy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ emailAddress: "sender@example.com" }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const pdfBytes = Buffer.from("%PDF-1.7\nposter-pack-test");

    await sendGmailHtmlEmail({
      to: "owner@example.com",
      subject: "Great news for our venue managers.",
      html: '<a href="https://met-app.org/venue-manager">Open Venue Manager</a>',
      text: "Sign in to Venue Manager: https://met-app.org/venue-manager",
      attachments: [{
        filename: "met-check-in-qr-posters.pdf",
        content: pdfBytes,
        contentType: "application/pdf",
      }],
    });

    const [, , options] = mocks.proxy.mock.calls[1]!;
    const mime = Buffer.from(options.body.raw, "base64url").toString("latin1");
    expect(mime).toContain("Content-Type: application/pdf; name=met-check-in-qr-posters.pdf");
    expect(mime).toContain("Content-Disposition: attachment; filename=met-check-in-qr-posters.pdf");
    expect(mime).toContain(pdfBytes.toString("base64"));
    expect(mime).toContain("https://met-app.org/venue-manager");
  });

  it("reports a disconnected Gmail account instead of claiming delivery", async () => {
    mocks.proxy.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(sendGmailHtmlEmail({
      to: "owner@example.com",
      subject: "Setup",
      html: "Link",
    })).rejects.toMatchObject({ code: "GMAIL_AUTH" });
    expect(mocks.proxy).toHaveBeenCalledTimes(1);
  });

  it("does not retry through SMTP when Gmail rejects the send", async () => {
    mocks.proxy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ emailAddress: "sender@example.com" }),
      })
      .mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(sendGmailHtmlEmail({
      to: "owner@example.com",
      subject: "Setup",
      html: "Link",
    })).rejects.toMatchObject({ code: "GMAIL_DELIVERY" });
    expect(mocks.proxy).toHaveBeenCalledTimes(2);
  });
});