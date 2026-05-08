/**
 * Attaches the correct products to every package in every offering.
 *
 * iOS  → appb7dc0345c3 (bundle: app.met.founders, key: appl_MaVQlHLubCXRmZPewbuJiIruIhH)
 *
 * Package mapping:
 *   default / $rc_monthly → met_plus_monthly
 *   default / $rc_annual  → met_plus_yearly
 *   pro     / $rc_monthly → met_pro_monthly
 *   pro     / $rc_annual  → met_pro_yearly
 */
import {
  listProducts,
  listOfferings,
  listPackages,
  getProductsFromPackage,
  attachProductsToPackage,
} from "@replit/revenuecat-sdk";
import { getUncachableRevenueCatClient } from "./revenueCatClient.ts";

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID!;
const IOS_APP_ID = "appb7dc0345c3";

const PLAN: Record<string, { offeringKey: string; packageKey: string }> = {
  met_plus_monthly: { offeringKey: "default", packageKey: "$rc_monthly" },
  met_plus_yearly:  { offeringKey: "default", packageKey: "$rc_annual" },
  met_pro_monthly:  { offeringKey: "pro",     packageKey: "$rc_monthly" },
  met_pro_yearly:   { offeringKey: "pro",     packageKey: "$rc_annual" },
};

async function main() {
  const client = await getUncachableRevenueCatClient();

  // 1. List all products and find iOS ones
  const { data: productsData } = await listProducts({
    client, path: { project_id: PROJECT_ID }, query: { limit: 100 },
  });
  const allProducts = productsData?.items ?? [];
  const iosProducts = allProducts.filter((p) => p.app_id === IOS_APP_ID);

  console.log(`\nTotal products: ${allProducts.length}, iOS products: ${iosProducts.length}`);
  for (const p of iosProducts) {
    console.log(`  ${p.id}  store_id=${p.store_identifier}`);
  }

  if (iosProducts.length === 0) {
    console.error("\n⚠️  No iOS products found for appb7dc0345c3. Run fixRevenueCatIOS.ts first.");
    process.exit(1);
  }

  // storeIdentifier → RC product id
  const storeToProductId: Record<string, string> = {};
  for (const p of iosProducts) {
    storeToProductId[p.store_identifier] = p.id;
  }

  // 2. Load offerings + packages
  const { data: offeringsData } = await listOfferings({
    client, path: { project_id: PROJECT_ID }, query: { limit: 20 },
  });

  // offeringKey → packageKey → packageId
  const packageMap: Record<string, Record<string, string>> = {};
  for (const offering of offeringsData?.items ?? []) {
    packageMap[offering.lookup_key] = {};
    const { data: pkgsData } = await listPackages({
      client, path: { project_id: PROJECT_ID, offering_id: offering.id }, query: { limit: 20 },
    });
    for (const pkg of pkgsData?.items ?? []) {
      packageMap[offering.lookup_key]![pkg.lookup_key] = pkg.id;
    }
  }

  console.log("\n=== Attaching products to packages ===");

  for (const [storeId, { offeringKey, packageKey }] of Object.entries(PLAN)) {
    const productId = storeToProductId[storeId];
    const packageId = packageMap[offeringKey]?.[packageKey];

    if (!productId) {
      console.log(`⚠️  No product for store_id=${storeId}`);
      continue;
    }
    if (!packageId) {
      console.log(`⚠️  No package for offering=${offeringKey} pkg=${packageKey}`);
      continue;
    }

    // Check what's already attached
    const { data: existing } = await getProductsFromPackage({
      client,
      path: { project_id: PROJECT_ID, package_id: packageId },
      query: { limit: 50 },
    });
    const alreadyAttached = (existing?.items ?? []).some((i) => i.id === productId);
    if (alreadyAttached) {
      console.log(`✓ Already attached: ${storeId} → ${offeringKey}/${packageKey}`);
      continue;
    }

    const { data, error } = await attachProductsToPackage({
      client,
      path: { project_id: PROJECT_ID, package_id: packageId },
      body: { products: [{ product_id: productId, eligibility_criteria: "all" }] },
    });

    if (error) {
      console.error(`✗ Failed ${storeId}: ${JSON.stringify(error)}`);
    } else {
      console.log(`+ Attached: ${storeId} → ${offeringKey}/${packageKey} (response items: ${data?.product_ids?.length ?? "?"})`);
    }
  }

  // 3. Verify
  console.log("\n=== Verification ===");
  for (const offering of offeringsData?.items ?? []) {
    const { data: pkgsData } = await listPackages({
      client, path: { project_id: PROJECT_ID, offering_id: offering.id }, query: { limit: 20 },
    });
    for (const pkg of pkgsData?.items ?? []) {
      const { data: attached } = await getProductsFromPackage({
        client,
        path: { project_id: PROJECT_ID, package_id: pkg.id },
        query: { limit: 50 },
      });
      const items = attached?.items ?? [];
      const storeIds = items.map((i) => {
        const match = allProducts.find((p) => p.id === i.id);
        return match?.store_identifier ?? i.id;
      });
      const icon = items.length > 0 ? "✓" : "⚠️  EMPTY";
      console.log(`${icon} ${offering.lookup_key}/${pkg.lookup_key}: [${storeIds.join(", ")}]`);
    }
  }

  console.log("\nDone. Force-quit the app and reopen to reload offerings from RevenueCat.");
}

main().catch((e) => { console.error(e); process.exit(1); });
