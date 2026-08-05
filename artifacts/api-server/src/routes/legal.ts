import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, venueOwnerProfilesTable } from "@workspace/db";

// ---------------------------------------------------------------------------
// Output-encoding helpers
// ---------------------------------------------------------------------------

/**
 * Escapes the five characters that have special meaning in HTML text/attribute
 * contexts. Must be applied to every untrusted value before it is interpolated
 * into an HTML string.
 */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Returns the URL unchanged only when its scheme is http or https.
 * Any other scheme (javascript:, data:, etc.) is replaced with an empty
 * string so it cannot appear in src/href attributes.
 */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return url;
    }
  } catch {
    // Relative paths (e.g. /api/storage/…) are not parseable as absolute URLs;
    // they are safe as-is since we control the prefix we prepend.
    if (url.startsWith("/")) return url;
  }
  return "";
}

// Public, static-ish pages that satisfy Apple App Store + Google Play
// Store requirements for a Support URL and a Privacy Policy URL.
//
// The pages are intentionally rendered as inline HTML strings so they
// have zero build-step dependencies and are guaranteed to be served
// even when the rest of the API is in trouble.
//
// To change the contact email, edit `SUPPORT_EMAIL` below.

const SUPPORT_EMAIL = "metapp.contact@gmail.com";
const COMPANY_NAME = "Met";
const APP_NAME = "Met: We Crossed Paths";
const LAST_UPDATED = "April 28, 2026";

// Privacy policy is hosted externally so legal can edit it without a
// redeploy. The /privacy route on this server simply forwards there.
const PRIVACY_POLICY_URL =
  "https://doc-hosting.flycricket.io/met-privacy-policy/fdc825e1-4bde-43aa-9e6f-cd4b9860f90d/privacy";

const baseStyles = `
  :root {
    color-scheme: light;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, sans-serif;
    background: #F1F8F0;
    color: #1A2421;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  a { color: #2A9C30; text-decoration: none; }
  a:hover { text-decoration: underline; }
  header {
    background: #3DCC44;
    color: #fff;
    padding: 32px 24px;
    text-align: center;
  }
  header .brand {
    font-weight: 800;
    font-size: 28px;
    letter-spacing: -0.02em;
  }
  header .tag {
    margin-top: 6px;
    opacity: 0.92;
    font-size: 14px;
  }
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 32px 24px 96px;
  }
  h1 {
    font-size: 28px;
    margin: 0 0 8px;
    letter-spacing: -0.02em;
  }
  h2 {
    margin: 32px 0 8px;
    font-size: 18px;
    color: #1A2421;
  }
  p, li { font-size: 15px; }
  .card {
    background: #fff;
    border: 1px solid #E3EDE0;
    border-radius: 14px;
    padding: 20px 22px;
    margin-top: 16px;
  }
  .muted { color: #5C6B66; font-size: 13px; }
  footer {
    text-align: center;
    color: #5C6B66;
    font-size: 12px;
    padding: 24px 16px 40px;
  }
  ul { padding-left: 20px; }
  code {
    background: #EAF3E6;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
  }
`;

const layout = (title: string, body: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} — ${APP_NAME}</title>
    <meta name="robots" content="index,follow" />
    <style>${baseStyles}</style>
  </head>
  <body>
    <header>
      <div class="brand">${COMPANY_NAME}</div>
      <div class="tag">People you've crossed paths with</div>
    </header>
    <main>
      ${body}
    </main>
    <footer>
      &copy; ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.
      &nbsp;·&nbsp;
      <a href="/support">Support</a>
      &nbsp;·&nbsp;
      <a href="/privacy">Privacy</a>
    </footer>
  </body>
</html>`;

const supportHtml = layout(
  "Support",
  `
  <h1>Support</h1>
  <p class="muted">We read every message. Most replies go out within two business days.</p>

  <div class="card">
    <h2 style="margin-top:0">Contact us</h2>
    <p>Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> with your question, the device you're using, and (if it's a bug) what you were doing when it happened.</p>
  </div>

  <h2>Account &amp; sign in</h2>
  <p>You can sign in with Apple, Google, or an email and password. To delete your account, open Settings → Account → Delete account. This permanently removes your profile and all encounter history.</p>

  <h2>Subscriptions &amp; billing</h2>
  <p>${APP_NAME} is free to use. Met Plus and Met Pro are optional subscriptions billed by Apple (App Store) or Google (Play Store). To cancel:</p>
  <ul>
    <li><strong>iPhone</strong>: Settings → your name → Subscriptions → Met → Cancel.</li>
    <li><strong>Android</strong>: Play Store → your profile → Payments &amp; subscriptions → Subscriptions → Met → Cancel.</li>
  </ul>
  <p>Refund requests are handled by Apple and Google. We can't issue refunds directly, but we're happy to help you reach the right place.</p>

  <h2>Privacy &amp; safety</h2>
  <p>You're invisible until you choose to be seen. To change your visibility, open Settings → Discovery. To block someone, tap the three-dot menu on any encounter or connection and choose Block.</p>

  <h2>Reporting a problem</h2>
  <p>If you've encountered a profile that violates our terms (impersonation, harassment, inappropriate content), tap Report on that profile or email us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> with the details. We review every report within 24 hours.</p>

  <p class="muted" style="margin-top:32px">${APP_NAME} · Last updated ${LAST_UPDATED}</p>
  `,
);

const privacyHtml = layout(
  "Privacy Policy",
  `
  <h1>Privacy Policy</h1>
  <p class="muted">Last updated ${LAST_UPDATED}</p>

  <p>${COMPANY_NAME} is built around a simple principle: you're anonymous until you choose to be seen. This page explains what data we collect, why, and what you can do about it.</p>

  <h2>1. Who we are</h2>
  <p>${COMPANY_NAME} ("we", "us", "our") provides the ${APP_NAME} mobile application. You can reach us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>

  <h2>2. What we collect</h2>
  <ul>
    <li><strong>Account data</strong>: your email address (when you sign up with email), or a unique identifier from your Apple/Google account if you use those sign-in options.</li>
    <li><strong>Profile data</strong>: the name, bio, photo, and social handles you choose to share. You decide what to put here.</li>
    <li><strong>Location data</strong>: your approximate and precise location, used only to detect nearby encounters. We do not store a continuous history of your location.</li>
    <li><strong>Encounter data</strong>: anonymous records of when and (approximately) where you crossed paths with other ${COMPANY_NAME} users. These are visible only to you and the other party (after mutual reveal).</li>
    <li><strong>Subscription data</strong>: if you subscribe to Met Plus or Met Pro, our payment partner (RevenueCat) records your subscription status and a device identifier so we can keep your subscription in sync across your devices.</li>
    <li><strong>Diagnostic data</strong>: basic crash and error reports so we can fix problems. These do not contain personal content.</li>
  </ul>

  <h2>3. What we don't do</h2>
  <ul>
    <li>We do not sell your data.</li>
    <li>We do not show you ads.</li>
    <li>We do not track you across other apps or websites.</li>
    <li>We do not broadcast your identity. Other users see "someone nearby" until you both choose to reveal yourselves.</li>
  </ul>

  <h2>4. Who we share data with</h2>
  <ul>
    <li><strong>Firebase (Google)</strong>: handles authentication and stores your account/profile data. Firebase's privacy practices: <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener">firebase.google.com/support/privacy</a>.</li>
    <li><strong>RevenueCat</strong>: handles subscription state. Their privacy notice: <a href="https://www.revenuecat.com/privacy" target="_blank" rel="noopener">revenuecat.com/privacy</a>.</li>
    <li><strong>Apple &amp; Google</strong>: process subscription payments and (if you choose to use them) sign-in.</li>
  </ul>
  <p>We do not share your data with anyone else.</p>

  <h2>5. How long we keep your data</h2>
  <p>We keep your account data for as long as your account exists. When you delete your account from inside the app (Settings → Account → Delete account), your profile, encounter history, and connections are permanently removed within 30 days.</p>

  <h2>6. Your rights</h2>
  <p>You can:</p>
  <ul>
    <li>Access or update your profile at any time inside the app.</li>
    <li>Delete your account at any time, from the app or by emailing us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</li>
    <li>Withdraw your location permission at any time from your device's Settings → ${COMPANY_NAME}.</li>
    <li>Request a copy of the data we hold about you by emailing <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</li>
  </ul>
  <p>Residents of the EU/EEA, UK, California, and other jurisdictions with data-protection laws have additional rights under their local laws (right to object, right to portability, right to lodge a complaint with a supervisory authority). Email us to exercise any of these.</p>

  <h2>7. Children</h2>
  <p>${COMPANY_NAME} is not intended for anyone under 17. We do not knowingly collect data from children under 13. If you believe a child has created an account, email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> and we will remove it.</p>

  <h2>8. Security</h2>
  <p>Your data is transmitted over HTTPS and stored in encrypted form by our service providers. No system is 100% secure, but we treat your data the way we would want our own treated.</p>

  <h2>9. International transfers</h2>
  <p>Our service providers (Firebase, RevenueCat) operate servers in multiple countries. Your data may be transferred to and processed in countries other than your own.</p>

  <h2>10. Changes to this policy</h2>
  <p>If we make material changes to this policy, we'll post the new version here and update the "Last updated" date at the top. For substantial changes we'll also notify you in the app.</p>

  <h2>11. Contact</h2>
  <p>Questions, requests, or concerns? Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
  `,
);

// Android App Links verification file.
// Google's Play Console verifies this JSON at:
//   https://<domain>/.well-known/assetlinks.json
// The SHA-256 fingerprint here must match the app signing key shown in
// Play Console → Setup → App integrity → App signing key certificate.
const assetLinks = JSON.stringify(
  [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "app.met.founders",
        sha256_cert_fingerprints: [
          "A0:FF:D9:D6:F1:6C:9F:C8:FB:72:7A:84:F6:3E:01:5B:FE:9F:B1:F1:83:A3:ED:0B:AC:00:55:23:5B:3F:42:59",
        ],
      },
    },
  ],
  null,
  2,
);

// iOS Universal Links verification file.
// Apple's servers fetch this at:
//   https://<domain>/.well-known/apple-app-site-association
// to confirm the app is allowed to claim the listed paths.
// Team ID + bundle identifier must match the values in eas.json / app.json.
const appleAppSiteAssociation = JSON.stringify(
  {
    applinks: {
      apps: [],
      details: [
        {
          appID: "AWHU9BTQQX.app.met.founders",
          paths: [
            // Referral links  e.g. /r/ABC123
            "/r/*",
            // Network invite links  e.g. /join/CODE1234
            "/join/*",
            // Venue-owner registration / dashboard entry point
            "/venue-owner",
            "/venue-owner/*",
            // Venue QR check-in links  e.g. /v/ChIJxxx?t=<uuid>
            "/v/*",
          ],
        },
      ],
    },
  },
  null,
  2,
);

const router: IRouter = Router();

// Serve without a file extension too — both variants are required.  Apple's
// crawler requests the no-extension form; some older tools use the .json form.
router.get(
  [
    "/.well-known/apple-app-site-association",
    "/.well-known/apple-app-site-association.json",
  ],
  (_req: Request, res: Response) => {
    res
      .status(200)
      .type("application/json")
      .set("Cache-Control", "public, max-age=3600")
      .send(appleAppSiteAssociation);
  },
);

router.get("/.well-known/assetlinks.json", (_req: Request, res: Response) => {
  res
    .status(200)
    .type("application/json")
    .set("Cache-Control", "public, max-age=3600")
    .send(assetLinks);
});

// Venue QR check-in landing page.
//
// Primary path: a device with Met installed is intercepted by the OS via
// Universal Links (iOS) / App Links (Android) before this page ever loads —
// the app opens directly at the QR check-in confirmation screen.
//
// Fallback path (no app): this route serves a branded page that
//   1. Validates the ?t=<qrToken> against the DB.
//   2. Shows the venue name, cover photo, and tagline for context.
//   3. Offers App Store / Play Store download links so the user can install
//      Met and deep-link directly to the check-in screen after install.
router.get("/v/:placeId", async (req: Request, res: Response) => {
  const APP_STORE_URL =
    "https://apps.apple.com/app/met-we-crossed-paths/id6502749585";
  const PLAY_STORE_URL =
    "https://play.google.com/store/apps/details?id=app.met.founders";

  const { placeId } = req.params as { placeId: string };
  const token = typeof req.query["t"] === "string" ? req.query["t"] : "";

  // Reconstruct the canonical deep-link URL so App Store / Play Store
  // deferred deep links re-open the exact same URL after install.
  const host = req.get("host") ?? "metapp.replit.app";
  const proto = req.secure || process.env["NODE_ENV"] === "production" ? "https" : req.protocol;
  const deepLinkUrl = `${proto}://${host}/v/${encodeURIComponent(placeId)}${token ? `?t=${encodeURIComponent(token)}` : ""}`;

  const storeButtons = `
    <p style="display:flex;gap:12px;flex-wrap:wrap;margin-top:16px">
      <a href="${APP_STORE_URL}" style="background:#1A2421;color:#fff;padding:11px 20px;border-radius:9px;font-weight:700;font-size:14px;text-decoration:none">📱 App Store (iPhone)</a>
      <a href="${PLAY_STORE_URL}" style="background:#1A2421;color:#fff;padding:11px 20px;border-radius:9px;font-weight:700;font-size:14px;text-decoration:none">📱 Google Play (Android)</a>
    </p>`;

  // Look up the approved venue by placeId.
  let venue: typeof venueOwnerProfilesTable.$inferSelect | undefined;
  try {
    [venue] = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(
        and(
          eq(venueOwnerProfilesTable.placeId, placeId),
          eq(venueOwnerProfilesTable.isApproved, true),
          eq(venueOwnerProfilesTable.applicationStatus, "approved"),
        ),
      )
      .limit(1);
  } catch {
    // DB error — fall through to generic page rather than 500.
  }

  // Venue not registered in Met.
  if (!venue) {
    const html = layout(
      "Venue not found",
      `
      <h1>Venue not found</h1>
      <p>This QR code doesn't match any venue registered on Met. The venue may have removed their listing.</p>
      <div class="card">
        <h2 style="margin-top:0">Download Met</h2>
        <p>Met helps you discover people you've crossed paths with. Download the app to get started.</p>
        ${storeButtons}
      </div>
      `,
    );
    res.status(404).type("html").set("Cache-Control", "no-cache").send(html);
    return;
  }

  // Token present but doesn't match — QR code is invalid or was rotated.
  if (token && venue.qrToken !== token) {
    const safeName = escapeHtml(venue.placeName);
    const html = layout(
      "Invalid check-in link",
      `
      <h1>Invalid check-in link</h1>
      <p>This QR code is no longer valid. Please ask the venue for an updated QR code and scan it again.</p>
      <div class="card">
        <h2 style="margin-top:0">Don't have Met yet?</h2>
        <p>Download the app, then scan the updated QR code at <strong>${safeName}</strong> to check in.</p>
        ${storeButtons}
      </div>
      `,
    );
    res.status(400).type("html").set("Cache-Control", "no-cache").send(html);
    return;
  }

  // Valid venue (token matches or no token provided). Show the branded page.
  const baseUrl = `${proto}://${host}`;

  // Resolve cover photo to an absolute URL, then sanitize the scheme.
  const rawCoverUrl = venue.coverPhotoUrl
    ? venue.coverPhotoUrl.startsWith("/")
      ? `${baseUrl}${venue.coverPhotoUrl}`
      : venue.coverPhotoUrl
    : null;
  const safeCoverUrl = rawCoverUrl ? sanitizeUrl(rawCoverUrl) : null;

  // Escape all untrusted text values before interpolating into HTML.
  const safeName = escapeHtml(venue.placeName);
  const safeTagline = venue.tagline ? escapeHtml(venue.tagline) : null;
  // deepLinkUrl is constructed entirely from encodeURIComponent-encoded
  // path/query params — still escape for defense-in-depth.
  const safeDeepLink = escapeHtml(deepLinkUrl);

  const coverBlock = safeCoverUrl
    ? `<img src="${escapeHtml(safeCoverUrl)}" alt="${safeName}" style="width:100%;max-height:260px;object-fit:cover;border-radius:14px;margin-bottom:20px;display:block" />`
    : "";

  const taglineBlock = safeTagline
    ? `<p style="color:#5C6B66;margin:4px 0 0">${safeTagline}</p>`
    : "";

  const html = layout(
    `Check in at ${safeName}`,
    `
    ${coverBlock}
    <h1 style="margin-bottom:4px">${safeName}</h1>
    ${taglineBlock}

    <div class="card" style="margin-top:24px">
      <h2 style="margin-top:0">Open in the Met app</h2>
      <p>Tap the link below to open Met and complete your check-in. If the app didn't open automatically, download it first — the check-in link will work as soon as you've installed it.</p>
      <p style="margin-top:16px">
        <a href="${safeDeepLink}" style="background:#3DCC44;color:#fff;padding:12px 22px;border-radius:9px;font-weight:700;font-size:15px;text-decoration:none;display:inline-block">Open in Met →</a>
      </p>
    </div>

    <div class="card">
      <h2 style="margin-top:0">Don't have Met yet?</h2>
      <p>Download the app — your check-in link will fire automatically once you're set up.</p>
      ${storeButtons}
    </div>
    `,
  );
  res.status(200).type("html").set("Cache-Control", "no-cache").send(html);
});

router.get("/support", (_req: Request, res: Response) => {
  res
    .status(200)
    .type("html")
    .set("Cache-Control", "public, max-age=300")
    .send(supportHtml);
});

router.get("/privacy", (_req: Request, res: Response) => {
  // 302 so search engines / Apple's crawler follow to the canonical
  // externally-hosted policy rather than indexing the inline copy.
  res.redirect(302, PRIVACY_POLICY_URL);
});

export default router;
