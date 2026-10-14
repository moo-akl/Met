---
name: Orval output compatibility
description: Keep generated API clients aligned with the workspace's Zod and TanStack Query versions.
---

When generating API code, target Zod 3 for the API schema package and TanStack Query 5 for the React client. Include `DOM.Iterable` in the client TypeScript libraries when generated fetch code uses `Headers.entries()`.

**Why:** With Orval 8.38, auto-detection from the API-spec package produced Zod 4 output even though the workspace schema package uses Zod 3, and React Query 4 hooks even though the client uses TanStack Query 5. The generated code then failed typechecking.

**How to apply:** Keep these generator targets explicit and run the library typecheck after regeneration. Revisit them if the workspace dependency versions change.

Pin the generator to the verified lockfile version rather than a floating range,
and validate repeat generation in a destination-based checkout with its own
workspace package links. Never borrow another checkout's node_modules.

**Why:** Borrowed workspace links can make a remote checkout's compiler silently
check newer local sources, hiding missing helpers or incompatible generated types.
A floating generator can also change output without a deliberate upgrade.

**How to apply:** For generator changes, check links, compare two complete
generation snapshots, and run both the full shared-library and mobile compiler
gates against the exact destination specification. Keep spec cleanup limited to
identical duplicates; do not import unrelated local contracts into the release.

Treat Orval's cleanup order as destructive: invalid input must be rejected while
loading the configuration, not in an input transformer.

**Why:** Orval with `clean: true` deletes generated output before input parsing
and transformation. A parse failure can otherwise erase both working libraries.

**How to apply:** Keep strict YAML validation ahead of generation, reject
identical as well as conflicting duplicate keys, and exercise the real CLI with
sentinel outputs in isolated fixtures when changing the generator pipeline.

CLI fixtures that borrow a pnpm package's node_modules also need access to the
origin checkout's root virtual store when testing a package script.

**Why:** pnpm's Orval command shim can resolve its executable relative to the
fixture workspace root, rather than follow the package-level symlink. The direct
Node CLI test passed while the public package-script test failed before Orval ran.

**How to apply:** Provide the originating root node_modules in isolated CLI
fixtures, and verify the expected generator diagnostic, not just a nonzero exit.
This is fixture-only; real destination-checkout verification still requires its
own installed dependencies and internal workspace links.
