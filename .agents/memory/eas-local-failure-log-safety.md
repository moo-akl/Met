---
name: EAS local failure log safety
description: EAS local-build failures can expose encoded signing material in otherwise ordinary workflow output.
---

Treat EAS local-build failure logs as potentially secret-bearing. Never print
raw tails or reproduce the local-build command's encoded job argument.

**Why:** A native signing failure emitted the complete encoded build-job payload,
including signing material, into GitHub workflow output. GitHub masking of the
original secrets does not necessarily mask derived or encoded credentials.

**How to apply:** Filter logs before they enter tool output or reports. Prefer
explicitly selected stage-success messages and short compiler/signing errors;
exclude long encoded command arguments. Do not decode or persist the payload.
If exposure is observed, inform the owner and seek approval for credential
rotation rather than revoking credentials automatically.