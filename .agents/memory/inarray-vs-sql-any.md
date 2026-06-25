---
name: inArray vs sql ANY
description: Drizzle ORM array IN-query pattern — use inArray(), not sql ANY()
---

## Rule
Always use `inArray(column, array)` from `drizzle-orm` for "WHERE col IN (…)" queries.

**Why:** The codebase uses `inArray()` everywhere (ble.ts, reveals.ts). Using `sql\`col = ANY(arr)\`` is a raw-sql workaround that bypasses Drizzle's parameter safety and looks inconsistent in reviews.

**How to apply:** When querying by a list of IDs/UIDs, always `import { inArray } from "drizzle-orm"` and use `.where(inArray(table.col, ids))`. Never use `sql\`${col} = ANY(${ids})\``.
