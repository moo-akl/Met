/**
 * Full RevenueCat status for all iOS apps — products, packages, entitlements.
 */
import {
  listApps,
  listAppPublicApiKeys,
  listProducts,
  listOfferings,
  listPackages,
  getProductsFromPackage,
  listEntitlements,
  getProductsFromEntitlement,
} from "@replit/revenuecat-sdk";
import { getUncachableRevenueCatClient } from "./revenueCatClient.ts";

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID!;

async function main() {
  const client = await getUncachableRevenueCatClient();

  // All apps
  const { data: appsData } = await listApps({ client, path: { project_id: PROJECT_ID }, query: { limit: 20 } });
  const apps = appsData?.items ?? [];

  // All products
  const { data: productsData } = await listProducts({ client, path: { project_id: PROJECT_ID }, query: { limit: 100 } });
  const allProducts = productsData?.items ?? [];

  // All entitlements
  const { data: entData } = await listEntitlements({ client, path: { project_id: PROJECT_ID }, query: { limit: 20 } });
  const entitlements = entData?.items ?? [];

  // All offerings + packages
  const { data: offeringsData } = await listOfferings({ client, path: { project_id: PROJECT_ID }, query: { limit: 20 } });
  const offerings = offeringsData?.items ?? [];

  const offeringPackages: Record<string, { id: string; key: string }[]> = {};
  for (const off of offerings) {
    const { data: pkgsData } = await listPackages({ client, path: { project_id: PROJECT_ID, offering_id: off.id }, query: { limit: 20 } });
    offeringPackages[off.id] = (pkgsData?.items ?? []).map((p) => ({ id: p.id, key: p.lookup_key }));
  }

  console.log("\n====================================================");
  console.log("  REVENUECAT FULL STATUS");
  console.log("====================================================");

  for (const app of apps) {
    if (app.type !== "app_store") continue;
    const { data: keys } = await listAppPublicApiKeys({ client, path: { project_id: PROJECT_ID, app_id: app.id } });
    const apiKey = keys?.items?.[0]?.key ?? "(none)";
    const bundle = (app as { app_store?: { bundle_id?: string } }).app_store?.bundle_id ?? "(none)";

    const appProducts = allProducts.filter((p) => p.app_id === app.id);
    console.log(`\n┌─ ${app.name} [${app.id}]`);
    console.log(`│  Bundle:  ${bundle}`);
    console.log(`│  API Key: ${apiKey}`);
    console.log(`│  Products (${appProducts.length}):`);
    for (const p of appProducts) {
      console.log(`│    • ${p.store_identifier}  [${p.id}]`);
    }

    // Which packages have these products?
    console.log(`│  Package links:`);
    for (const off of offerings) {
      for (const pkg of offeringPackages[off.id] ?? []) {
        const { data: pkgProds } = await getProductsFromPackage({
          client, path: { project_id: PROJECT_ID, package_id: pkg.id }, query: { limit: 50 },
        });
        const linked = (pkgProds?.items ?? []).filter((p) => appProducts.some((ap) => ap.id === p.id));
        if (linked.length > 0) {
          for (const lp of linked) {
            console.log(`│    ✓ ${off.lookup_key} / ${pkg.key}  →  ${lp.store_identifier}`);
          }
        }
      }
    }

    // Entitlements
    console.log(`│  Entitlement links:`);
    for (const ent of entitlements) {
      const { data: entProds } = await getProductsFromEntitlement({
        client, path: { project_id: PROJECT_ID, entitlement_id: ent.id }, query: { limit: 50 },
      });
      const linked = (entProds?.items ?? []).filter((p) => appProducts.some((ap) => ap.id === p.id));
      if (linked.length > 0) {
        for (const lp of linked) {
          console.log(`│    ✓ entitlement: ${ent.lookup_key}  →  ${lp.store_identifier}`);
        }
      }
    }
    console.log(`└${"─".repeat(50)}`);
  }

  console.log("\n====================================================");
  console.log("  OFFERINGS SUMMARY");
  console.log("====================================================");
  for (const off of offerings) {
    console.log(`\nOffering: "${off.lookup_key}"  current=${off.is_current}`);
    for (const pkg of offeringPackages[off.id] ?? []) {
      const { data: pkgProds } = await getProductsFromPackage({
        client, path: { project_id: PROJECT_ID, package_id: pkg.id }, query: { limit: 50 },
      });
      const items = pkgProds?.items ?? [];
      const summary = items.map((p) => {
        const match = allProducts.find((ap) => ap.id === p.id);
        const appMatch = apps.find((a) => a.id === match?.app_id);
        return `${match?.store_identifier ?? p.id} (${appMatch?.name ?? "?"})`;
      });
      const icon = items.length > 0 ? "✓" : "⚠️  EMPTY";
      console.log(`  ${icon}  ${pkg.key}: [${summary.join(", ")}]`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
