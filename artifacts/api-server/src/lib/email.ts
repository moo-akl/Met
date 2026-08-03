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
const VENUE_MANAGER_URL = process.env["VENUE_MANAGER_BASE_URL"]?.replace(/\/$/, "") ?? "https://met-app.org/venue-manager";

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

export interface RegistrationLinkEmailOptions {
  to: string;
  businessName: string;
  registrationUrl: string;
  expiresAt: Date;
}

/**
 * Sends a step-by-step Venue Manager setup email containing a one-time
 * registration link. Returns true if the email was dispatched, false if
 * SMTP is not configured (so the caller can fall back gracefully).
 */
export async function sendRegistrationLinkEmail(
  opts: RegistrationLinkEmailOptions,
): Promise<boolean> {
  const transport = createTransport();
  if (!transport) {
    logger.warn({ to: opts.to }, "SMTP not configured — skipping registration link email");
    return false;
  }

  const expiry = opts.expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const subject = `Your Venue Manager setup link for "${opts.businessName}"`;

  const html = layout(subject, `
    <p>Hi there,</p>
    <p>Your registration link for <strong>${escapeHtml(opts.businessName)}</strong> on Venue Manager is ready.
       Follow the steps below to get set up — it only takes a minute.</p>

    <p><strong>Step 1 — Open your setup page</strong><br>
    Click the button below. This is a one-time link that expires on <strong>${escapeHtml(expiry)}</strong>.</p>
    <a class="cta" href="${escapeAttr(opts.registrationUrl)}">Set up your Venue Manager account &rarr;</a>

    <p><strong>Step 2 — Create your business account</strong><br>
    Enter your email address, your name, and choose a strong password.
    This is a <em>separate</em> account from your personal Met profile — use a business
    email if you have one.</p>

    <p><strong>Step 3 — Sign in any time</strong><br>
    Once registered, bookmark
    <a href="${escapeAttr(VENUE_MANAGER_URL)}">met-app.org/venue-manager</a>
    and sign in with your email and password whenever you need to manage your venue.</p>

    <p><strong>What you can do in Venue Manager</strong></p>
    <ul style="margin:0 0 16px;padding-left:20px;line-height:1.9;font-size:15px;">
      <li>Post and manage <strong>events</strong> that appear to nearby Met users</li>
      <li>Publish <strong>rewards</strong> guests can claim at your venue</li>
      <li>Send <strong>announcements</strong> straight to your followers</li>
      <li>Edit your venue profile, opening hours, and contact info</li>
      <li>Invite <strong>team members</strong> (managers and editors) to help run your page</li>
    </ul>

    <p style="font-size:13px;color:#888;">
      If you did not expect this email, you can safely ignore it.
      If the link has expired, reach out and we will send a fresh one.
    </p>
  `);

  await transport.sendMail({ from: getFrom(), to: opts.to, subject, html });
  logger.info({ to: opts.to, businessName: opts.businessName }, "Sent registration link email");
  return true;
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
