---
name: Drizzle vitest mock — dispatch by table
description: How to avoid sequential-mock collisions when routes query multiple tables per request
---
When a route makes background queries (e.g. session/credential validation) on every request, a single shared Drizzle chain mock with sequential `mockResolvedValueOnce` breaks: the background queries consume the Onces intended for the test's main fixtures, causing cascading wrong-status failures. Also, `vi.clearAllMocks()` does not discard unconsumed `mockResolvedValueOnce` queues; reset the stateful query methods in `beforeEach` and restore their default implementations.

**Why:** the chain mock is FIFO and table-blind; any extra query shifts the queue, and an early validation return can leave a one-shot fixture queued for the next test.

**How to apply:** make `from`/`insert`/`update` `mockImplementation` dispatch on the table object — return a dedicated stateful mini-chain (backed by a mutable `rows` array reset in `beforeEach`) for the "background" table, keep the sequential chain for the table under test, and `mockReset()` methods that use one-shot fixtures before restoring defaults. If a locked query ends in `.orderBy(...).for("update")`, keep `orderBy` returning the chain and put the row fixture on `for`. Bonus: storing real hashes in the mini-store lets success-path login/change/recovery tests run end-to-end. See `artifacts/api-server/src/routes/venueAdminReview.test.ts`.
