---
name: Merge setup safety
description: Safe automatic setup and pnpm override-related frozen-lockfile failures.
---

Automatic merge setup installs locked dependencies and rebuilds shared libraries.
Do not add GitHub publishing, force-pushes, or unattended database schema pushes.

**Why:** The local branch and GitHub release branch can diverge, so automatic
force-publishing can discard remote work. A setup retry must not change external
release state or data.

**How to apply:** Keep publishing and reviewed schema changes separate from
repeatable dependency setup. Preserve frozen-lockfile validation rather than
silently resolving dependencies after every merge.

pnpm workspace overrides can change the effective importer specifier even when
the manifest and old lockfile display the same semver range.

**Why:** A YAML security override required an exact lockfile importer specifier;
the manifest's matching caret range alone did not satisfy a frozen install.

**How to apply:** Check workspace overrides when a mismatch message contradicts
the visible manifest. Regenerate the lockfile deliberately, inspect the diff,
and verify the actual configured merge setup succeeds.

When a merged feature changes the schema, explicitly review and apply its
development database changes before recommending Publish. Dependency setup and
successful typechecks do not prove that the development schema was updated.

**Why:** Keeping schema pushes out of automatic setup means a merge can leave
both development and production missing fields required by the new code.
Publish compares the actual development schema against production, not merely
the Drizzle source files.

**How to apply:** For schema-related failures, check both environments read-only,
apply the reviewed development schema through the project's normal push command,
verify the affected flow, and ask the user to republish for managed production.
