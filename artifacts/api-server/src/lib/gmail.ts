import { ReplitConnectors } from "@replit/connectors-sdk";
import nodemailer, { type SendMailOptions } from "nodemailer";
import { GmailSendError } from "./gmailDeliveryStatus.js";

function validEmailAddress(address: string): boolean {
  return /^[^\s<>@]+@[^\s<>@]+$/.test(address);
}

function gmailError(status: number, beforeSubmission = false): GmailSendError {
  const code = status === 401 || status === 403 ? "GMAIL_AUTH" : "GMAIL_DELIVERY";
  const rejected = status >= 400 && status < 500 && status !== 408;
  return new GmailSendError(
    `Gmail request failed with status ${status}`,
    code,
    beforeSubmission || rejected ? "failed" : "delivery_uncertain",
    status,
  );
}

/** Build MIME locally, then send through the connected Gmail account. Never fall back to
 * SMTP after a Gmail send error: a timeout could otherwise deliver the same email twice. */
export async function sendGmailHtmlEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: SendMailOptions["attachments"];
}): Promise<{ rfcMessageId: string | null; gmailThreadId: string | null }> {
  if (!validEmailAddress(opts.to)) {
    throw new GmailSendError("Invalid recipient email address", "GMAIL_DELIVERY", "failed");
  }

  // Everything before messages/send is a definite failure: nothing was submitted.
  let connectors: ReplitConnectors;
  let raw: Buffer;
  try {
    connectors = new ReplitConnectors();
    const profileResponse = await connectors.proxy("google-mail", "/gmail/v1/users/me/profile");
    if (!profileResponse.ok) throw gmailError(profileResponse.status, true);
    const profile = (await profileResponse.json()) as { emailAddress?: string };
    if (!profile.emailAddress || !validEmailAddress(profile.emailAddress)) {
      throw new Error("Connected Gmail account did not provide a valid sender address");
    }

    const mail = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail({
      from: `"Met Venues" <${profile.emailAddress}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: opts.attachments,
    });
    const message = (mail as { message?: Buffer }).message;
    if (!Buffer.isBuffer(message)) throw new Error("Could not prepare Gmail message");
    raw = message;
  } catch (error) {
    if (error instanceof GmailSendError) throw error;
    throw new GmailSendError("Could not prepare Gmail message. No email was sent.", "GMAIL_DELIVERY", "failed");
  }

  const sendResponse = await connectors.proxy("google-mail", "/gmail/v1/users/me/messages/send", {
    method: "POST",
    body: { raw: raw.toString("base64url") },
  });
  if (!sendResponse.ok) throw gmailError(sendResponse.status);
  const rfcMessageId = raw.toString("utf8").match(/^Message-ID:\s*<?([^>\r\n]+)>?/im)?.[1]?.trim() ?? null;
  let gmailThreadId: string | null = null;
  try {
    const result = await sendResponse.json() as { threadId?: unknown };
    if (typeof result.threadId === "string" && result.threadId.length > 0) {
      gmailThreadId = result.threadId;
    }
  } catch {
    // A successful Gmail send stays successful even if its optional metadata
    // cannot be decoded; the next reply sync can still resolve the RFC ID.
  }
  return { rfcMessageId, gmailThreadId };
}

/** Create an unsent Gmail draft. This deliberately never calls messages/send. */
export async function createGmailHtmlDraft(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: SendMailOptions["attachments"];
  headers?: SendMailOptions["headers"];
}): Promise<{ draftId: string; messageId: string | null }> {
  if (!validEmailAddress(opts.to)) {
    throw new GmailSendError("Invalid recipient email address", "GMAIL_DELIVERY", "failed");
  }

  let connectors: ReplitConnectors;
  let raw: Buffer;
  try {
    connectors = new ReplitConnectors();
    const profileResponse = await connectors.proxy("google-mail", "/gmail/v1/users/me/profile");
    if (!profileResponse.ok) throw gmailError(profileResponse.status, true);
    const profile = (await profileResponse.json()) as { emailAddress?: string };
    if (!profile.emailAddress || !validEmailAddress(profile.emailAddress)) {
      throw new Error("Connected Gmail account did not provide a valid sender address");
    }

    const mail = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail({
      from: `"Met Venues" <${profile.emailAddress}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: opts.attachments,
      headers: opts.headers,
    });
    const message = (mail as { message?: Buffer }).message;
    if (!Buffer.isBuffer(message)) throw new Error("Could not prepare Gmail message");
    raw = message;
  } catch (error) {
    if (error instanceof GmailSendError) throw error;
    throw new GmailSendError("Could not prepare Gmail draft. No draft was created.", "GMAIL_DELIVERY", "failed");
  }

  let draftResponse: Response;
  try {
    draftResponse = await connectors.proxy("google-mail", "/gmail/v1/users/me/drafts", {
      method: "POST",
      body: { message: { raw: raw.toString("base64url") } },
    });
  } catch {
    throw new GmailSendError(
      "Gmail draft creation outcome is uncertain. Check Gmail Drafts before retrying.",
      "GMAIL_DELIVERY",
      "delivery_uncertain",
    );
  }
  if (!draftResponse.ok) throw gmailError(draftResponse.status);

  let result: { id?: unknown; message?: { id?: unknown } };
  try {
    result = await draftResponse.json() as { id?: unknown; message?: { id?: unknown } };
  } catch {
    throw new GmailSendError(
      "Gmail accepted the draft request but returned unreadable metadata.",
      "GMAIL_DELIVERY",
      "delivery_uncertain",
      draftResponse.status,
    );
  }
  if (typeof result.id !== "string" || result.id.length === 0) {
    throw new GmailSendError(
      "Gmail accepted the draft request without returning a draft ID.",
      "GMAIL_DELIVERY",
      "delivery_uncertain",
      draftResponse.status,
    );
  }
  return {
    draftId: result.id,
    messageId: typeof result.message?.id === "string" ? result.message.id : null,
  };
}