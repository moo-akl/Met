/**
 * Check entitlements and verify products are attached to them.
 * RevenueCat needs entitlement→product links for offerings to work.
 */
import {
  listEntitlements,
  getProductsFromEntitlement,
  attachProductsToEntitlement,
  listProducts,
} from "@replit/revenuecat-sdk";
import { getUncachableRevenueCatClient } from "./revenueCatClient.ts";

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID!;
const IOS_APP_ID = "appb7dc0345c3";

// Which store products belong in which entitlement
const ENTITLEMENT_PRODUCTS: Record<string, string[]> = {
  plus: ["met_plus_monthly", "met_plus_yearly", "met_pro_monthly", "met_pro_yearly"],
  pro:  ["met_pro_monthly", "met_pro_yearly"],
};

async function main() {
  const client = await getUncachableRevenueCatClient();

  // Get all iOS products
  const { data: productsData } = await listProducts({
    client, path: { project_id: PROJECT_ID }, query: { limit: 100 },
  });
  const iosProducts = (productsData?.items ?? []).filter((p) => p.app_id === IOS_APP_ID);
  const storeToId: Record<string, string> = {};
  for (const p of iosProducts) storeToId[p.store_identifier] = p.id;

  console.log(`iOS products: ${iosProducts.map((p) => p.store_identifier).join(", ")}`);

  // List entitlements
  const { data: entData } = await listEntitlements({
    client, path: { project_id: PROJECT_ID }, query: { limit: 20 },
  });
  const entitlements = entData?.items ?? [];

  console.log(`\n=== Entitlements (${entitlements.length}) ===`);

  for (const ent of entitlements) {
    console.log(`\nEntitlement: ${ent.lookup_key} [${ent.id}]`);

    // Get current products attached
    const { data: prodData } = await getProductsFromEntitlement({
      client,
      path: { project_id: PROJECT_ID, entitlement_id: ent.id },
      query: { limit: 50 },
    });
    const attached = prodData?.items ?? [];
    const attachedIds = attached.map((p) => p.id);
    const attachedStoreIds = attached.map((p) => p.store_identifier ?? p.id);
    console.log(`  Attached: [${attachedStoreIds.join(", ") || "none"}]`);

    // Determine which products should be attached
    const targetStoreIds = ENTITLEMENT_PRODUCTS[ent.lookup_key] ?? [];
    const missing = targetStoreIds.filter(
      (sid) => storeToId[sid] && !attachedIds.includes(storeToId[sid]!),
    );

    if (missing.length === 0) {
      console.log(`  ✓ All needed products attached`);
      continue;
    }

    console.log(`  ⚠️  Missing: [${missing.join(", ")}] — attaching now…`);
    const missingProductIds = missing.map((s) => storeToId[s]!).filter(Boolean);

    const { error } = await attachProductsToEntitlement({
      client,
      path: { project_id: PROJECT_ID, entitlement_id: ent.id },
      body: { product_ids: missingProductIds },
    });

    if (error) {
      console.error(`  ✗ Failed: ${JSON.stringify(error)}`);
    } else {
      console.log(`  + Attached ${missingProductIds.length} product(s) to "${ent.lookup_key}"`);
    }
  }

  console.log("\n=== Final entitlement state ===");
  for (const ent of entitlements) {
    const { data: prodData } = await getProductsFromEntitlement({
      client,
      path: { project_id: PROJECT_ID, entitlement_id: ent.id },
      query: { limit: 50 },
    });
    const items = prodData?.items ?? [];
    const iosItems = items.filter((p) => iosProducts.some((ip) => ip.id === p.id));
    console.log(`${ent.lookup_key}: ${items.length} total (${iosItems.length} iOS) → [${items.map((p) => p.store_identifier ?? p.id).join(", ")}]`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
