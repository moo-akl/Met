---
name: App Check global enforcement blocks Firestore writes
description: Firebase App Check enforcement in the Console blocks ALL Firestore requests with permission-denied, regardless of security rules, when the production app can't get a valid token.
---

## Rule

If a Firestore client write returns `permission-denied` even when security rules say `allow write: if true`, the cause is **App Check global enforcement** in the Firebase Console — not the security rules.

**Why:** Firebase App Check enforcement is a Firebase-infrastructure-level gate that runs *before* security rules are evaluated. If the production app fails to obtain a valid App Check token (App Attest / Play Integrity misconfigured or failing), every Firestore request is rejected with `permission-denied` regardless of what the rules say.

**How to apply:** Whenever you see a persistent `permission-denied` on client-side Firestore writes that survives rules set to `if true`, immediately check Firebase Console → App Check → Firestore enforcement. In this project, enforcement was disabled (unenforced) because production App Attest / DeviceCheck wasn't generating valid tokens.

## Diagnostic sequence used

1. Showed actual error code by returning `[code] message` from sendMessage instead of a generic boolean.
2. Split the write into labeled steps (`step1/msg`, `step2/meta`) so the UI showed exactly which write failed.
3. Added auth UID cross-check (`auth().currentUser?.uid` vs `fromUid`) — mismatch means stale AppContext.
4. Set rules to `allow read, write: if true` and redeployed — write STILL failed → confirmed global enforcement.
5. User disabled enforcement in Firebase Console → writes succeeded immediately.

## Current state (this project)

- App Check enforcement for Firestore: **disabled** (unenforced) in Firebase Console.
- Security rules for messages: `allow create: if isAuthed() && from == uid` — auth-only, no `isVerifiedApp()`.
- Production builds use `appAttestWithDeviceCheckFallback` in `initAppCheck()` but tokens are not reaching Firestore (likely App Attest not registered in Console).
