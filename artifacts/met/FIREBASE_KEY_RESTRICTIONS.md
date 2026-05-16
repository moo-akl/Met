# Firebase API Key Restrictions — Runbook

This document covers the exact steps to lock down the two Firebase API keys so they
can only be called by the Met app. Run through this once per key rotation.

A script (`scripts/src/check-firebase-key-restrictions.ts`) is provided to both
**verify** and **apply** restrictions programmatically — see Step 0 below.

---

## Keys in scope

| Platform | Key value | Credential file |
|----------|-----------|-----------------|
| Android  | `AIzaSyDBKgHSM-f34RZZdzORAO0ADcBYhYEKojA` | `google-services.json` |
| iOS      | `AIzaSyCIKGH3kMUp8uZtcglqrNN9kKxOAzB7Jt8` | `GoogleService-Info.plist` |

Without restrictions, anyone who extracts these keys from the binary can call Firebase
APIs on your project quota. Two layers of protection are applied:

1. **App restriction** — key is only accepted from your bundle/package ID (+ cert hash
   for Android).
2. **API restriction** — key can only call the Firebase APIs the app actually uses.

> **Note:** App Check (Play Integrity on Android, App Attest on iOS) is already
> enforced in the app code and Firestore rules, providing a second independent barrier.
> The API key restrictions below add defence-in-depth on top of that.

---

## Step 0 — Grant the service account permission to manage keys

The Firebase service account (`FIREBASE_SERVICE_ACCOUNT_JSON`) is used by the
verification/apply script. By default it lacks API key management permissions.
Grant the role once in Cloud Console:

1. Go to `https://console.cloud.google.com/iam-admin/iam?project=metapp-b4642`
2. Find the service account row (email ends in `@metapp-b4642.iam.gserviceaccount.com`)
3. Click the pencil icon → **Add another role**
4. Add **API Keys Admin** (`roles/apikeys.admin`)
5. Save

If you only want read-only verification, add **API Keys Viewer** (`roles/apikeys.viewer`)
instead.

---

## Step 1 — Apply restrictions via the script (recommended)

From the workspace root, with `FIREBASE_SERVICE_ACCOUNT_JSON` set in your environment:

```bash
# Verify current state (read-only):
pnpm --filter @workspace/scripts run check-firebase-keys

# Apply restrictions automatically:
pnpm --filter @workspace/scripts run apply-firebase-keys

# Apply Android restrictions including SHA-1 certificate fingerprints:
tsx scripts/src/check-firebase-key-restrictions.ts --apply \
  --sha1=<upload-key-SHA1> \
  --sha1=<debug-key-SHA1>
```

The script will:
- Authenticate using the Firebase service account JWT
- List all API keys in project `metapp-b4642`
- Check/apply app restrictions (bundle ID `app.met.founders` for iOS; package +
  SHA-1 for Android) and API restrictions
- Exit with code 1 if any restriction is missing (suitable as a release gate)

---

## Step 2 — Get Android SHA-1 fingerprints

The Android app restriction requires certificate fingerprints. Obtain them from:

**Option A — Play Console (recommended for production key):**
Play Console → App → Setup → App signing → App signing key certificate → copy SHA-1

**Option B — Local debug keystore:**
```bash
keytool -list -v -keystore ~/.android/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android \
  | grep SHA1
```

Add both the upload key SHA-1 and the debug key SHA-1 when running with `--apply`.

---

## Step 3 — Manual fallback (if script cannot get IAM permissions)

If you cannot grant the service account the API Keys Admin role, apply restrictions
manually:

1. Go to `https://console.cloud.google.com/apis/credentials?project=metapp-b4642`

### Android key (`AIzaSyDBKgHSM…`)

**App restriction → Android apps:**
- Package name: `app.met.founders`
- SHA-1 fingerprint: (from Step 2)

**API restriction → Restrict key → select:**
| API | Why needed |
|-----|------------|
| Identity Toolkit API | Firebase Authentication |
| Token Service API | Firebase Auth token exchange |
| Firebase Installations API | Firebase SDK device registration |
| Cloud Firestore API | Firestore reads/writes |
| Firebase App Check API | App integrity verification |
| Cloud Messaging API (Firebase) | Push notifications |

### iOS key (`AIzaSyCIKGH3k…`)

**App restriction → iOS apps:**
- Bundle ID: `app.met.founders`

**API restriction:** Same list as Android above.

---

## Step 4 — Download fresh credential files

After restrictions are saved (keys themselves don't change, but download fresh copies
to confirm they're intact):

1. **Android** — Firebase Console → Project Settings → Android app → Download
   `google-services.json`
2. **iOS** — Firebase Console → Project Settings → iOS app → Download
   `GoogleService-Info.plist`

---

## Step 5 — Update EAS secrets

From `artifacts/met/` (requires EAS CLI login):

```bash
eas secret:delete --name GOOGLE_SERVICES_JSON
eas secret:delete --name GOOGLE_SERVICE_INFO_PLIST

eas secret:create --scope project --name GOOGLE_SERVICES_JSON \
  --type string --value "$(cat google-services.json)"

eas secret:create --scope project --name GOOGLE_SERVICE_INFO_PLIST \
  --type string --value "$(cat GoogleService-Info.plist)"

# Delete local copies — never commit them
rm google-services.json GoogleService-Info.plist
```

The next EAS build automatically injects these secrets via
`plugins/with-firebase-credentials.js`.

---

## Step 6 — Verify post-deployment

Run the check script against the live keys:

```bash
pnpm --filter @workspace/scripts run check-firebase-keys
```

Expected output: `All Firebase API key restrictions verified.`

Also check:
- Firebase Console → App Check → Metrics: no unexpected traffic
- Cloud Console → Credentials → the key's "Referrer stats": only traffic from
  your bundle ID

---

## Step 7 — Enable Firebase App Check enforcement (optional but recommended)

The app already initialises App Check (Play Integrity / App Attest) and Firestore
rules require a valid token on every request. To enforce at the Firebase service level
too:

1. Firebase Console → App Check → Apps → select **Met**
2. Monitor traffic for 24 hours first (check that no legitimate builds are blocked)
3. Click **Enforce** for each service: Firestore, Authentication
