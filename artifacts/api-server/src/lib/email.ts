/**
 * Transactional email helpers for the Met Venue Owner portal.
 *
 * Registration links use the connected Gmail account. Other venue emails
 * still use SMTP and require these environment variables:
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
import { sendGmailHtmlEmail } from "./gmail.js";
import { logger } from "./logger.js";
import { buildVenueContactRequestEmail, buildVenueOutreachEmail, buildVenueRegistrationInviteEmail, type OutreachTemplateId } from "./venueOutreachEmail.js";

const CONTACT_EMAIL = "metapp.contact@gmail.com";
const VENUE_MANAGER_URL = process.env["VENUE_MANAGER_BASE_URL"]?.replace(/\/$/, "") ?? "https://met-app.org/venue-manager";
const VENUE_MANAGER_TERMS_URL = "https://met-app.org/venue-manager-terms";
const VENUE_MANAGER_PRIVACY_URL = "https://met-app.org/venue-manager-privacy";

function createTransport() {
  const host = process.env["SMTP_HOST"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env["SMTP_PORT"] ?? "587"),
    secure: process.env["SMTP_SECURE"] === "true",
    // Google displays app passwords in groups separated by spaces; SMTP uses the 16 characters without them.
    auth: { user, pass: host.toLowerCase() === "smtp.gmail.com" ? pass.replace(/\s/g, "") : pass },
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
  <title>${escapeHtml(title)}</title>
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
  /** Optional, caller-calculated deadline for completing registration. */
  registrationDeadline?: Date;
}

export async function sendVenueApprovedEmail(opts: ApprovedEmailOptions): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    logger.warn({ to: opts.to }, "SMTP not configured — skipping approved email");
    return;
  }

  const subject = `🎉 Your venue "${opts.businessName}" has been approved`;

  const registrationDeadlineText = opts.registrationDeadline
    ? ` Complete registration by <strong>${escapeHtml(formatEmailDate(opts.registrationDeadline))}</strong>.`
    : "";
  const registrationSection = opts.registrationUrl
    ? `<p>To set up your venue manager account and start posting events and rewards, use your one-time registration link below.${registrationDeadlineText}</p>
       <a class="cta" href="${escapeAttr(safeEmailLinkUrl(opts.registrationUrl))}">Set up your account →</a>`
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
  coverPhotoUrl?: string | null;
  includeAppIntro?: boolean;
  /** Fixed 14-day completion deadline calculated by the caller, when available. */
  registrationDeadline?: Date;
}

export function getMetAppIntroVideoAssets(): { videoUrl: string; posterUrl: string } {
  const managerUrl = new URL(VENUE_MANAGER_URL);
  if (managerUrl.protocol !== "https:" || managerUrl.username || managerUrl.password) {
    throw new Error("A secure Venue Manager base URL is required for the app introduction video.");
  }
  return {
    videoUrl: new URL("/venue-admin/media/met-app-intro.mp4", managerUrl.origin).href,
    posterUrl: new URL("/venue-admin/media/met-app-intro-poster.jpg", managerUrl.origin).href,
  };
}

export function getVenueManagerBaseUrl(): string {
  return VENUE_MANAGER_URL;
}

export async function sendVenueContactRequestEmail(opts: {
  to: string;
  businessName: string;
  coverPhotoUrl?: string | null;
}): Promise<void> {
  const email = buildVenueContactRequestEmail(opts);
  await sendGmailHtmlEmail({ to: opts.to, ...email });
  logger.info({ to: opts.to, businessName: opts.businessName }, "Sent venue management contact request");
}

export async function sendNewVenueOutreachEmail(opts: {
  to: string;
  businessName: string;
  template: OutreachTemplateId;
  applicationUrl?: string;
  applicationExpiresAt?: Date;
}): Promise<void> {
  const email = buildVenueOutreachEmail({
    ...opts,
    ...(opts.template === "preapproval_video_application"
      ? { appIntroVideo: getMetAppIntroVideoAssets() }
      : {}),
  });
  await sendGmailHtmlEmail({ to: opts.to, ...email });
  logger.info({ businessName: opts.businessName, template: opts.template }, "Sent new venue outreach");
}

/**
 * Sends a step-by-step Venue Manager setup email containing a one-time
 * registration link through the connected Gmail account.
 * Throws if Gmail cannot accept the message, so callers never report a send
 * when the connection is unavailable.
 */
export async function sendRegistrationLinkEmail(
  opts: RegistrationLinkEmailOptions,
): Promise<boolean> {
  const { includeAppIntro = false, ...emailOptions } = opts;
  const email = buildVenueRegistrationInviteEmail({
    ...emailOptions,
    ...(includeAppIntro ? { appIntroVideo: getMetAppIntroVideoAssets() } : {}),
  });
  await sendGmailHtmlEmail({ to: opts.to, ...email });
  logger.info({ to: opts.to, businessName: opts.businessName }, "Sent registration link email");
  return true;
}

export interface VenueRegistrationReminderEmailOptions {
  to: string;
  day: 5 | 10;
  manual?: boolean;
  registrationUrl: string;
  businessName: string;
  /** The registration completion deadline supplied by the caller. */
  registrationDeadline: Date;
  preview: {
    tagline: string | null;
    description: string | null;
    coverPhotoUrl: string | null;
  };
}

/**
 * Sends a day-5 or day-10 registration reminder with a safe, lightweight
 * preview of the venue's guest-facing public listing.
 */
export async function sendVenueRegistrationReminderEmail(
  opts: VenueRegistrationReminderEmailOptions,
): Promise<boolean> {
  const deadline = formatEmailDate(opts.registrationDeadline);
  const subject = `Reminder: finish setting up ${opts.businessName} on Met`;
  const imageUrl = opts.preview.coverPhotoUrl
    ? safeEmailImageUrl(opts.preview.coverPhotoUrl)
    : "";
  const image = imageUrl
    ? `<img src="${escapeAttr(imageUrl)}" alt="${escapeHtml(opts.businessName)}" style="display:block;width:100%;max-height:190px;object-fit:cover;border-radius:10px 10px 0 0" />`
    : "";
  const listingText = [
    opts.preview.tagline
      ? `<p style="margin:5px 0;color:#52645c;font-size:14px">${escapeHtml(opts.preview.tagline)}</p>`
      : "",
    opts.preview.description
      ? `<p style="margin:12px 0 0;color:#52645c;font-size:13px;line-height:1.5">${escapeHtml(opts.preview.description)}</p>`
      : "",
  ].join("");
  const listingPreview = `
    <div style="margin:20px 0;border:1px solid #e4ebe6;border-radius:11px;overflow:hidden;background:#fbfdfb">
      ${image}
      <div style="padding:16px 18px">
        <div style="font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:#718078">Guest-facing listing preview</div>
        <h2 style="margin:6px 0 0;font-size:20px;color:#183328">${escapeHtml(opts.businessName)}</h2>
        ${listingText || `<p style="margin:8px 0 0;color:#78877f;font-size:13px">Your venue details will appear here for Met guests.</p>`}
      </div>
    </div>
  `;
  const html = layout(subject, `
    <p>Hi there,</p>
    <p>${opts.manual ? "This is a reminder" : `This is your day ${opts.day} reminder`} to finish setting up <strong>${escapeHtml(opts.businessName)}</strong> on Venue Manager.</p>
    <p>Your registration deadline is <strong>${escapeHtml(deadline)}</strong>. The one-time setup link below will take you to the registration form.</p>
    <a class="cta" href="${escapeAttr(safeEmailLinkUrl(opts.registrationUrl))}">Finish registration &rarr;</a>
    ${listingPreview}
    <p>Once registered, your venue has 30 days to receive at least 10 genuine guest check-ins verified by its Met QR code. If the activation milestones are not met, the public listing may be delisted; delisting is reversible by contacting support.</p>
    <p style="font-size:13px;color:#777;">Review the <a href="${VENUE_MANAGER_TERMS_URL}">Venue Manager Terms</a> and <a href="${VENUE_MANAGER_PRIVACY_URL}">Venue Manager Privacy notice</a>.</p>
    <p style="font-size:13px;color:#888;">If you have already completed registration, you can ignore this reminder.</p>
  `);

  await sendGmailHtmlEmail({ to: opts.to, subject, html });
  logger.info({ to: opts.to, businessName: opts.businessName, day: opts.day }, "Sent venue registration reminder email");
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

export interface ClaimLinkOverdueAlertEmailOptions {
  to: string;
  venues: Array<{
    id: number;
    businessName: string;
    placeName: string;
    agentId: number;
    approvedAt: Date;
  }>;
}

/**
 * Sends an internal admin alert listing approved, agent-registered venues
 * whose owner claim link has never been sent. Intended for the ops / admin
 * inbox so someone can follow up before the owner gives up.
 */
export async function sendClaimLinkOverdueAlertEmail(
  opts: ClaimLinkOverdueAlertEmailOptions,
): Promise<boolean> {
  const transport = createTransport();
  if (!transport) {
    logger.warn({ to: opts.to }, "SMTP not configured — skipping claim-link overdue alert email");
    return false;
  }

  const subject = `[Met Admin] ${opts.venues.length} venue${opts.venues.length === 1 ? "" : "s"} awaiting claim link`;

  const rows = opts.venues
    .map(
      (v) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">#${v.id}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(v.businessName)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(v.placeName)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">Agent #${v.agentId}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${v.approvedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
        </tr>`,
    )
    .join("\n");

  const html = layout(subject, `
    <p>Hi team,</p>
    <p>The following approved, agent-registered venues have <strong>never had a claim link sent</strong> to the owner.
       Please follow up with the assigned agent so the owner can set up their account before they give up.</p>

    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 24px;">
      <thead>
        <tr style="background:#f4f4f4;">
          <th style="padding:8px 12px;text-align:left;font-weight:600;">ID</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;">Business</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;">Place</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;">Agent</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;">Approved on</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <p style="font-size:13px;color:#888;">
      This alert fires when a venue has been approved for more than 3 days with no registration link on record.
      A follow-up alert will be sent in 7 days if the link is still not sent.
    </p>
  `);

  await transport.sendMail({ from: getFrom(), to: opts.to, subject, html });
  logger.info(
    { to: opts.to, count: opts.venues.length },
    "Sent claim-link overdue alert email",
  );
  return true;
}

export interface VenueRemovalRequestEmailOptions {
  to: string;
  businessName: string;
  reason: string | null;
  managerId: number;
  businessId: number;
}

/**
 * Sends an internal admin alert when a venue owner submits a removal request
 * via the Venue Manager portal. Fires alongside the history-log insert so
 * the admin team is notified in real time even if they are not checking the
 * dashboard regularly.
 */
export async function sendAdminVenueRemovalRequestEmail(
  opts: VenueRemovalRequestEmailOptions,
): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    logger.warn({ businessName: opts.businessName }, "SMTP not configured — skipping venue removal request email");
    return;
  }

  const subject = `[Met Admin] Venue removal requested — ${opts.businessName}`;

  const html = layout(subject, `
    <p>Hi team,</p>
    <p>The owner of <strong>${escapeHtml(opts.businessName)}</strong> has submitted a
       <strong>removal request</strong> via the Venue Manager portal.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
      <tr><td style="padding:6px 12px;font-weight:600;width:140px;">Business ID</td><td style="padding:6px 12px;">#${opts.businessId}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:6px 12px;font-weight:600;">Manager ID</td><td style="padding:6px 12px;">#${opts.managerId}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:600;">Reason</td><td style="padding:6px 12px;">${opts.reason ? escapeHtml(opts.reason) : "<em>No reason provided</em>"}</td></tr>
    </table>
    <p>Please review the request in the admin dashboard and follow up with the venue within 2–3 business days.</p>
  `);

  await transport.sendMail({ from: getFrom(), to: opts.to, subject, html });
  logger.info({ businessName: opts.businessName }, "Sent admin venue removal request email");
}

// ---------------------------------------------------------------------------
// Escape helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text);
}

function safeEmailImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

function safeEmailLinkUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : "";
  } catch {
    return url.startsWith("/") ? url : "";
  }
}

function formatEmailDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
