---
name: TestFlight duplicate build number crash
description: Silent native iOS crash when a new EAS build has the same buildNumber as an existing TestFlight build.
---

# TestFlight duplicate build number causes silent crash

## The rule
Every EAS build uploaded to TestFlight must have a strictly higher `buildNumber` (iOS) and `versionCode` (Android) than the previous upload. Never reuse a number.

**Why:** TestFlight deduplicates by build number. If you upload build 161 twice, iOS may run the old binary or reject the new one silently. The app installs but crashes immediately with no JS red screen — because it's the old native binary running against a new JS bundle, or the new binary was never accepted.

**How to apply:** Before triggering any EAS build intended for TestFlight/Play Store, increment both values in `artifacts/met/app.json`:
- `expo.ios.buildNumber` (string) 
- `expo.android.versionCode` (number)

Current value as of July 2026: **162**. Next build must be **163** or higher.

**Symptom to watch for:** Silent crash on TestFlight (no red screen, no JS error boundary triggered) immediately after install, when the previous build worked fine. Check the build number first before any other debugging.
