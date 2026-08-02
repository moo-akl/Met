/**
 * Transactional email helpers for the Met Venue Owner portal.
 *
 * Sending requires these environment variables to be set:
 *   SMTP_HOST    — e.g. "smtp.gmail.com"
 *   SMTP_PORT    — defaults to 587
 *   SMTP_USER    — SMTP username / account address
 *   SMTP_PASS    — SMTP password / app-password
 *   SMTP_FROM    — "From" header, e.g. '"Met Venues" <venues@example.com>'
 *                  defaults to SMTP_USER if absent
 *
 * When any required variable is missing the helpers log a warning and return
 * without throwing so that missing SMTP config never breaks the API endpoint.
 */

import nodemailer from "nodemailer";
import { logger } from "./logger.js";

const CONTACT_EMAIL = "metapp.contact@gmail.com";

function createTransport() {
  const host = process.env["SMTP_HOST"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env["SMTP_PORT"] ?? "587"),
    secure: process.env["SMTP_SECURE"] === "true",
    auth: { user, pass },
  });
}

function getFrom(): string {
  return (
    process.env["SMTP_FROM"] ??
    process.env["SMTP_USER"] ??
    `"Met Venues" <${CONTACT_EMAIL}>`
  );
}

// ---------------------------------------------------------------------------
// HTML template helpers
// ---------------------------------------------------------------------------

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f6f6f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #333; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
    .header { background: #111; padding: 28px 32px; }
    .header h1 { margin: 0; color: #fff; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
    .body { padding: 32px; }
    .body p { margin: 0 0 16px; line-height: 1.6; font-size: 15px; }
    .cta { display: inline-block; margin: 8px 0 24px; padding: 12px 24px; background: #111; color: #fff !important; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600; }
    .footer { padding: 20px 32px; border-top: 1px solid #eee; font-size: 13px; color: #888; }
    .footer a { color: #555; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>Met Venues</h1></div>
    <div class="body">${bodyHtml}</div>
    <div class="footer">
      Questions? Email us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export interface ApprovedEmailOptions {
  to: string;
  businessName: string;
  /** Full registration URL the venue owner should use to create their account. */
  registrationUrl: string | null;
}

export async function sendVenueApprovedEmail(opts: ApprovedEmailOptions): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    logger.warn({ to: opts.to }, "SMTP not configured — skipping approved email");
    return;
  }

  const subject = `🎉 Your venue "${opts.businessName}" has been approved`;

  const registrationSection = opts.registrationUrl
    ? `<p>To set up your venue manager account and start posting events and rewards, use your one-time registration link below. It expires in 7 days.</p>
       <a class="cta" href="${escapeAttr(opts.registrationUrl)}">Set up your account →</a>`
    : `<p>Our team will be in touch shortly with your account setup link.</p>`;

  const html = layout(subject, `
    <p>Hi there,</p>
    <p>Great news — your application to list <strong>${escapeHtml(opts.businessName)}</strong> on Met has been approved!</p>
    ${registrationSection}
    <p>Once you're set up you can create events, publish rewards, and post announcements that appear directly to Met users nearby.</p>
    <p>Welcome to the Met Venues community!</p>
  `);

  await transport.sendMail({ from: getFrom(), to: opts.to, subject, html });
  logger.info({ to: opts.to, businessName: opts.businessName }, "Sent venue approved email");
}

export interface RejectedEmailOptions {
  to: string;
  businessName: string;
  reason: string;
}

export async function sendVenueRejectedEmail(opts: RejectedEmailOptions): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    logger.warn({ to: opts.to }, "SMTP not configured — skipping rejected email");
    return;
  }

  const subject = `Update on your venue application for "${opts.businessName}"`;

  const html = layout(subject, `
    <p>Hi there,</p>
    <p>Thank you for applying to list <strong>${escapeHtml(opts.businessName)}</strong> on Met. After reviewing your submission, we're unable to approve the application at this time.</p>
    <p><strong>Reason:</strong> ${escapeHtml(opts.reason)}</p>
    <p>If you believe this decision was made in error, or if you'd like to discuss next steps, please reach out to us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
    <p>Thank you for your interest in Met Venues.</p>
  `);

  await transport.sendMail({ from: getFrom(), to: opts.to, subject, html });
  logger.info({ to: opts.to, businessName: opts.businessName }, "Sent venue rejected email");
}

export interface ChangesRequestedEmailOptions {
  to: string;
  businessName: string;
  notes: string;
}

export async function sendVenueChangesRequestedEmail(opts: ChangesRequestedEmailOptions): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    logger.warn({ to: opts.to }, "SMTP not configured — skipping changes-requested email");
    return;
  }

  const subject = `Action needed: changes requested for your venue application`;

  const html = layout(subject, `
    <p>Hi there,</p>
    <p>We've reviewed your application for <strong>${escapeHtml(opts.businessName)}</strong> and need a few changes before we can approve it.</p>
    <p><strong>What to update:</strong> ${escapeHtml(opts.notes)}</p>
    <p>Your venue is still reserved for you — simply update your application and resubmit when you're ready. If you have questions about what's needed, email us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
  `);

  await transport.sendMail({ from: getFrom(), to: opts.to, subject, html });
  logger.info({ to: opts.to, businessName: opts.businessName }, "Sent venue changes-requested email");
}

// ---------------------------------------------------------------------------
// Escape helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text: string): string {
  return text.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
