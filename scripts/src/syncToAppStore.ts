/**
 * Creates the 4 Met subscription products in App Store Connect
 * using the App Store Connect API (JWT auth).
 *
 * Products created:
 *   met_plus_monthly  — Met Plus Monthly (1 month)
 *   met_plus_yearly   — Met Plus Yearly  (1 year)
 *   met_pro_monthly   — Met Pro Monthly  (1 month)
 *   met_pro_yearly    — Met Pro Yearly   (1 year)
 */
import { createSign } from "crypto";

// Convert DER-encoded ECDSA signature → fixed-length IEEE P1363 (r‖s, 32 B each)
function derToIeeeP1363(der: Buffer): Buffer {
  let offset = 2; // skip SEQUENCE tag + length
  if (der[1]! > 0x80) offset += der[1]! - 0x80; // long-form length
  // r
  offset++; // INTEGER tag
  const rLen = der[offset++]!;
  const r = der.subarray(offset, offset + rLen);
  offset += rLen;
  // s
  offset++; // INTEGER tag
  const sLen = der[offset++]!;
  const s = der.subarray(offset, offset + sLen);
  // Pad/trim to 32 bytes each
  const pad = (buf: Buffer) => {
    const out = Buffer.alloc(32);
    buf.copy(out, 32 - Math.min(buf.length, 32), Math.max(0, buf.length - 32));
    return out;
  };
  return Buffer.concat([pad(r), pad(s)]);
}

const KEY_ID = process.env.ASC_KEY_ID!;
const ISSUER_ID = process.env.ASC_ISSUER_ID!;

// Reconstruct a properly-formatted PEM from the secret value, which may be
// stored without headers/newlines depending on how Replit persisted it.
function buildPem(raw: string): string {
  const body = raw.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const wrapped = (body.match(/.{1,64}/g) ?? [body]).join("\n");
  return `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;
}
const PRIVATE_KEY = buildPem(process.env.ASC_PRIVATE_KEY!);
// App Store Connect app ID for app.met.founders
const APP_ID = "6764364926";
const BASE = "https://api.appstoreconnect.apple.com/v1";

// ─── JWT ─────────────────────────────────────────────────────────────────────

function makeJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" })).toString("base64url");
  const msg = `${header}.${payload}`;
  const sign = createSign("SHA256");
  sign.update(msg);
  // Apple's P8 keys are EC keys — use DER encoding then convert DER (r||s) to IEEE P1363
  const derSig = sign.sign({ key: PRIVATE_KEY, format: "pem", type: "pkcs8" });
  // Convert DER-encoded ECDSA signature to fixed-length IEEE P1363 (r || s, 32 bytes each)
  const sig = derToIeeeP1363(derSig).toString("base64url");
  return `${msg}.${sig}`;
}

async function asc(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${makeJwt()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ok: res.ok, json };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOrCreateSubscriptionGroup(name: string): Promise<string> {
  // List existing groups
  const { json: list } = await asc("GET", `/apps/${APP_ID}/subscriptionGroups?limit=50`) as { json: { data?: { id: string; attributes: { referenceName: string } }[] } };
  const existing = (list as { data?: { id: string; attributes: { referenceName: string } }[] }).data?.find(
    (g) => g.attributes.referenceName === name,
  );
  if (existing) {
    console.log(`✓ Subscription group exists: "${name}" → ${existing.id}`);
    return existing.id;
  }

  const { status, json: created } = await asc("POST", "/subscriptionGroups", {
    data: {
      type: "subscriptionGroups",
      attributes: { referenceName: name },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    },
  }) as { status: number; json: { data?: { id: string } } };

  if (status !== 201) throw new Error(`Failed to create subscription group: ${JSON.stringify(created)}`);
  const groupId = (created as { data: { id: string } }).data.id;
  console.log(`+ Created subscription group: "${name}" → ${groupId}`);
  return groupId;
}

type Subscription = {
  productId: string;
  name: string;          // localized display name
  referenceName: string; // internal reference (unique per app)
  duration: "ONE_MONTH" | "ONE_YEAR";
  groupId: string;
  usdPrice: string;      // e.g. "1.99"
};

async function getOrCreateSubscription(sub: Subscription): Promise<string> {
  // Check if product already exists in this group
  const { json: list } = await asc(
    "GET",
    `/subscriptionGroups/${sub.groupId}/subscriptions?limit=50`,
  ) as { json: { data?: { id: string; attributes: { productId: string } }[] } };

  const existing = (list as { data?: { id: string; attributes: { productId: string } }[] }).data?.find(
    (s) => s.attributes.productId === sub.productId,
  );
  if (existing) {
    console.log(`✓ Subscription exists: ${sub.productId} → ${existing.id}`);
    return existing.id;
  }

  const { status, json: created } = await asc("POST", "/subscriptions", {
    data: {
      type: "subscriptions",
      attributes: {
        productId: sub.productId,
        name: sub.referenceName,
        subscriptionPeriod: sub.duration,
        reviewNote: "Standard subscription offering for Met social app.",
        groupLevel: 1,
      },
      relationships: {
        group: { data: { type: "subscriptionGroups", id: sub.groupId } },
      },
    },
  }) as { status: number; json: { data?: { id: string }; errors?: unknown } };

  if (status !== 201) {
    console.error(`✗ Failed to create ${sub.productId} (${status}):`, JSON.stringify((created as { errors?: unknown }).errors ?? created));
    return "";
  }
  const subId = (created as { data: { id: string } }).data.id;
  console.log(`+ Created subscription: ${sub.productId} → ${subId}`);
  return subId;
}

async function addLocalization(subscriptionId: string, productName: string) {
  // Check if English localization already exists
  const { json: list } = await asc("GET", `/subscriptions/${subscriptionId}/subscriptionLocalizations`) as {
    json: { data?: { id: string; attributes: { locale: string } }[] }
  };
  const hasEn = (list as { data?: { attributes: { locale: string } }[] }).data?.some((l) => l.attributes.locale === "en-US");
  if (hasEn) {
    console.log(`  ✓ Localization already exists for ${productName}`);
    return;
  }

  const { status, json } = await asc("POST", "/subscriptionLocalizations", {
    data: {
      type: "subscriptionLocalizations",
      attributes: {
        locale: "en-US",
        name: productName,
        description: `${productName} — unlock premium features in the Met app.`,
      },
      relationships: {
        subscription: { data: { type: "subscriptions", id: subscriptionId } },
      },
    },
  });
  if (status !== 201) {
    console.warn(`  ✗ Localization failed for ${productName} (${status}):`, JSON.stringify(json));
  } else {
    console.log(`  + Added localization for ${productName}`);
  }
}

async function addPrice(subscriptionId: string, productId: string, usdPrice: string) {
  // Check existing prices
  const { json: list } = await asc("GET", `/subscriptions/${subscriptionId}/prices?limit=50`) as {
    json: { data?: unknown[] }
  };
  if ((list as { data?: unknown[] }).data && (list as { data: unknown[] }).data.length > 0) {
    console.log(`  ✓ Price already set for ${productId}`);
    return;
  }

  // Get the price point for USD
  const { json: pricePoints } = await asc(
    "GET",
    `/subscriptions/${subscriptionId}/pricePoints?filter[territory]=USA&limit=100`,
  ) as { json: { data?: { id: string; attributes: { customerPrice: string; proceeds: string } }[] } };

  const point = (pricePoints as { data?: { id: string; attributes: { customerPrice: string } }[] }).data?.find(
    (p) => p.attributes.customerPrice === usdPrice,
  );

  if (!point) {
    // List available prices near our target for debugging
    const available = (pricePoints as { data?: { id: string; attributes: { customerPrice: string } }[] }).data
      ?.map((p) => p.attributes.customerPrice)
      .slice(0, 10);
    console.warn(`  ✗ Price point $${usdPrice} not found for ${productId}. Available: ${available?.join(", ")}`);
    // Use closest available price
    const fallback = (pricePoints as { data?: { id: string; attributes: { customerPrice: string } }[] }).data?.[0];
    if (!fallback) return;
    console.log(`  ~ Using fallback price: $${fallback.attributes.customerPrice}`);

    await asc("POST", `/subscriptions/${subscriptionId}/prices`, {
      data: {
        type: "subscriptionPrices",
        attributes: { preserveCurrentPrice: false, recurring: "RECURRING" },
        relationships: {
          subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: fallback.id } },
          subscription: { data: { type: "subscriptions", id: subscriptionId } },
        },
      },
    });
    return;
  }

  const { status, json } = await asc("POST", `/subscriptions/${subscriptionId}/prices`, {
    data: {
      type: "subscriptionPrices",
      attributes: { preserveCurrentPrice: false, recurring: "RECURRING" },
      relationships: {
        subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: point.id } },
        subscription: { data: { type: "subscriptions", id: subscriptionId } },
      },
    },
  });
  if (status !== 201) {
    console.warn(`  ✗ Price failed for ${productId} (${status}):`, JSON.stringify(json));
  } else {
    console.log(`  + Set price $${usdPrice} for ${productId}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Connecting to App Store Connect…\n");

  // Verify auth works
  const { status: authStatus, json: appInfo } = await asc("GET", `/apps/${APP_ID}`) as {
    status: number; json: { data?: { attributes?: { name?: string } }; errors?: unknown }
  };
  if (authStatus !== 200) {
    throw new Error(`Auth failed (${authStatus}): ${JSON.stringify((appInfo as { errors?: unknown }).errors ?? appInfo)}`);
  }
  console.log(`✓ Authenticated — app: ${(appInfo as { data: { attributes: { name: string } } }).data.attributes.name}\n`);

  const groupId = await getOrCreateSubscriptionGroup("Met Subscriptions");
  console.log();

  const products: Subscription[] = [
    { productId: "met_plus_monthly", name: "Met Plus Monthly", referenceName: "Met Plus Monthly", duration: "ONE_MONTH", groupId, usdPrice: "1.99" },
    { productId: "met_plus_yearly",  name: "Met Plus Yearly",  referenceName: "Met Plus Yearly",  duration: "ONE_YEAR",  groupId, usdPrice: "18.99" },
    { productId: "met_pro_monthly",  name: "Met Pro Monthly",  referenceName: "Met Pro Monthly",  duration: "ONE_MONTH", groupId, usdPrice: "3.49" },
    { productId: "met_pro_yearly",   name: "Met Pro Yearly",   referenceName: "Met Pro Yearly",   duration: "ONE_YEAR",  groupId, usdPrice: "34.99" },
  ];

  for (const product of products) {
    console.log(`\n--- ${product.productId} ---`);
    const subId = await getOrCreateSubscription(product);
    if (!subId) continue;
    await addLocalization(subId, product.name);
    await addPrice(subId, product.productId, product.usdPrice);
  }

  console.log("\n========================================");
  console.log("Done! All 4 products created in App Store Connect.");
  console.log("Force-quit and reopen the Met app to see subscription plans.");
  console.log("========================================\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
