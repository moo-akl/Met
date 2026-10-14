---
name: GitHub submission safety
description: Safe GitHub updates when this repl's main branch has diverged from the remote release branch.
---

Do not blindly push local `main` to the GitHub release branch. It may be dozens of
commits ahead while GitHub contains a newer version number or other direct edits.
For a narrow config fix, fetch the current GitHub file via the connected GitHub
integration, update only the required fields using its current blob SHA, and
verify the resulting commit. Do not assume that the GitHub API connection also
authenticates Git-over-HTTPS.

When publishing a feature-only change whose local commit is not present on
GitHub, compare the touched paths' parent blobs with the current remote tree.
Apply local versions only where the remote still matches the feature's base;
three-way merge paths changed on both sides. Build one commit on the current
remote tree and update the branch with `force: false`. Stop for unresolved
semantic conflicts rather than replacing remote files or pushing local history.

**Why:** GitHub receives direct edits outside the repl, and publishing the entire
local history can unintentionally revert release metadata or ship unrelated
changes. Local and remote commit histories can be unrelated even when many
touched-file blobs still match, so a file-level three-way merge can preserve
remote work without sending unrelated local history. The old Git-over-HTTPS
token stopped authenticating; the OAuth GitHub connection supports scoped REST
writes instead.

**How to apply:** Compare the branches and files first. For small file updates,
use the GitHub integration API with optimistic SHA checking. For a true full
branch sync, obtain a working Git authentication path, review divergence, merge
without force, and confirm the broader scope before publishing it. For a
feature-only patch, use GitHub's Git Data API to create a tree based on current
`main`, a single commit parented to that head, and a non-forced ref update;
verify the resulting ref and changed-file list.

For native-build verification without release approval, use an isolated branch
based on current GitHub `main` and dispatch the existing workflow with submission
explicitly disabled. Regenerate its lockfile against that branch's manifests,
not the local workspace manifests, while retaining the security overrides.

**Why:** GitHub's manifests can differ from the workspace even when the mobile
manifest matches. Copying the workspace lockfile then fails the initial frozen
install before EAS's pre-install hook can regenerate it. Missing generated files
already referenced by GitHub can independently fail the post-install type gate.

**How to apply:** Compare manifest hashes and restore only missing referenced
files on the verification branch. Do not relax frozen installation, security
pins, or the type gate to make a build pass, and do not update release `main`
or submit the resulting binary without approval.

Report build verification with its branch and platform/profile, and explicitly
state when fixes have not reached release `main`.

**Why:** A successful review-branch build does not repair the default branch.
An unqualified success update led to a default-branch rebuild of the same old
generated-type failures.

**How to apply:** Distinguish verified review code from the release branch in
progress updates. Check a user-reported failure's actual run and commit before
diagnosing it as a new regression or a signing failure.

GitHub repository access does not necessarily include permission to change
Actions workflow files. Check OAuth scopes when ordinary source writes succeed
but trees containing `.github/workflows/` fail. `repo` alone does not include the
OAuth `workflow` scope.

**Why:** The connected credential could create a source-only Git tree, while the
same operation containing a workflow update returned 404. Its authorization
context showed repository access but no workflow scope.

**How to apply:** Preserve the source patch on a review branch. Do not repeatedly
retry or assume a healthy repository connection is expired; obtain a credential
with workflow-write permission through the secure secrets flow when the
connector's configured scopes cannot provide it.

Validate write permission per operation: reading Actions and writing workflow
files do not imply permission to dispatch runs or edit pull requests.

**Why:** The workflow-scoped credential could read run status but received 403
for dispatch and pull-request updates; the existing repository OAuth connection
could perform those operations.

**How to apply:** Use the working repository connection for dispatch and
pull-request updates, and the workflow-capable secret for workflow-file writes.
Recheck scopes if authorization changes; do not replace a healthy connection
just because a different credential lacks one permission.

Do not assume read-only explorer helpers have the integration sandbox available.
Keep integration-backed monitoring in the main agent unless the helper's tools
are known to support it.

**Why:** A monitoring helper could read integration instructions but had only
file/shell tools, so it could not call the documented connector callbacks.

**How to apply:** Check the helper's reported capabilities rather than repeatedly
delegating the same unavailable API operation. For background monitoring, use
read-only status requests with credentials consumed only inside the program and
emit safe status metadata, never raw build logs or credential values.

When verifying a narrow patch in an isolated checkout of live GitHub, reuse
installed external dependencies but recreate workspace-package symlinks inside
that checkout. Do not link its entire package node_modules directory to the
original workspace.

**Why:** Internal workspace symlinks otherwise resolve back to the original
repl's generated libraries. Tests and typechecks can falsely pass against
unpublished local changes rather than the exact code being sent to GitHub.

**How to apply:** Regenerate API libraries from the isolated checkout's own
specification, build them there, and verify every `@workspace` link resolves
inside that checkout before testing the outgoing patch.

Audit the outgoing specification diff before accepting regenerated API output.
For files edited after the original feature commit, compare against that commit
and merge only the new delta onto the remote file; do not copy the whole local
file simply because it was absent from the original feature-path list.

**Why:** A staged generator and typecheck can pass while validating unrelated
local API endpoints accidentally copied into the specification. The generated
types amplify the scope error, so passing checks do not prove a narrow patch.

**How to apply:** Inspect endpoint/schema additions against the authorized scope,
restore the remote specification if needed, apply only the intended contract
changes, and regenerate from that corrected staged source. Review changed paths
and diff sizes as well as test results before creating the GitHub tree.

When a staging call loses its worker or response, inspect its temporary checkout
before retrying. Verify the checkout's baseline tree against the remote tree.

**Why:** Archive extraction and baseline creation can finish even when the tool
response is lost. Blindly repeating initialization can overwrite completed work.

**How to apply:** Resume from a hash-verified baseline instead of assuming that a
missing response means no filesystem work occurred.

Do not merge generated API declarations by appending supposedly missing models.
Prefer regeneration from the merged specification.

**Why:** Regex-based declaration matching can miss multiline exports and append
identical enum/type blocks, breaking the native build's TypeScript gate despite
a clean Git diff. Export-only merging can also drop private utility types still
referenced by generated hooks.

**How to apply:** If regeneration is intentionally skipped, compare declarations
with the TypeScript AST using both declaration kind and name, including private
helper declarations. An enum's type and constant may legitimately share a name,
but duplicate declarations within either kind must not remain. Run the complete
shared-library compiler gate against the exact outgoing checkout, not only a
schema or generated-client package. A passing isolated package can still leave
missing imports in the other libraries checked by the native build.

When moving newer generated query blocks onto an older client baseline, include
their imported types and private helper dependencies even when those declarations
were already present in the feature's local base and are absent from its diff.

**Why:** A feature-only generated-code merge omitted dependencies that the older
GitHub client did not contain; the full shared-library compiler caught them.

**How to apply:** Inspect the new blocks' dependency closure against the actual
destination client, preserving its existing helper definitions and imports.

Use base64-encoded Git blob uploads and SHA-only tree entries through the GitHub
connector when raw source uploads receive non-JSON forbidden responses.

**Why:** Raw TypeScript source was rejected, while the same bytes uploaded as
base64 succeeded with the existing healthy connection.

**How to apply:** Verify each returned blob SHA against its Git blob hash, then
create a tree based on the current remote tree and update the ref without force.
Do not assume a content-dependent rejection means the credential is expired.
