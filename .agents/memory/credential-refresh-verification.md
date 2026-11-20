---
name: Credential refresh verification
description: Distinguish a valid replacement credential from a stale runtime value before requesting another rotation.
---

Do not treat a secret-confirmation event or a successful workflow restart as
proof that the running environment is using the replacement credential.

**Why:** A newly uploaded Firebase service-account file authenticated and passed
the complete external photo pipeline, while runtime authentication still failed.
The runtime held a different key even after secret confirmations and workflow
restarts. Requesting another rotation before distinguishing these cases wasted
the user's effort.

**How to apply:** Compare credential identity only inside a local validation
process and expose boolean match results, never credentials, tokens or raw file
contents. Validate a supplied replacement separately from the running service.
If the replacement works, investigate environment delivery instead of blaming
the key. Do not infer whether the secret store or the process is stale without
evidence, and do not introduce credential-file fallbacks into application code.

Comparing the API's credential with a separate shell process proves only that
those processes agree; it does not prove either received the user's replacement.

**Why:** Both processes can retain the same rejected credential after a secure-form
confirmation. Treating that agreement as proof the replacement is invalid can
lead to unnecessary key rotations.

**How to apply:** If confirmations and restarts leave authentication unchanged,
ask the user to replace the secret directly in Tools > Secrets, then retry a live
read. Keep the task blocked until that read succeeds; never request repeated
rotations solely because the available runtime credential is rejected.

Check the published API's Production app secrets separately from development
Secrets, and require a successful authenticated API check before declaring a
native release ready for user testing.

**Why:** A native build passed while the live API received malformed Firebase
credential JSON. Profile reads and onboarding photo uploads were rejected, and
venue check-in presented the shared server failure as a connection problem.
Changing a development secret alone does not prove the published process changed.

**How to apply:** Inspect live deployment diagnostics, correct the production
secret using the existing validated credential, and republish the backend.
Verify the new runtime rather than asking for more key rotations or native
builds. Do not treat a public health endpoint or successful compilation as proof
that authentication, photo processing, and storage are ready.

Successful Firebase Admin initialization is not proof that the service account
can authenticate. Confirm the published runtime with protected, read-only
Firebase requests as well.

**Why:** Initialization parses local configuration without proving the key is
still accepted by Google. Read-only Firestore and Storage checks distinguish
valid live credentials from a merely well-formed configuration.

**How to apply:** Use existing protected diagnostic/read-only routes, explicitly
select dry-run behavior where applicable, and report only pass/fail metadata.
Never expose credentials, list user records in chat, or perform cleanup writes
as a credential test.
