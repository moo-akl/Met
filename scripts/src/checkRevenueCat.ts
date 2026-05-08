import {
  listApps,
  listProducts,
  listEntitlements,
  listOfferings,
  listPackages,
} from "@replit/revenuecat-sdk";
import { getUncachableRevenueCatClient } from "./revenueCatClient.ts";

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID!;

async function main() {
  const client = await getUncachableRevenueCatClient();

  const { data: apps } = await listApps({ client, path: { project_id: PROJECT_ID }, query: { limit: 20 } });
  console.log("\n=== APPS ===");
  for (const app of apps?.items ?? []) {
    console.log(`  [${app.type}] ${app.name} (id=${app.id})`);
    if ("app_store" in app && app.app_store) console.log(`    bundle_id: ${(app.app_store as { bundle_id?: string }).bundle_id}`);
    if ("play_store" in app && app.play_store) console.log(`    package: ${(app.play_store as { package_name?: string }).package_name}`);
  }

  const { data: products } = await listProducts({ client, path: { project_id: PROJECT_ID }, query: { limit: 100 } });
  console.log("\n=== PRODUCTS ===");
  for (const p of products?.items ?? []) {
    console.log(`  ${p.store_identifier} | app_id=${p.app_id} | type=${p.type} | id=${p.id}`);
  }

  const { data: ents } = await listEntitlements({ client, path: { project_id: PROJECT_ID }, query: { limit: 20 } });
  console.log("\n=== ENTITLEMENTS ===");
  for (const e of ents?.items ?? []) {
    console.log(`  ${e.lookup_key} | ${e.display_name} | id=${e.id}`);
  }

  const { data: offerings } = await listOfferings({ client, path: { project_id: PROJECT_ID }, query: { limit: 20 } });
  console.log("\n=== OFFERINGS ===");
  for (const o of offerings?.items ?? []) {
    console.log(`  ${o.lookup_key} | current=${o.is_current} | id=${o.id}`);
    const { data: pkgs } = await listPackages({ client, path: { project_id: PROJECT_ID, offering_id: o.id }, query: { limit: 20 } });
    for (const pkg of pkgs?.items ?? []) {
      console.log(`    [pkg] ${pkg.lookup_key} | id=${pkg.id}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
