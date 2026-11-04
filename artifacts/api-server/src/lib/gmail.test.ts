import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ proxy: vi.fn() }));

vi.mock("@replit/connectors-sdk", () => ({
  ReplitConnectors: class {
    proxy = mocks.proxy;
  },
}));

import { createGmailHtmlDraft, sendGmailHtmlEmail } from "./gmail.js";
import { gmailFailureStatus, GmailSendError } from "./gmailDeliveryStatus.js";

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
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "gmail-message-1", threadId: "gmail-thread-1" }),
      });

    const result = await sendGmailHtmlEmail({
      to: "owner@example.com",
      subject: 'Your venue setup link',
      html: "<p>Open your registration link</p>",
    });

    expect(result.gmailThreadId).toBe("gmail-thread-1");
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

  it.each([400, 401, 403, 429])("makes an explicit HTTP %s rejection eligible for cleanup", async (status) => {
    mocks.proxy.mockResolvedValueOnce({ ok: true, json: async () => ({ emailAddress: "sender@example.com" }) })
      .mockResolvedValueOnce({ ok: false, status });
    await expect(sendGmailHtmlEmail({ to: "owner@example.com", subject: "Setup", html: "Link" }))
      .rejects.toMatchObject({ deliveryStatus: "failed", httpStatus: status });
  });

  it("marks a profile lookup failure as failed because no send was submitted", async () => {
    mocks.proxy.mockRejectedValueOnce(new Error("timeout"));
    await expect(sendGmailHtmlEmail({ to: "owner@example.com", subject: "Setup", html: "Link" }))
      .rejects.toMatchObject({ deliveryStatus: "failed" });
    expect(mocks.proxy).toHaveBeenCalledTimes(1);
  });

  it.each([408, 500, 503])("preserves uncertainty after a send HTTP %s response", async (status) => {
    mocks.proxy.mockResolvedValueOnce({ ok: true, json: async () => ({ emailAddress: "sender@example.com" }) })
      .mockResolvedValueOnce({ ok: false, status });
    await expect(sendGmailHtmlEmail({ to: "owner@example.com", subject: "Setup", html: "Link" }))
      .rejects.toMatchObject({ deliveryStatus: "delivery_uncertain", httpStatus: status });
  });

  it("never assumes that a lost send response means failure", async () => {
    mocks.proxy.mockResolvedValueOnce({ ok: true, json: async () => ({ emailAddress: "sender@example.com" }) })
      .mockRejectedValueOnce(new Error("connection lost"));
    const error = await sendGmailHtmlEmail({ to: "owner@example.com", subject: "Setup", html: "Link" })
      .catch((error: unknown) => error);
    expect(gmailFailureStatus(error)).toBe("delivery_uncertain");
  });

  it("classifies only known failures, not arbitrary error objects", () => {
    expect(gmailFailureStatus(new GmailSendError("Not submitted", "GMAIL_DELIVERY", "failed"))).toBe("failed");
    expect(gmailFailureStatus(Object.assign(new Error("Auth"), { code: "GMAIL_AUTH" }))).toBe("failed");
    expect(gmailFailureStatus({ deliveryStatus: "failed" })).toBe("delivery_uncertain");
    expect(gmailFailureStatus(new Error("timeout"))).toBe("delivery_uncertain");
  });
});

describe("createGmailHtmlDraft", () => {
  beforeEach(() => {
    mocks.proxy.mockReset();
  });

  it("creates an unsent Gmail draft with the matching PDF and operation marker", async () => {
    mocks.proxy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ emailAddress: "sender@example.com" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "gmail-draft-1", message: { id: "gmail-message-1" } }),
      });
    const pdfBytes = Buffer.from("%PDF-1.7\nvenue-intro-test");

    const result = await createGmailHtmlDraft({
      to: "owner@example.com",
      subject: "An invitation to manage Bestiari on Met",
      html: "<p>Private registration link</p>",
      text: "Private registration link",
      headers: { "X-Met-Venue-Registration-Draft-Operation": "operation-123" },
      attachments: [{
        filename: "Met - Bestiari - Venue Introduction.pdf",
        content: pdfBytes,
        contentType: "application/pdf",
      }],
    });

    expect(result).toEqual({ draftId: "gmail-draft-1", messageId: "gmail-message-1" });
    expect(mocks.proxy).toHaveBeenCalledTimes(2);
    const [, path, options] = mocks.proxy.mock.calls[1]!;
    expect(path).toBe("/gmail/v1/users/me/drafts");
    expect(options.method).toBe("POST");
    const mime = Buffer.from(options.body.message.raw, "base64url").toString("latin1");
    expect(mime).toMatch(/X-Met-Venue-Registration-Draft-Operation:\s*operation-123/i);
    const unfoldedMime = mime.replace(/\r?\n[ \t]+/g, " ");
    expect(unfoldedMime).toContain("Met - Bestiari - Venue Introduction.pdf");
    expect(mime).toContain(pdfBytes.toString("base64"));
    expect(mocks.proxy.mock.calls.some((call) => String(call[1]).includes("/messages/send"))).toBe(false);
  });

  it.each([408, 500, 503])("keeps draft creation uncertain after HTTP %s", async (status) => {
    mocks.proxy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ emailAddress: "sender@example.com" }),
      })
      .mockResolvedValueOnce({ ok: false, status });

    await expect(createGmailHtmlDraft({
      to: "owner@example.com",
      subject: "Setup",
      html: "Link",
    })).rejects.toMatchObject({ deliveryStatus: "delivery_uncertain", httpStatus: status });
  });
});