---
name: No Expo OTA — EAS builds only
description: Met's chosen release workflow relies on GitHub-to-EAS builds rather than shipping over-the-air updates.
---

Do not suggest that reopening the installed Met app will deliver code or native configuration changes. Plan a new EAS build for release changes.

**Why:** The user's release workflow is GitHub to EAS build; the presence of Expo Updates configuration does not mean this project uses OTA distribution.

**How to apply:** For JS and native changes, tell the user to create and install/upload a fresh build. Distinguish Android `versionCode` from iOS `buildNumber`; change only the platform being released when appropriate.