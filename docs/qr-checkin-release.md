# QR-first signup and private check-in: release checklist

## Intended behavior

- Existing signed-in accounts open a lightweight QR check-in screen, not the
  full venue page. Success is shown only after the server confirms the visit.
- Signed-out arrivals keep the venue and QR token through authentication.
  Pending scans expire after one hour and are cleared on logout or cancellation.
- Photo-less authenticated accounts can record private visits, but cannot
  become discoverable or start social interactions. Private visits do not earn
  public leaderboard or reward credit.
- Apple/Google authentication, the explicit 18+/terms/privacy agreement, and
  email/password verification are retained.
- Full profile setup remains available after check-in. Photo upload and server
  profile save must succeed before the local profile becomes social-ready.
- The installation page retains the location and offers an explicit Open Met
  action. Installing alone does not restore a scan; return to the page or scan
  again. Automatic deferred installation links are not included in this release.

Future installation recovery is evaluated in
[the deferred-install proposal](hotspot-deferred-install-proposal.md).
It does not change this release: Android Install Referrer, an iOS App Clip,
providers and new data processing remain subject to explicit approval.

## Rollout order

1. Review and deploy `firestore.rules` through the existing Firebase rules
   process. The new server-owned social eligibility flag protects direct
   Firestore chat/reveal/BLE paths as well as the API restrictions.
   Do not release private visitor signup against the old rules.
2. Publish the API/QR landing-page changes. No database schema migration is
   introduced by this feature.
3. Create new native iOS and Android builds using the project's existing
   release workflow. Allocate fresh platform build numbers at release time.
   Existing installed binaries will not acquire these changes by reopening.
4. Test the matrix below on real devices before broad rollout.

The app adds `met-app.org` to its native link associations while preserving
existing `metapp.replit.app` QR links and all bundle identifiers. Both domains
must continue serving the Apple association file and Android asset links.

## Real-device acceptance matrix

- iOS and Android: cold and warm signed-in scans, success, venue browsing, and
  guaranteed return to Home.
- Signed-out existing account: sign in and resume exactly the scanned location.
- New Apple and Google accounts: terms consent, private visit, no mandatory photo.
- Email signup: verification in another app, return, and pending check-in resume.
- Force quit during signup, cancellation, expired intent, logout, and switching
  accounts: no lost or incorrectly attributed check-in.
- Airplane mode, timeout, invalid/rotated token: explicit failure and working retry.
- New private visitor: no public presence, social posting, chat sending,
  leaderboard identity, or reward entry. Profile/settings and account deletion
  remain reachable.
- Photo rejection or save failure: stay incomplete; no social access.
- Photo completion: normal photo moderation, explicit visibility opt-in, and
  existing report/block/delete behavior still work.
- No installation: correct store links, return to browser/Open Met, then check-in.
- Existing printed codes on both supported domains continue to work.

## Verification performed in the workspace

API tests cover private versus public QR recording, invalid tokens, authenticated
social restrictions, privacy/safety exits, and deletion of private visits.
Mobile tests cover intent parsing/storage/expiry, account binding, request
deduplication, deep links, and profile-gate branching. Typechecks and all eight
translation-key checks pass.

Browser verification confirmed the QR-specific signup screen renders at a
390-by-844 viewport with unchecked consent and a disabled incomplete signup
action. Native authentication, app-store installation, and the complete native
scan/login/check-in journey cannot be validated by that browser test.
The shared development proxy routes `/v` to the website fallback, so it is not
a substitute for native Universal/App Link testing.

No production publish, Firebase rules deployment, or native store submission was
performed as part of implementation. App Review approval is not guaranteed.
