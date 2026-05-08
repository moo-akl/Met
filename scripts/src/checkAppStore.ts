/**
 * Checks App Store Connect for existing subscription products and their state.
 */
import { createSign } from "crypto";

const KEY_ID = process.env.ASC_KEY_ID!;
const ISSUER_ID = process.env.ASC_ISSUER_ID!;
const APP_ID = "6764364926";
const BASE = "https://api.appstoreconnect.apple.com/v1";

function buildPem(raw: string): string {
  const body = raw.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const wrapped = (body.match(/.{1,64}/g) ?? [body]).join("\n");
  return `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;
}
const PRIVATE_KEY = buildPem(process.env.ASC_PRIVATE_KEY!);

function derToIeeeP1363(der: Buffer): Buffer {
  let offset = 2;
  if (der[1]! > 0x80) offset += der[1]! - 0x80;
  offset++;
  const rLen = der[offset++]!;
  const r = der.subarray(offset, offset + rLen);
  offset += rLen;
  offset++;
  const sLen = der[offset++]!;
  const s = der.subarray(offset, offset + sLen);
  const pad = (buf: Buffer) => { const out = Buffer.alloc(32); buf.copy(out, 32 - Math.min(buf.length, 32), Math.max(0, buf.length - 32)); return out; };
  return Buffer.concat([pad(r), pad(s)]);
}

function makeJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" })).toString("base64url");
  const msg = `${header}.${payload}`;
  const sign = createSign("SHA256");
  sign.update(msg);
  const sig = derToIeeeP1363(sign.sign({ key: PRIVATE_KEY, format: "pem", type: "pkcs8" })).toString("base64url");
  return `${msg}.${sig}`;
}

async function asc(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${makeJwt()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ok: res.ok, json };
}

async function main() {
  // List all subscription groups
  const { json: groups } = await asc("GET", `/apps/${APP_ID}/subscriptionGroups?limit=50`) as {
    json: { data?: { id: string; attributes: { referenceName: string } }[] }
  };
  const groupList = (groups as { data: { id: string; attributes: { referenceName: string } }[] }).data ?? [];
  console.log(`\n=== SUBSCRIPTION GROUPS (${groupList.length}) ===`);

  for (const group of groupList) {
    console.log(`\n[${group.id}] ${group.attributes.referenceName}`);

    const { json: subs } = await asc("GET", `/subscriptionGroups/${group.id}/subscriptions?limit=50`) as {
      json: { data?: { id: string; attributes: { productId: string; name: string; subscriptionPeriod: string; state: string } }[] }
    };
    const subList = (subs as { data: { id: string; attributes: { productId: string; name: string; subscriptionPeriod: string; state: string } }[] }).data ?? [];

    for (const sub of subList) {
      const a = sub.attributes;
      console.log(`  [${sub.id}] ${a.productId} | ${a.subscriptionPeriod} | state=${a.state}`);

      // Check localizations
      const { json: locs } = await asc("GET", `/subscriptions/${sub.id}/subscriptionLocalizations`) as {
        json: { data?: { id: string; attributes: { locale: string; name: string; state: string } }[] }
      };
      const locList = (locs as { data?: { id: string; attributes: { locale: string; name: string; state: string } }[] }).data ?? [];
      for (const loc of locList) {
        console.log(`    [loc] ${loc.attributes.locale}: "${loc.attributes.name}" state=${loc.attributes.state}`);
      }

      // Check prices
      const { json: prices } = await asc("GET", `/subscriptions/${sub.id}/prices?limit=10`) as {
        json: { data?: { id: string }[] }
      };
      const priceCount = (prices as { data?: unknown[] }).data?.length ?? 0;
      console.log(`    [prices] ${priceCount} price(s) set`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
