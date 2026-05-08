/**
 * Raw HTTP diagnostic — dumps the exact JSON response for package products
 * and also tries to attach with the correct body format.
 */
import { getUncachableRevenueCatClient } from "./revenueCatClient.ts";

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID!;

// From diagRevenueCat.ts run:
const PACKAGES = {
  "default/$rc_monthly": "pkge1e6d75de6e",
  "default/$rc_annual":  "pkge79c3e0a57c",
  "pro/$rc_monthly":     "pkge4879fdfded",
  "pro/$rc_annual":      "pkgeaedc1fade5",
};

// iOS products from appb7dc0345c3
const IOS_PRODUCTS = {
  met_plus_monthly: "prod33a3e28e7a",
  met_plus_yearly:  "prodb46ca5f784",
  met_pro_monthly:  "proda2dc4870bb",
  met_pro_yearly:   "prod682389e1fd",
};

const PLAN: Record<string, string> = {
  "default/$rc_monthly": IOS_PRODUCTS.met_plus_monthly,
  "default/$rc_annual":  IOS_PRODUCTS.met_plus_yearly,
  "pro/$rc_monthly":     IOS_PRODUCTS.met_pro_monthly,
  "pro/$rc_annual":      IOS_PRODUCTS.met_pro_yearly,
};

async function main() {
  const client = await getUncachableRevenueCatClient();
  const headers = client.headers as Record<string, string>;

  console.log("\n=== RAW GET: package products ===");
  for (const [label, pkgId] of Object.entries(PACKAGES)) {
    const res = await fetch(`https://api.revenuecat.com/v2/projects/${PROJECT_ID}/packages/${pkgId}/products?limit=50`, {
      headers,
    });
    const json = await res.json();
    console.log(`${label} [${pkgId}] (${res.status}):`);
    console.log(JSON.stringify(json, null, 2).slice(0, 500));
  }

  console.log("\n=== RAW POST: attach_products ===");
  for (const [label, pkgId] of Object.entries(PACKAGES)) {
    const productId = PLAN[label]!;

    // Try format 1: { products: [{ product_id, eligibility_criteria }] }
    const body1 = { products: [{ product_id: productId, eligibility_criteria: "all" }] };
    const res1 = await fetch(`https://api.revenuecat.com/v2/projects/${PROJECT_ID}/packages/${pkgId}/actions/attach_products`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body1),
    });
    const json1 = await res1.json();
    console.log(`${label} format1 (${res1.status}): ${JSON.stringify(json1).slice(0, 300)}`);

    if (!res1.ok) {
      // Try format 2: { product_ids: [productId] }
      const body2 = { product_ids: [productId] };
      const res2 = await fetch(`https://api.revenuecat.com/v2/projects/${PROJECT_ID}/packages/${pkgId}/actions/attach_products`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body2),
      });
      const json2 = await res2.json();
      console.log(`${label} format2 (${res2.status}): ${JSON.stringify(json2).slice(0, 300)}`);
    }
  }

  // Re-check after attach attempts
  console.log("\n=== RAW GET after attach ===");
  for (const [label, pkgId] of Object.entries(PACKAGES)) {
    const res = await fetch(`https://api.revenuecat.com/v2/projects/${PROJECT_ID}/packages/${pkgId}/products?limit=50`, {
      headers,
    });
    const json = await res.json() as { items?: unknown[] };
    console.log(`${label}: ${json.items?.length ?? 0} product(s) → ${JSON.stringify(json.items ?? []).slice(0, 200)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
