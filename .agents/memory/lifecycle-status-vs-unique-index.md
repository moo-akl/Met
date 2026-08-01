---
name: Lifecycle terminal states vs. unique indexes
description: When a status column has terminal states that "release" a scarce resource, the uniqueness constraint must be partial, or the release is a lie.
---

# Terminal lifecycle states need partial unique indexes

When a table models an application/claim lifecycle where some statuses are
terminal and are meant to *release* a claimed resource (a place, a slug, a
handle), a plain global unique index on that resource column silently defeats
the lifecycle. Route code can look completely correct — checking status before
inserting — while the database still rejects the insert.

Use a partial unique index that excludes terminal states, e.g. unique on the
resource column `WHERE status NOT IN ('withdrawn', 'expired')`. In Drizzle:
`uniqueIndex(name).on(col).where(sql\`...\`)`.

**Why:** In the venue application lifecycle, expiry was changed from deleting
rows to transitioning them to a terminal status (to preserve audit history).
The route layer treated terminal statuses as reclaimable, but the unchanged
global unique index meant every reclaim failed with a duplicate-key error
surfaced as a 409. Retaining rows for audit and keeping global uniqueness are
directly incompatible.

**How to apply:** Any time you convert a hard delete into a soft/terminal
status transition, audit every unique index on that table. If a column
represented "only one live claim", the index must become partial. Verify with
`SELECT indexdef FROM pg_indexes WHERE indexname = '...'` after pushing.

**Testing note:** Mocked query-builder tests cannot prove index behavior —
they never reach Postgres. Constraint semantics need a real-database test.
Drizzle wraps driver errors in `DrizzleQueryError`, so the SQLSTATE (`23505`)
and `constraint` name live on `error.cause`, not on the thrown error.
