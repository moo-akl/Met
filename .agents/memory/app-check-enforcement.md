---
name: App Check global enforcement blocks Firestore writes
description: Firebase App Check enforcement in the Console blocks ALL Firestore requests with permission-denied, regardless of security rules, when the production app can't get a valid token.
---

## Rule

If a Firestore client write returns `permission-denied` even when security rules say `allow write: if true`, the cause is **App Check global enforcement** in the Firebase Console — not the security rules.

**Why:** Firebase App Check enforcement is a Firebase-infrastructure-level gate that runs *before* security rules are evaluated. If the production app fails to obtain a valid App Check token (App Attest / Play Integrity misconfigured or failing), every Firestore request is rejected with `permission-denied` regardless of what the rules say.

**How to apply:** Check Firebase Console → App Check → Firestore enforcement and the client attestation setup. A previous incident was resolved by disabling enforcement because production attestation was failing; that is historical context, not evidence of the current setting. Do not automatically change live enforcement during source fixes.

## App Check is not a Firestore Rules request property

Do not add a rule predicate using `request.app_check_token`. Cloud Firestore's
documented Rules Request properties do not expose the App Check token.

**Why:** An emulator authorization failure initially looked like missing emulator
App Check support. The official Request reference confirmed that the same
predicate is unsupported in production and can deny legitimate presence reads,
updates, and fail-safe Hide writes. App Check rejects unverified requests at the
Firebase service boundary, separately from Auth and ownership rules.

**How to apply:** Keep Firebase Auth, ownership, and visibility restrictions in
Rules; keep App Check configuration at the service/client boundary. Test the
actual rules without replacing this predicate with a permissive test shim, and
verify service enforcement separately before a rollout.

References:
- https://firebase.google.com/docs/reference/rules/rules.firestore.Request
- https://firebase.google.com/docs/app-check/enable-enforcement
