---
name: GitHub push authentication
description: How to authenticate git pushes to GitHub in this repl when the managed git connector has no credentials.
---

# Pushing to GitHub from this repl

The managed `gitPush` callback fails here with `NO_CREDENTIALS` — the GitHub
source-control connector is not linked. Fall back to the personal access token
stored as a Replit Secret.

## Rule

Authenticate git-over-HTTPS with a **Basic** auth header built from
`x-access-token:<token>`, not a Bearer header:

```bash
AUTH=$(printf 'x-access-token:%s' "$GITHUB_PERSONAL_ACCESS_TOKEN" | base64 -w0)
git -c "http.extraHeader=Authorization: Basic ${AUTH}" push origin main
```

**Why:** GitHub's Git HTTP endpoint rejects `Authorization: Bearer <token>` with
`remote: invalid credentials`, even when the exact same token returns HTTP 200
from `api.github.com/user` and reports `push: true` on the repo. Only the REST
API accepts Bearer. A rejected push is therefore not proof of a bad token —
verify against the REST API before asking the user for a new one.

Also note there is a stale inline-credential remote (`github`) whose embedded
token is dead; pushing to it fails with "Password authentication is not
supported". Use `origin` with the header above.

**How to apply:** Any time code needs to reach GitHub from this repl — pushes,
fetches, or PR creation. Always pipe command output through
`sed -e "s/$GITHUB_PERSONAL_ACCESS_TOKEN/***/g"` so the token cannot land in
logs.

## Divergence handling

The user edits files directly on GitHub (notably `artifacts/met/app.json` build
number bumps), so `origin/main` regularly holds commits the repl does not have.
Never force-push. Fetch, confirm the remote-only commits do not overlap the
local changes, then merge and push.
