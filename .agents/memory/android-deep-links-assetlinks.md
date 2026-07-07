---
name: Android App Links / assetlinks.json setup
description: How Android deep link domain verification is configured for this project
---

## The Rule
Android App Links with `autoVerify: true` require `/.well-known/assetlinks.json` to be served at the verified domain. If that file is missing or returns 404, Play Console reports "1 domain not verified" and ALL deep links fall back to browser.

**Why:** Google's verification crawler fetches `https://<host>/.well-known/assetlinks.json` during app install. Without it, the intent filter is treated as a non-verified deep link.

**How to apply:**
- The file is served by the API server (`artifacts/api-server/src/routes/legal.ts`) at the root path `/.well-known/assetlinks.json`.
- `/.well-known` must be listed in `artifact.toml` paths array alongside `/api`, `/support`, `/privacy` so the proxy routes it to the API server instead of the Expo web app.
- The SHA-256 fingerprint must come from **Play Console → Setup → App integrity → App signing key certificate** (NOT the upload key). For `app.met.founders` this is: `A0:FF:D9:D6:F1:6C:9F:C8:FB:72:7A:84:F6:3E:01:5B:FE:9F:B1:F1:83:A3:ED:0B:AC:00:55:23:5B:3F:42:59`.
- After deploying, Google re-verifies automatically within ~24 hours. No new app build is needed.
