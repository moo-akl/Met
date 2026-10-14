---
name: EAS local-build signing profile freshness
description: Why GitHub-hosted EAS local builds can keep using old iOS provisioning profiles after App ID capabilities change.
---

`eas build --local` changes where compilation runs, not who manages signing credentials. A GitHub Actions build can still retrieve and reuse an EAS-managed Ad Hoc provisioning profile. Enabling Push Notifications or Associated Domains on the Apple App ID does not update an existing profile.

**Why:** After the App ID capabilities were enabled, a GitHub build reused the same EAS-managed Ad Hoc profile and Xcode still rejected the `aps-environment` and Associated Domains entitlements.

**How to apply:** When those entitlement errors persist, refresh only the EAS Ad Hoc provisioning profile after enabling the App ID capabilities. Keep the distribution certificate and app capability declarations; do not try to fix signing by removing push notifications or universal links.