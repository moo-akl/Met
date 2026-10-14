# Hotspot recovery after installation: evaluation and proposal

Research checked: 2026-10-14. Status: **proposal only; implementation and any
new data processing require explicit user approval**. No SDK, provider account,
tracking, store URL, printed QR, native configuration, or runtime behavior has
been changed by this evaluation.

## Recommendation and decision

1. Prefer a first-party Android pilot using Google Play Install Referrer and
   an opaque, purpose-limited intent. No attribution vendor is necessary.
2. On iOS retain return-to-browser → **Open Met to check in**, or rescan.
   Do not advertise automatic recovery after installation.
3. If iOS recovery is essential, separately evaluate a first-party App Clip.
   This is a new native experience, not a small SDK switch or a guarantee.
4. Do not purchase or integrate Branch/AppsFlyer without approval of the exact
   matching method, data processing, retention, and full recurring cost.
   Clipboard and fingerprint-based recovery are excluded even with approval.

Approval questions for a subsequent implementation task:

- Approve Android first-party recovery, including passing an opaque intent to
  Google Play, one-hour server-side storage, and the new native release work?
- Keep the current iOS fallback, or authorize an App Clip feasibility spike?
- Only if a provider is still wanted: approve a named plan, written quote,
  budget/overage controls, processor terms and exact SDK configuration before
  creating an account or enabling collection. Research is not consent.

## What Met already does

The printed URL is `/v/<placeId>?t=<venueQrToken>`. Supported hosts include
`metapp.replit.app`, `met-app.org` and `www.met-app.org`; do not replace these
with vendor links or require reprinting.

`artifacts/api-server/src/routes/legal.ts` validates the listing/token and
renders the venue, unchanged store links and an explicit `met:///v/...` button.
Its instructions deliberately say to return to the browser or scan again.
Installing by itself does not check anyone in.

Once the link actually reaches the app, `artifacts/met/lib/qrIntent.ts` persists
it for one hour, supports authentication/restarts and account isolation.
`artifacts/met/app/_layout.tsx`, `artifacts/met/app/v/[placeId].tsx` and
`artifacts/met/lib/qrCheckin.ts` handle delivery and server-confirmed check-in.
That storage exists **inside the installed app**, not across a first install.
`artifacts/api-server/src/routes/engagement.ts` validates the current venue QR
token before recording a visit and separates private visits from public credit.
The existing check-in route inserts verification rows; do not assume it already
provides transactional deferred-intent redemption or full request idempotency.

## Platform limits

### Android

Google Play exposes the Install Referrer API through the on-device Play Store
(version 8.3.73 or later; Play Console account required). The official native
library is `com.android.installreferrer:installreferrer:2.2` [1, 2].
Play store links accept a `referrer` parameter [3].

The referrer is available for 90 days and does not change until reinstall.
Google recommends retrieving it once at first execution and closing the
connection. That is an API retention period, **not Met's intent lifetime**.
Use bounded retries for temporary service failures; cache a successful result
or a permanent unsupported outcome, not a forever-failed transient attempt.

Only the install through the attributed Play link can be expected to carry
the reference. Sideloads, other stores, missing Play services, installing by
search, changed store paths, missing/foreign referrers and expired intents must
fail safely to the existing fallback. An installed app will not receive a new
Install Referrer every time someone scans a code; ordinary App Links remain
the installed-user path. Do not promise recovery for every Android install.

An Expo native bridge/configuration is needed, with strict platform guards.
It will not work by adding only JavaScript, through Expo Go, or in an old
binary. Release through the project's GitHub → EAS native build process;
allocate a fresh Android versionCode. No OTA release is proposed.

### iOS

Universal Links deliver context when the app is installed. If it is absent,
Apple opens the website; association checks after install do not themselves
replay the prior URL [4]. There is no general App Store Install Referrer
equivalent for arbitrary hotspot payloads. App Store campaign parameters and
ad-attribution reports are not a private check-in intent channel.

Safari's same-domain navigation can remain in Safari, which is why the current
explicit Open Met action is useful. Keep it and the rescan option. First launch
from the App Store alone cannot be relied on to recover the original hotspot.

Private Relay can interfere with provider deferred-link matching [5].
Branch's NativeLink uses the clipboard [6]; this is not acceptable here.
Apple prohibits deriving device fingerprints, and ATT permission does not
make fingerprinting acceptable [7]. Do not substitute IP/user-agent matching,
hashed email/phone matching, advertising IDs, clipboard reads/writes or
device-graph tricks. A paid SDK does not remove these limits.

A first-party App Clip can receive the invocation URL, mint an expiring intent,
and share only its opaque reference and expiry with the full app through an
App Group [8]. It does not need an attribution SDK for that transfer. It needs
an App Clip native target, invocation/association setup, compatible entitlements
and signing, an install prompt, and full-app native read/cleanup support.
The user must actually invoke the Clip before installing; availability, user
choices, expiration and removal of Clip data can still prevent recovery.
Test ordinary camera scans of the **existing printed URLs** before choosing
this approach. Neither every scanner nor every install path will invoke it.
Keep browser/rescan even if an App Clip is eventually shipped.

An optional first-party, short-lived, manually entered recovery code is another
explicit-user-action design, not automatic deferred linking. It introduces
extra steps and brute-force controls and is not recommended ahead of the
existing fallback. Do not implement it as an automatic clipboard operation.

## Proposed scoped intent contract (not implemented)

Use a random opaque reference with at least 128 bits of cryptographic entropy.
Only `version + purpose + reference` cross the install boundary. Illustrative
decoded referrer: `v=1&purpose=hotspot_checkin&intent=<opaque-reference>`.
Build the store query with a URL encoder, not string concatenation. Never pass
the printed QR token, account UID, name, email, auth token, profile, precise GPS,
advertising ID or install/device identifier to Play or an optional provider.
The scoped reference is still sensitive: it can reveal a chosen destination
when resolved. Do not describe it as anonymous or risk-free.

Proposed server-side record: hash of reference, fixed purpose/version, placeId,
QR generation/token snapshot, issuedAt, expiresAt, redemption state. Unclaimed
records contain no account identity. Mint only for a validated active listing
and current QR, when the visitor explicitly taps Install and continue, not
on page load or crawler access. Initial TTL: **one hour from minting**, aligned
with today's QR-intent window; ask approval before changing this policy.
Resuming/signup/retries must never extend that absolute deadline.

Sequence after approval:

1. Keep the printed `/v` URL and fallback HTML unchanged in purpose. Add the
   optional Android install action behind an off-by-default server flag.
   If minting fails, retain a working ordinary Play link.
2. On first Android launch, retrieve/strictly parse only Met's versioned
   referrer. Reject unexpected fields, oversized strings and unknown purposes.
   Persist the small reference locally across signup/restarts. Do not block
   normal startup or require ad/tracking permission.
3. Prefer a new explicit scan/deep link to an older deferred result. A delayed
   referrer callback must not replace a newer destination or resurrect a
   cancelled/cleared intent. Mark the install handoff handled so logout cannot
   re-import it from Play's 90-day copy.
4. Resolve the intent through a bounded, rate-limited first-party API. Preserve
   its original server expiry when adapting to the existing pending-intent
   flow; calling `saveQrIntent` with the current time alone would renew it.
   Server time is authoritative even if the phone clock is changed.
5. Keep the intent through consent, 18+ safeguards, authentication and email
   verification. Only after authenticated signup/sign-in bind locally and on
   redemption to that account. Show the recovered venue and obtain explicit
   visit confirmation before recording; do not silently award a visit on
   install. Preserve private check-in and the separate social/photo gate.
6. At redemption, revalidate expiry, purpose, venue status and current QR
   generation. Token rotation/revocation or removed venues invalidate old
   intents. The reference authorizes only resuming this flow, not login,
   account access, public visibility, rewards or bypassing check-in validation.
   It is not stronger proof of current physical presence than the printed QR.
7. Make consumption and visit recording atomic or equivalently retry-safe,
   with an authenticated idempotency key. Same-account retries return the
   original result, not duplicate visits/credit; another account cannot reuse
   a consumed intent. Do not consume before a failed visit is safely retryable.
8. Clear local state on success, cancellation, expiry and logout/account change.
   Purge expired unclaimed server records promptly (proposed hourly cleanup,
   so physical deletion is within one further hour); reject them immediately
   at expiry. Any consumed receipt needed for retry/account isolation retains
   only minimal state until the original expiry, then is purged likewise.

Do not log raw references/referrers, QR tokens or full handoff URLs. Configure
app, proxy and error-reporting redaction before pilot rollout. Use no new
tracking cookies, pixel, IP correlation or cross-company identity matching.
No new install analytics is approved by this proposal. If aggregate operational
counts are later approved, omit payloads and account/device identifiers.
Review privacy notice, store privacy labels/Data Safety and provider manifests
for actual data processing. ATT is conditional on tracking as Apple defines it,
not automatically required for every first-party functional deep link [7].
Check-in must never depend on granting tracking permission.

## Cost and service comparison

Prices are public USD information checked on the research date, not quotes.
Existing store membership, infrastructure, tax, native engineering and device
QA are additional costs; no traffic estimate is available to price those.

| Approach | Verified pricing/limits | Fit for Met |
| --- | --- | --- |
| Current fallback | No new service/subscription | Works with existing printed URLs; requires return or rescan. |
| First-party Play Install Referrer | Google documentation lists no per-call/subscription fee; not an attribution service. Budget mint/resolve/cleanup traffic and native build maintenance separately. | Recommended Android pilot, subject to approval. No iOS coverage. |
| First-party App Clip | No deferred-link vendor subscription; requires new native target, signing and substantial engineering/QA, with existing Apple membership costs. | Possible iOS improvement only for Clip-invoked installs; separate feasibility approval. |
| Branch | Official Intro FAQ lists **$39/month**, 5,000 attribution volume credits and 500 web links/custom QR codes monthly; deferred linking included. Overages: **$0.05/volume credit, $0.05/link or QR, $0.01/click**, uncapped. A 30-day Basics trial uses a card with a $10 temporary hold and auto-subscribes to Intro if no plan is chosen [9]. | Not selected. NativeLink's clipboard route is excluded; require proof of an allowed matching configuration. Intro has no branded custom domain or Short Link API access; obtain a quote for the needed plan/API. Do not assume a printed QR is one billable install or one volume credit. |
| AppsFlyer OneLink | Current standalone pricing: Zero is free for basic routing; **Standard includes deferred deep linking at custom pricing**. Advanced/Premium are also custom priced; SDK/UDL needed for in-app deferred routing [10]. | Not selected. Obtain a written quote/limits/retention and an allowed iOS delivery method. Do not assume legacy free-plan claims still cover this feature. |
| Firebase Dynamic Links | Shut down August 25, 2025 [11]. | Excluded; existing Firebase Auth does not imply this discontinued service is available. |

Before vendor approval, obtain included clicks/installs/active users/API calls,
overages, minimum commitment, branded-domain/API support, support charges,
regional hosting/subprocessors, deletion/export terms and cancellation/link
continuity. Reject uncapped exposure without enforceable budget controls.
Any vendor must remain an optional layer behind Met-owned printed URLs,
with a first-party fallback if the provider is unavailable or cancelled.

## Acceptance and rollout criteria for later implementation

- Play-distributed first install from the same hotspot link: original venue
  survives fresh signup, email verification and restart within the deadline.
- Existing signed-in/out users and legacy printed URLs on supported hosts
  retain the ordinary scan path; newly scanned intent wins over delayed referrer.
- Missing/unsupported/foreign/malformed referrer, other store/sideload/search
  install, timeout/offline startup: app opens normally and fallback is clear.
- Expiry during download/signup, clock tampering, rotated QR, revoked venue:
  no stale check-in; explain returning to browser or rescanning.
- Cancellation, logout, switching account, reinstall and replay/races: no
  resurrected intent, cross-account visit, duplicate verification/credit or
  renewed expiry. Failed network requests can be retried safely.
- iOS App Store Open without delivery: no automatic recovery claim; return
  to browser/Open Met and rescan work. If evaluating App Clip, test camera and
  third-party scanners, Clip invocation/non-invocation, missing shared data,
  expiry, Private Relay and full-app install on real devices.
- No clipboard permissions/access, fingerprint collection, new ad IDs,
  account data in install payloads, or sensitive values in logs. Existing
  moderation, Apple sign-in, consent and private/public eligibility stay intact.

Keep feature flags off until approved API and native changes are compatible.
Use a limited Android Play test track, not only an emulator/Expo Go, to validate
the actual store handoff. Rollback disables minting/import, not printed QR
routes or browser/rescan. Old binaries continue using the fallback.

## Sources

1. [Google Install Referrer requirements](https://developer.android.com/google/play/installreferrer)
2. [Google native library, retention and lifecycle](https://developer.android.com/google/play/installreferrer/library)
3. [Google Play linking and referrer parameter](https://developer.android.com/distribute/marketing-tools/linking-to-google-play)
4. [Apple Universal Links behavior](https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content)
5. [AppsFlyer iOS Private Relay limitations and alternatives](https://dev.appsflyer.com/hc/docs/dl_ios_private_relay)
6. [Branch NativeLink clipboard mechanism](https://www.branch.io/resources/blog/nativelink-and-app-clips-solving-the-deferred-deep-linking-challenges-of-private-relay)
7. [Apple privacy, ATT and fingerprinting prohibition](https://developer.apple.com/app-store/user-privacy-and-data-use/)
8. [Apple App Clip/full-app data sharing](https://developer.apple.com/documentation/appclip/sharing-data-between-your-app-clip-and-your-full-app)
9. [Branch official Intro pricing, restrictions and overages](https://help.branch.io/docs/intro-plan-faqs)
10. [AppsFlyer current deep-linking plans](https://www.appsflyer.com/pricing/deep-linking/)
11. [Firebase Dynamic Links shutdown FAQ](https://firebase.google.com/support/dynamic-links-faq)
