import { ReplitConnectors } from "@replit/connectors-sdk";
import nodemailer from "nodemailer";

function validEmailAddress(address: string): boolean {
  return /^[^\s<>@]+@[^\s<>@]+$/.test(address);
}

function gmailError(status: number): Error & { code: string } {
  const code = status === 401 || status === 403 ? "GMAIL_AUTH" : "GMAIL_DELIVERY";
  return Object.assign(new Error(`Gmail request failed with status ${status}`), { code });
}

/** Build MIME locally, then send through the connected Gmail account. Never fall back to
 * SMTP after a Gmail send error: a timeout could otherwise deliver the same email twice. */
export async function sendGmailHtmlEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  if (!validEmailAddress(opts.to)) throw new Error("Invalid recipient email address");

  const connectors = new ReplitConnectors();
  const profileResponse = await connectors.proxy("google-mail", "/gmail/v1/users/me/profile");
  if (!profileResponse.ok) throw gmailError(profileResponse.status);
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
  });
  const raw = (mail as { message?: Buffer }).message;
  if (!Buffer.isBuffer(raw)) throw new Error("Could not prepare Gmail message");

  const sendResponse = await connectors.proxy("google-mail", "/gmail/v1/users/me/messages/send", {
    method: "POST",
    body: { raw: raw.toString("base64url") },
  });
  if (!sendResponse.ok) throw gmailError(sendResponse.status);
}