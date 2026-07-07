---
name: iOS paywall "Plans aren't available" root cause
description: Why RevenueCat paywall shows empty on iOS — and how to diagnose vs. fix
---

## The Rule
"Plans aren't available right now" on iOS almost always means StoreKit returned no products — NOT a RevenueCat misconfiguration. The RevenueCat SDK filters packages client-side if StoreKit can't confirm pricing. Check Apple-side blockers before touching RevenueCat.

**Why:** RevenueCat's offerings API will return data even if products can't be purchased; it's the underlying StoreKit product fetch that empties `availablePackages`. This makes it look like RevenueCat isn't set up.

**How to apply:** Work through this checklist before modifying RevenueCat:
1. **Paid Applications Agreement** (most common) — must be Active in App Store Connect → Business → Agreements, Tax, and Banking. Even one missing field (tax form, bank account) leaves it Pending and StoreKit returns nothing for the app.
2. **Subscription state in ASC** — subscriptions in DEVELOPER_ACTION_NEEDED or REJECTED state are served by StoreKit but only when the agreement is active. Check via script `scripts/src/checkAppStore.ts`.
3. **Bundle ID match** — product identifiers in RevenueCat must exactly match ASC. Verify with `scripts/src/diagRevenueCat.ts` (but note: that script's raw fetch for package products has a 401 bug — use `client.get(...)` instead, see below).
4. **RevenueCat diagnostic script bug** — `diagRevenueCat.ts` uses `client.headers` in a raw fetch call, which is undefined on the openapi-fetch client. This causes 401s and falsely reports "NO PRODUCTS ATTACHED" even when products are correctly wired. To list products actually attached to a package, use: `client.get({ url: "/projects/{project_id}/packages/{package_id}/products", path: {...}, query: {limit: 50} })`.

## App Store Connect subscription review loop
When an app binary is rejected for Guideline 2.1(b) ("Plans aren't available"), any subscriptions bundled in that same submission move to DEVELOPER_ACTION_NEEDED. The localization `state: REJECTED` is a side-effect of the binary rejection, not independent content rejection. Fix the root cause (agreement/StoreKit), then resubmit the subscription for review.
