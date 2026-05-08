/**
 * Fixes RevenueCat iOS configuration:
 * - The active iOS App Store app in RevenueCat was registered with bundle ID
 *   com.metapp.ios, but the real app uses app.met.founders.
 * - A second App Store app (appb7dc0345c3) with the correct bundle ID exists
 *   but its products are not attached to any packages.
 * This script creates the missing iOS products for appb7dc0345c3 and attaches
 * them to the existing packages, then prints the correct iOS public API key.
 */
import {
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listOfferings,
  listPackages,
  attachProductsToPackage,
  attachProductsToEntitlement,
  listEntitlements,
  type App,
  type Product,
} from "@replit/revenuecat-sdk";
import { getUncachableRevenueCatClient } from "./revenueCatClient.ts";

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID!;
// Correct iOS app: app.met.founders
const CORRECT_IOS_APP_ID = "appb7dc0345c3";

const IOS_PLANS = [
  { store_identifier: "met_plus_monthly", display_name: "Met Plus Monthly", offering: "default", pkg: "$rc_monthly", entitlement: "plus" },
  { store_identifier: "met_plus_yearly",  display_name: "Met Plus Yearly",  offering: "default", pkg: "$rc_annual",  entitlement: "plus" },
  { store_identifier: "met_pro_monthly",  display_name: "Met Pro Monthly",  offering: "pro",     pkg: "$rc_monthly", entitlement: "pro"  },
  { store_identifier: "met_pro_yearly",   display_name: "Met Pro Yearly",   offering: "pro",     pkg: "$rc_annual",  entitlement: "pro"  },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const client = await getUncachableRevenueCatClient();

  // 1. Fetch existing products
  const { data: productsData, error: prodErr } = await listProducts({
    client, path: { project_id: PROJECT_ID }, query: { limit: 100 },
  });
  if (prodErr) throw new Error("Failed to list products: " + JSON.stringify(prodErr));

  // 2. Ensure each product exists for the correct iOS app
  const newProductIds: Record<string, string> = {};

  for (const plan of IOS_PLANS) {
    const existing = productsData.items?.find(
      (p) => p.store_identifier === plan.store_identifier && p.app_id === CORRECT_IOS_APP_ID,
    );
    if (existing) {
      console.log(`✓ Product already exists: ${plan.store_identifier} → ${existing.id}`);
      newProductIds[plan.store_identifier] = existing.id;
      continue;
    }

    const { data: created, error } = await createProduct({
      client,
      path: { project_id: PROJECT_ID },
      body: {
        store_identifier: plan.store_identifier,
        app_id: CORRECT_IOS_APP_ID,
        type: "subscription",
        display_name: plan.display_name,
      },
    });
    if (error) {
      console.error(`✗ Failed to create ${plan.store_identifier}:`, JSON.stringify(error));
      continue;
    }
    console.log(`+ Created product: ${plan.store_identifier} → ${created.id}`);
    newProductIds[plan.store_identifier] = created.id;
    await sleep(500);
  }

  // 3. Attach products to packages
  const { data: offerings } = await listOfferings({ client, path: { project_id: PROJECT_ID }, query: { limit: 20 } });
  for (const offering of offerings?.items ?? []) {
    const { data: packages } = await listPackages({ client, path: { project_id: PROJECT_ID, offering_id: offering.id }, query: { limit: 20 } });
    for (const pkg of packages?.items ?? []) {
      const plansForPkg = IOS_PLANS.filter((p) => p.offering === offering.lookup_key && p.pkg === pkg.lookup_key);
      if (plansForPkg.length === 0) continue;

      const productIds = plansForPkg.map((p) => newProductIds[p.store_identifier]).filter(Boolean);
      if (productIds.length === 0) continue;

      const { error } = await attachProductsToPackage({
        client,
        path: { project_id: PROJECT_ID, package_id: pkg.id },
        body: { products: productIds.map((id) => ({ product_id: id, eligibility_criteria: "all" })) },
      });
      if (error) {
        if ((error as { type?: string })?.type === "unprocessable_entity_error") {
          console.log(`  ~ Products already attached to package ${pkg.lookup_key} in ${offering.lookup_key}`);
        } else {
          console.error(`  ✗ Error attaching to ${pkg.lookup_key}:`, JSON.stringify(error));
        }
      } else {
        console.log(`  ✓ Attached to package ${pkg.lookup_key} in offering ${offering.lookup_key}`);
      }
      await sleep(300);
    }
  }

  // 4. Attach products to entitlements
  const { data: ents } = await listEntitlements({ client, path: { project_id: PROJECT_ID }, query: { limit: 20 } });
  const entMap = Object.fromEntries((ents?.items ?? []).map((e) => [e.lookup_key, e.id]));

  const plusIds = IOS_PLANS.filter((p) => p.entitlement === "plus").map((p) => newProductIds[p.store_identifier]).filter(Boolean);
  const proIds  = IOS_PLANS.filter((p) => p.entitlement === "pro").map((p) => newProductIds[p.store_identifier]).filter(Boolean);

  for (const [key, ids] of [["plus", plusIds], ["pro", proIds]] as [string, string[]][]) {
    if (!entMap[key] || ids.length === 0) continue;
    const { error } = await attachProductsToEntitlement({
      client,
      path: { project_id: PROJECT_ID, entitlement_id: entMap[key] },
      body: { product_ids: ids },
    });
    if (error && (error as { type?: string })?.type !== "unprocessable_entity_error") {
      console.error(`✗ Failed to attach products to entitlement ${key}:`, JSON.stringify(error));
    } else {
      console.log(`✓ Products attached to entitlement: ${key}`);
    }
    await sleep(300);
  }

  // 5. Print the public API key for the correct iOS app
  const { data: keys, error: keyErr } = await listAppPublicApiKeys({
    client, path: { project_id: PROJECT_ID, app_id: CORRECT_IOS_APP_ID },
  });
  if (keyErr) throw new Error("Failed to get API keys: " + JSON.stringify(keyErr));

  const iosKey = keys?.items?.[0]?.key;
  console.log("\n========================================");
  console.log("Correct iOS RevenueCat public API key:");
  console.log(" ", iosKey ?? "(none — check RevenueCat dashboard)");
  console.log("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=" + (iosKey ?? "???"));
  console.log("========================================\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
