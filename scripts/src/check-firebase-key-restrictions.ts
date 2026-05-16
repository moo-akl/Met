/**
 * check-firebase-key-restrictions.ts
 *
 * Verifies (and optionally applies) API restrictions on the two Firebase API
 * keys embedded in Met's native builds.
 *
 * Usage:
 *   # Verify only:
 *   tsx scripts/src/check-firebase-key-restrictions.ts
 *
 *   # Apply iOS restrictions + API-only restrictions for Android:
 *   tsx scripts/src/check-firebase-key-restrictions.ts --apply \
 *     --sha1=<upload-key-SHA1> --sha1=<debug-key-SHA1>
 *
 * The --sha1 flag is REQUIRED when using --apply (Android app restriction
 * cannot be applied without at least one certificate fingerprint).
 *
 * Required env var (stored as a Replit secret):
 *   FIREBASE_SERVICE_ACCOUNT_JSON — full JSON content of the service account key
 *
 * The service account needs one of these IAM roles on the GCP project:
 *   roles/apikeys.viewer — verify only
 *   roles/apikeys.admin  — verify + apply
 *
 * Grant via Cloud Console:
 *   https://console.cloud.google.com/iam-admin/iam?project=metapp-b4642
 *
 * Exit codes:
 *   0 — all restrictions are in place
 *   1 — restrictions missing or error occurred
 */

import * as crypto from "crypto";
import * as https from "https";

const GCP_PROJECT = "metapp-b4642";
const GCP_AUTH_URL = "https://oauth2.googleapis.com/token";
const APIKEYS_BASE =
  `https://apikeys.googleapis.com/v2/projects/${GCP_PROJECT}/locations/global/keys`;

const ANDROID_KEY_STRING = "AIzaSyDBKgHSM-f34RZZdzORAO0ADcBYhYEKojA";
const IOS_KEY_STRING = "AIzaSyCIKGH3kMUp8uZtcglqrNN9kKxOAzB7Jt8";

const BUNDLE_ID = "app.met.founders";

const REQUIRED_SERVICES = [
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
  "firebaseinstallations.googleapis.com",
  "firestore.googleapis.com",
  "firebaseappcheck.googleapis.com",
  "fcm.googleapis.com",
];

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function httpsRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        ...headers,
        ...(body
          ? { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(body)) }
          : {}),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function apiGet<T>(url: string, token: string): Promise<T> {
  const { status, data } = await httpsRequest(url, "GET", {
    Authorization: `Bearer ${token}`,
  });
  const json = JSON.parse(data) as T;
  if (status >= 400) {
    const err = (json as { error?: { message: string } }).error;
    throw new GcpApiError(status, err?.message ?? data);
  }
  return json;
}

async function apiPatch<T>(url: string, token: string, body: unknown): Promise<T> {
  const payload = JSON.stringify(body);
  const { status, data } = await httpsRequest(url, "PATCH", {
    Authorization: `Bearer ${token}`,
  }, payload);
  const json = JSON.parse(data) as T;
  if (status >= 400) {
    const err = (json as { error?: { message: string } }).error;
    throw new GcpApiError(status, err?.message ?? data);
  }
  return json;
}

class GcpApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "GcpApiError";
  }
}

// ---------------------------------------------------------------------------
// GCP auth — service account JWT → access token
// ---------------------------------------------------------------------------

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function getAccessToken(sa: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = base64url(
    Buffer.from(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/cloud-platform",
        aud: GCP_AUTH_URL,
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const toSign = `${header}.${claim}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(toSign);
  const sig = base64url(signer.sign(sa.private_key));
  const jwt = `${toSign}.${sig}`;

  const params = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });
  const { data } = await httpsRequest(GCP_AUTH_URL, "POST", {
    "Content-Type": "application/x-www-form-urlencoded",
  }, params.toString());

  const result = JSON.parse(data) as { access_token?: string; error?: string };
  if (!result.access_token) {
    throw new Error(`Auth failed: ${result.error ?? data}`);
  }
  return result.access_token;
}

// ---------------------------------------------------------------------------
// API Key lookup by key string value
// ---------------------------------------------------------------------------

interface LookupKeyResponse {
  name: string;
  parent: string;
}

async function lookupKey(keyString: string, token: string): Promise<string> {
  const url = `${APIKEYS_BASE}:lookupKey?keyString=${encodeURIComponent(keyString)}`;
  const resp = await apiGet<LookupKeyResponse>(url, token);
  return resp.name;
}

// ---------------------------------------------------------------------------
// Key metadata
// ---------------------------------------------------------------------------

interface ApiTarget {
  service: string;
}

interface KeyRestrictions {
  androidKeyRestrictions?: {
    allowedApplications?: Array<{ packageName: string; sha1Fingerprint?: string }>;
  };
  iosKeyRestrictions?: {
    allowedBundleIds?: string[];
  };
  apiTargets?: ApiTarget[];
}

interface ApiKey {
  name: string;
  displayName?: string;
  restrictions?: KeyRestrictions;
}

async function getKey(resourceName: string, token: string): Promise<ApiKey> {
  return apiGet<ApiKey>(`https://apikeys.googleapis.com/v2/${resourceName}`, token);
}

// ---------------------------------------------------------------------------
// LRO polling
// ---------------------------------------------------------------------------

interface Operation {
  name?: string;
  done?: boolean;
  error?: { code: number; message: string };
  response?: unknown;
}

async function waitForOperation(op: Operation, token: string): Promise<void> {
  if (!op.name) return;
  let current = op;
  let attempts = 0;
  while (!current.done) {
    if (attempts++ > 20) {
      throw new Error(`LRO ${op.name} did not complete after 20 polls`);
    }
    await new Promise<void>((r) => setTimeout(r, 3000));
    current = await apiGet<Operation>(
      `https://apikeys.googleapis.com/v2/${op.name}`,
      token,
    );
  }
  if (current.error) {
    throw new Error(`LRO failed: [${current.error.code}] ${current.error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Restriction check
// ---------------------------------------------------------------------------

function checkRestrictions(
  key: ApiKey,
  platform: "android" | "ios",
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const r = key.restrictions;

  if (!r) {
    return { ok: false, issues: ["No restrictions configured"] };
  }

  if (platform === "ios") {
    const bundleIds = r.iosKeyRestrictions?.allowedBundleIds ?? [];
    if (!bundleIds.includes(BUNDLE_ID)) {
      issues.push(
        `iOS app restriction missing bundle ID "${BUNDLE_ID}"` +
          (bundleIds.length ? ` (found: ${bundleIds.join(", ")})` : " (none configured)"),
      );
    }
  } else {
    const apps = r.androidKeyRestrictions?.allowedApplications ?? [];
    if (!apps.some((a) => a.packageName === BUNDLE_ID)) {
      issues.push(`Android app restriction missing package "${BUNDLE_ID}"`);
    } else {
      const entry = apps.find((a) => a.packageName === BUNDLE_ID);
      if (!entry?.sha1Fingerprint) {
        issues.push(
          `Android app restriction for "${BUNDLE_ID}" has no SHA-1 fingerprint — add it manually in Cloud Console`,
        );
      }
    }
  }

  const allowedServices = new Set((r.apiTargets ?? []).map((t) => t.service));
  for (const svc of REQUIRED_SERVICES) {
    if (!allowedServices.has(svc)) {
      issues.push(`API target missing: ${svc}`);
    }
  }

  return { ok: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Restriction builders
// ---------------------------------------------------------------------------

function buildIosRestrictions(): KeyRestrictions {
  return {
    iosKeyRestrictions: { allowedBundleIds: [BUNDLE_ID] },
    apiTargets: REQUIRED_SERVICES.map((service) => ({ service })),
  };
}

function buildAndroidRestrictions(sha1Fingerprints: string[]): KeyRestrictions {
  return {
    androidKeyRestrictions: {
      allowedApplications: sha1Fingerprints.map((fp) => ({
        packageName: BUNDLE_ID,
        sha1Fingerprint: fp,
      })),
    },
    apiTargets: REQUIRED_SERVICES.map((service) => ({ service })),
  };
}

// ---------------------------------------------------------------------------
// Apply restrictions to a key (PATCH + wait for LRO)
// ---------------------------------------------------------------------------

async function applyAndWait(
  resourceName: string,
  restrictions: KeyRestrictions,
  token: string,
): Promise<void> {
  const url = `https://apikeys.googleapis.com/v2/${resourceName}?updateMask=restrictions`;
  const op = await apiPatch<Operation>(url, token, { restrictions });
  await waitForOperation(op, token);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const shouldApply = args.includes("--apply");
  const sha1Fingerprints = args
    .filter((a) => a.startsWith("--sha1="))
    .map((a) => a.slice("--sha1=".length))
    .filter(Boolean);

  if (shouldApply && sha1Fingerprints.length === 0) {
    console.error(
      "ERROR: --apply requires at least one --sha1=<fingerprint> for the Android key.",
      "\nAndroid app restrictions cannot be applied without certificate fingerprints.",
      "\nGet fingerprints from:",
      "\n  Play Console → App signing key certificate → SHA-1",
      "\n  keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android | grep SHA1",
      "\nThen re-run with: --apply --sha1=<upload-SHA1> --sha1=<debug-SHA1>",
    );
    process.exit(1);
  }

  const saJson = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
  if (!saJson) {
    console.error("ERROR: FIREBASE_SERVICE_ACCOUNT_JSON env var is not set");
    process.exit(1);
  }

  let sa: { client_email: string; private_key: string; project_id: string };
  try {
    sa = JSON.parse(saJson) as typeof sa;
  } catch {
    console.error("ERROR: FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
    process.exit(1);
  }

  console.log(`Service account : ${sa.client_email}`);
  console.log(`GCP project     : ${sa.project_id}`);
  console.log(`Mode            : ${shouldApply ? "apply + verify" : "verify only"}\n`);

  let token: string;
  try {
    token = await getAccessToken(sa);
  } catch (err) {
    console.error("ERROR: Could not obtain GCP access token:", (err as Error).message);
    console.error(
      "\nEnsure the service account has:",
      "\n  roles/apikeys.viewer  — for verification only",
      "\n  roles/apikeys.admin   — for verification + apply",
      "\nGrant at: https://console.cloud.google.com/iam-admin/iam?project=metapp-b4642",
    );
    process.exit(1);
  }

  let exitCode = 0;

  const targets: Array<{ label: string; keyString: string; platform: "android" | "ios" }> = [
    { label: "Android", keyString: ANDROID_KEY_STRING, platform: "android" },
    { label: "iOS", keyString: IOS_KEY_STRING, platform: "ios" },
  ];

  for (const { label, keyString, platform } of targets) {
    console.log(`=== ${label} key ===`);

    let resourceName: string;
    try {
      resourceName = await lookupKey(keyString, token);
      console.log(`Resource name   : ${resourceName}`);
    } catch (err) {
      const gcpErr = err as GcpApiError;
      if (gcpErr.statusCode === 403) {
        console.error(
          `ERROR: Permission denied looking up ${label} key.`,
          "\nGrant roles/apikeys.viewer or roles/apikeys.admin to the service account.",
        );
      } else {
        console.error(`ERROR: Could not look up ${label} key: ${gcpErr.message}`);
      }
      exitCode = 1;
      console.log("");
      continue;
    }

    if (shouldApply) {
      console.log("Applying restrictions…");
      try {
        const restrictions =
          platform === "ios"
            ? buildIosRestrictions()
            : buildAndroidRestrictions(sha1Fingerprints);
        await applyAndWait(resourceName, restrictions, token);
        console.log("Restrictions applied and LRO confirmed done.");
      } catch (err) {
        console.error(`ERROR applying ${label} restrictions: ${(err as Error).message}`);
        exitCode = 1;
        console.log("");
        continue;
      }
    }

    let key: ApiKey;
    try {
      key = await getKey(resourceName, token);
    } catch (err) {
      console.error(`ERROR reading ${label} key: ${(err as Error).message}`);
      exitCode = 1;
      console.log("");
      continue;
    }

    const { ok, issues } = checkRestrictions(key, platform);
    if (ok) {
      console.log("All restrictions in place.");
    } else {
      console.error("MISSING RESTRICTIONS:");
      for (const issue of issues) {
        console.error(`  - ${issue}`);
      }
      exitCode = 1;
    }
    console.log("");
  }

  if (exitCode !== 0) {
    console.error(
      "One or more restrictions are missing.",
      shouldApply ? "" : "Re-run with --apply --sha1=<fp> to fix them.",
      "\nSee artifacts/met/FIREBASE_KEY_RESTRICTIONS.md for the full runbook.",
    );
  } else {
    console.log("All Firebase API key restrictions verified.");
  }

  process.exit(exitCode);
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", (err as Error).message ?? err);
  process.exit(1);
});
