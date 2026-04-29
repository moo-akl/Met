import { Router, type IRouter, type Request, type Response } from "express";

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

const router: IRouter = Router();

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
