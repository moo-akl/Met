---
name: EAS ASC-key auth needs EXPO_APPLE_TEAM_TYPE
description: Why EAS CI builds silently reuse stale provisioning profiles and how to fix it
---

Rule: For eas-cli to authenticate with Apple via App Store Connect API key in non-interactive CI (and thus validate/regenerate provisioning profiles), ALL FIVE env vars must be set: `EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`, `EXPO_APPLE_TEAM_ID`, and `EXPO_APPLE_TEAM_TYPE` (e.g. `INDIVIDUAL`).

**Why:** With any one missing, the build log shows "Skipping Provisioning Profile validation on Apple Servers because we aren't authenticated" and EAS silently reuses whatever profile is cached in its credential vault — even if it lacks a newly added capability (e.g. Push Notifications / aps-environment). Cloud vs `--local` build makes no difference; running `eas credentials` interactively also doesn't fix the CI runs. Also: `--clear-provisioning-profile` is NOT a valid `eas build` flag.

**How to apply:** Diagnose "profile doesn't support X capability" CI failures by grepping the log for the "Skipping Provisioning Profile validation" line first. If present, fix the auth env vars rather than touching entitlements or switching to cloud builds.
