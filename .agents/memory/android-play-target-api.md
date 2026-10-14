---
name: Android Play target API
description: Keep the Expo Android target API aligned with Google Play's release requirement rather than relying on the compile API.
---

Expo Android releases must explicitly target the API level required by Play; `compileSdkVersion` and `targetSdkVersion` are independent. A higher compile SDK does not raise the release's target SDK.

**Why:** Play rejected a release whose compile SDK was current but whose explicit target SDK remained one level lower.

**How to apply:** When Play raises its requirement, update the target SDK in the Expo build-properties configuration, increment the Android version code for a fresh EAS AAB, and verify the evaluated Expo configuration and generated manifest. Test platform behavior on the newly targeted Android version before release.