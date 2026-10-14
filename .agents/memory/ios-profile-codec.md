---
name: iOS provisioning-profile codec safety
description: Real Apple profiles contain typed plist data and dates; signing retries need phase-aware diagnostics and state inspection.
---

Do not convert a whole provisioning-profile plist with macOS `plutil -convert
json`. Use a typed plist decoder and normalize certificate bytes and UTC dates
without weakening the existing entitlement, certificate, device, or expiry checks.

**Why:** Real profiles contain NSData and NSDate, which that JSON conversion cannot
represent. Offline tests that inject already-normalized objects bypass this
boundary and can pass while the live codec is broken.

**How to apply:** Keep literal XML fixtures with wrapped data and date values, plus
a macOS CMS codec smoke test. Distinguish CMS decoding from plist parsing with fixed
allowlisted diagnostic stages; never expose decoded profile contents or raw
subprocess errors.

Provisioning-profile authorization is not the same schema as the app's claimed
entitlements. Apple's Associated Domains allowlist can be the exact string `"*"`,
while the app still claims an array of its actual domains.

**Why:** A real Apple-issued replacement passed identity, push, certificate,
device, and expiry checks but was falsely rejected because its domain grant was a
string wildcard rather than an array.

**How to apply:** Treat only the exact signed grant `"*"` as equivalent to the
already-supported wildcard array. Keep arbitrary strings and malformed grants
invalid, keep the app's domain list unchanged, and share the authorization rule
between validation and diagnostic summaries.

Inspect live state read-only before retrying a failed signing repair. A generic
validation failure alone does not establish whether an Apple profile was created
or whether the saved EAS association changed.

**Why:** Blindly retrying creation can add duplicate profiles or obscure a
post-mutation failure while the original credentials remain usable.

**How to apply:** Reuse only an unambiguous fresh repair profile after validating
the same certificate, devices, and capabilities. Reread the EAS snapshot even for
an already-installed success path; do not revoke credentials or delete old profiles
as part of recovery.