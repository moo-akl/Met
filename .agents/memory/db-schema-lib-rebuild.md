---
name: Database schema type rebuild
description: Rebuild shared library types after database schema changes before checking the API server.
---

After adding or changing a column in `lib/db/src/schema`, run
`pnpm run typecheck:libs` before the API-server typecheck so downstream code
uses the updated Drizzle types.

**Why:** The server can compile against stale workspace declarations and report
that a new schema field does not exist.

**How to apply:** Rebuild shared library declarations first whenever a database
schema change is part of the work, then run the server typecheck.
