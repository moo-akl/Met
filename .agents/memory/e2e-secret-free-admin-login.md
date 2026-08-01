---
name: Secret-free e2e login for secret-gated admin surfaces
description: How to let the Playwright testing subagent log into an admin surface guarded by a shared secret without ever handling the real secret value.
---

# Secret-free e2e login for secret-gated admin surfaces

When an internal surface is gated by a shared credential held in a Replit Secret,
do **not** try to pass that value to the testing subagent (or read it yourself to
type into a form). Instead, instruct the tester to restart the backing workflow
with an environment-variable override setting that credential to a throwaway
value, and log in with the throwaway value.

**Why:** the real secret must never appear in a task description, a test report,
a screenshot, or a log. The testing subagent can restart workflows with arbitrary
env overrides, which gives a fully functional login path without the real value
ever leaving the secret store.

**How to apply:**
- In the test plan's setup step, name the exact workflow and the override, e.g.
  restart the API workflow with `ADMIN_SECRET=<throwaway>`, and explicitly tell
  the tester not to attempt to read the real value.
- The override lives only in the tester's restarted process. After the run,
  restart that workflow yourself to restore the real secret, then confirm the
  throwaway value is rejected and the real one is accepted.
- Session-cookie signing secrets (e.g. `SESSION_SECRET`) usually do not need
  overriding — only the credential the login form checks.

For pure API verification you don't need the tester at all: `curl` can reference
`$SECRET` inside a shell command without ever echoing it, e.g. building the JSON
body with `jq -nc --arg s "$SECRET" '{secret:$s}'`.
