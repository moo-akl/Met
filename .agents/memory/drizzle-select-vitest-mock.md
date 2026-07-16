---
name: Drizzle select in vitest mocks — not iterable
description: Why db.select().from().where() causes "not iterable" in vitest and how to guard against it.
---

## The rule

Never use array destructuring directly on a Drizzle `select().from().where()` or `select().from().where().limit()` result in route handlers. Use an `Array.isArray()` guard instead.

**Wrong:**
```typescript
const [{ pioneerCount }] = await db.select({ pioneerCount: sql`count(*)` }).from(t).where(eq(t.col, val));
const [row] = await db.select({ field: t.field }).from(t).where(...).limit(1);
```

**Correct:**
```typescript
const countRows = await db.select({ pioneerCount: sql`count(*)` }).from(t).where(eq(t.col, val));
const count = Array.isArray(countRows) ? Number(countRows[0]?.pioneerCount ?? 0) : 0;

const rows = await db.select({ field: t.field }).from(t).where(...).limit(1);
const value = Array.isArray(rows) ? rows[0]?.field : undefined;
```

**Why:** In the API server vitest test suite, the DB is mocked with a fluent chain where every method (`select`, `from`, `where`, `limit`) returns `this` via `mockReturnThis()`. Awaiting the chain object (which has no `.then()`) resolves to the chain object itself — not an array. Destructuring a non-array throws `TypeError: (intermediate value) is not iterable`. `Array.isArray(chain)` is `false`, so the guard safely defaults without throwing.

In production, Drizzle query builders are thenables that resolve to arrays, so `Array.isArray` is `true` and the path works correctly.

**How to apply:** Any new `db.select()` call in route handlers that is directly `await`-ed and whose result is consumed (not via `.returning()` on an INSERT) should use this guard. The `insert().values().onConflictDoUpdate().returning()` pattern is fine because `returning()` is separately mocked to resolve with arrays in tests.
