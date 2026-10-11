# API generation

Use the locked Orval version with Node 22.18 or newer:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-spec run codegen
```

The config explicitly targets the client package's React Query 5 and the schema
package's Zod 3. Orval's own Zod dependency is not the schema runtime. Keep these
targets explicit when upgrading the generator. The client TypeScript config also
needs `dom.iterable` for generated `Headers.entries()` calls.

The config validates `openapi.yaml` before Orval can clean either output
directory. Malformed YAML and duplicate mapping keys (even identical duplicates)
fail with file/line diagnostics and leave existing generated files untouched.
This protection applies to both `codegen` and direct Orval invocations using the
config. It is a YAML preflight, not a transactional guarantee for later generator
or compiler failures.

Run the safety regression tests with:

```sh
pnpm --filter @workspace/api-spec test
```

They run the real generator in temporary fixtures, never against working outputs.

Do not splice generated endpoint blocks or manually restore private helpers.
Regenerate both outputs from the destination checkout's complete specification,
including their imported models and private helper dependencies.

To verify a generator upgrade or a GitHub release patch:

```sh
pnpm --filter @workspace/api-spec run verify-codegen
```

This checks that mobile and shared-library workspace dependencies resolve inside
the checkout, runs generation and the full shared-library compiler gate twice,
checks byte-for-byte repeatability and duplicate top-level type/value declarations,
then runs the mobile typecheck. It changes the generated files, but never runs
EAS or changes release numbers. Run it in an isolated checkout of the destination
branch with its own `pnpm install`; do not borrow another checkout's node_modules.
