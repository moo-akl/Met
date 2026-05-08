/**
 * Deep diagnostic: for every package in every offering, show which products
 * are attached and which app/store they belong to.
 */
import {
  listApps,
  listAppPublicApiKeys,
  listOfferings,
  listPackages,
  listProducts,
} from "@replit/revenuecat-sdk";
import { getUncachableRevenueCatClient } from "./revenueCatClient.ts";

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID!;

async function main() {
  const client = await getUncachableRevenueCatClient();

  // All apps → id/name/bundleId/apiKey map
  const { data: appsData } = await listApps({ client, path: { project_id: PROJECT_ID }, query: { limit: 20 } });
  const apps = appsData?.items ?? [];
  console.log("\n=== APPS ===");
  const appInfo: Record<string, { name: string; type: string; bundleOrPackage: string; apiKeys: string[] }> = {};
  for (const app of apps) {
    const bundle = (app as { app_store?: { bundle_id?: string }; play_store?: { package_name?: string } });
    const bundleId = bundle.app_store?.bundle_id ?? bundle.play_store?.package_name ?? "(none)";
    const { data: keys } = await listAppPublicApiKeys({ client, path: { project_id: PROJECT_ID, app_id: app.id } });
    const keyList = keys?.items?.map((k) => k.key) ?? [];
    appInfo[app.id] = { name: app.name, type: app.type, bundleOrPackage: bundleId, apiKeys: keyList };
    console.log(`  [${app.type}] ${app.name} (${app.id})`);
    console.log(`    bundle/package: ${bundleId}`);
    console.log(`    API keys: ${keyList.join(", ") || "(none)"}`);
  }

  // All products
  const { data: productsData } = await listProducts({ client, path: { project_id: PROJECT_ID }, query: { limit: 100 } });
  const products = productsData?.items ?? [];
  const productMap: Record<string, { storeId: string; appId: string; appName: string; bundleId: string }> = {};
  for (const p of products) {
    const info = appInfo[p.app_id];
    productMap[p.id] = {
      storeId: p.store_identifier,
      appId: p.app_id,
      appName: info?.name ?? "?",
      bundleId: info?.bundleOrPackage ?? "?",
    };
  }

  // Offerings + packages + attached products
  const { data: offeringsData } = await listOfferings({ client, path: { project_id: PROJECT_ID }, query: { limit: 20 } });
  console.log("\n=== OFFERINGS & PACKAGES (with products) ===");
  for (const offering of offeringsData?.items ?? []) {
    console.log(`\nOffering: ${offering.lookup_key} (current=${offering.is_current}) [${offering.id}]`);
    const { data: pkgsData } = await listPackages({ client, path: { project_id: PROJECT_ID, offering_id: offering.id }, query: { limit: 20 } });
    for (const pkg of pkgsData?.items ?? []) {
      console.log(`  Package: ${pkg.lookup_key} [${pkg.id}]`);

      // Fetch products attached to this package via REST
      const res = await fetch(`https://api.revenuecat.com/v2/projects/${PROJECT_ID}/packages/${pkg.id}/products?limit=50`, {
        headers: client.headers as Record<string, string>,
      });
      const json = await res.json() as { items?: { product_id: string; eligibility_criteria: string }[] };
      const attached = json.items ?? [];
      if (attached.length === 0) {
        console.log(`    ⚠️  NO PRODUCTS ATTACHED`);
      }
      for (const a of attached) {
        const p = productMap[a.product_id];
        console.log(`    ✓ product: ${p?.storeId ?? a.product_id} | app: ${p?.appName} (${p?.bundleId}) | criteria: ${a.eligibility_criteria}`);
      }
    }
  }

  // Which API key is in eas.json (the one baked into the iOS build)
  const easKey = "appl_MaVQlHLubCXRmZPewbuJiIruIhH";
  console.log(`\n=== API KEY CHECK ===`);
  console.log(`Key in eas.json: ${easKey}`);
  const matchingApp = Object.entries(appInfo).find(([, v]) => v.apiKeys.includes(easKey));
  if (matchingApp) {
    console.log(`→ Belongs to: ${matchingApp[1].name} (${matchingApp[0]}) bundle=${matchingApp[1].bundleOrPackage}`);
  } else {
    console.log(`→ ⚠️  NOT FOUND in any app's keys!`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
