import { createClient } from "@replit/revenuecat-sdk/client";
import {
  grantCustomerEntitlement,
  listCustomerActiveEntitlements,
} from "@replit/revenuecat-sdk";
import { logger } from "./logger";

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID;
const PLUS_ENTITLEMENT = "plus";
const REWARD_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

let _connectionSettings: { settings: { access_token?: string; expires_at?: string; oauth?: { credentials?: { access_token?: string } } } } | null = null;

async function getAccessToken(): Promise<string> {
  if (
    _connectionSettings?.settings?.expires_at &&
    new Date(_connectionSettings.settings.expires_at).getTime() > Date.now() + 60_000
  ) {
    const token =
      _connectionSettings.settings.access_token ??
      _connectionSettings.settings.oauth?.credentials?.access_token;
    if (token) return token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error("RevenueCat: Replit connector env vars not available");
  }

  const res = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=revenuecat`,
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    },
  );
  const data = (await res.json()) as { items?: typeof _connectionSettings[] };
  _connectionSettings = data.items?.[0] ?? null;

  const token =
    _connectionSettings?.settings?.access_token ??
    _connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!token) throw new Error("RevenueCat: not connected — check integration");
  return token;
}

async function getRcClient() {
  const token = await getAccessToken();
  return createClient({
    baseUrl: "https://api.revenuecat.com/v2",
    headers: { Authorization: "Bearer " + token },
  });
}

/**
 * Fetches the caller's active entitlements from RevenueCat and returns the
 * verified tier. Used server-side so the subscription endpoint never trusts
 * the tier value the client claims to have.
 *
 * Returns "free" when the customer has no active paid entitlements or when
 * the RevenueCat connector is not yet connected (fail-open so first-launch
 * sync doesn't break).
 */
export async function getVerifiedTier(
  customerUid: string,
): Promise<"free" | "plus" | "pro"> {
  if (!PROJECT_ID) {
    logger.warn("REVENUECAT_PROJECT_ID not set — skipping server-side tier verification");
    return "free";
  }
  try {
    const client = await getRcClient();
    const result = await listCustomerActiveEntitlements({
      client,
      path: { project_id: PROJECT_ID, customer_id: customerUid },
    });
    if (result.error) {
      logger.warn({ error: result.error, customerUid }, "RevenueCat listCustomerActiveEntitlements error");
      return "free";
    }
    const ids = (result.data?.items ?? []).map((e) => e.entitlement_id);
    if (ids.includes("pro")) return "pro";
    if (ids.includes("plus")) return "plus";
    return "free";
  } catch (err) {
    logger.warn({ err: (err as Error)?.message, customerUid }, "RevenueCat tier verification failed — defaulting to free");
    return "free";
  }
}

export async function grantPlusEntitlementForReferral(
  customerUid: string,
): Promise<{ expiresAt: Date }> {
  if (!PROJECT_ID) {
    throw new Error("REVENUECAT_PROJECT_ID is not set");
  }
  const client = await getRcClient();
  const expiresAt = new Date(Date.now() + REWARD_DURATION_MS);

  const { error } = await grantCustomerEntitlement({
    client,
    path: {
      project_id: PROJECT_ID,
      customer_id: customerUid,
    },
    body: {
      entitlement_id: PLUS_ENTITLEMENT,
      expires_at: expiresAt.getTime(),
    },
  });

  if (error) {
    logger.error({ error, customerUid }, "RevenueCat grantCustomerEntitlement failed");
    throw new Error("Failed to grant RevenueCat entitlement");
  }

  logger.info({ customerUid, expiresAt }, "RevenueCat plus entitlement granted");
  return { expiresAt };
}
