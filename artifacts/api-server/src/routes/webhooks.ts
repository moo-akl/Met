/**
 * Webhook routes
 *
 * POST /api/webhooks/revenuecat  — Handle RevenueCat subscription lifecycle events
 *
 * Verifies the Authorization header against REVENUECAT_WEBHOOK_SECRET env var.
 * On INITIAL_PURCHASE or RENEWAL: sets is_active_subscription=true for the
 * business matching app_user_id.
 * On CANCELLATION or EXPIRATION: sets is_active_subscription=false.
 */

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, businessProfilesTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ACTIVATE_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
]);

const DEACTIVATE_EVENTS = new Set([
  "CANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
]);

router.post(
  "/webhooks/revenuecat",
  async (req, res): Promise<void> => {
    const secret = process.env["REVENUECAT_WEBHOOK_SECRET"];
    if (!secret) {
      res.status(503).json({ message: "RevenueCat webhook not configured" });
      return;
    }

    const authHeader = req.header("Authorization") ?? "";
    const provided = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    if (provided !== secret) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const event = body["event"] as Record<string, unknown> | undefined;

    if (!event) {
      res.status(400).json({ message: "Missing event payload" });
      return;
    }

    const eventType = String(event["type"] ?? "");
    const appUserId = String(event["app_user_id"] ?? "");
    const expirationAtMs = event["expiration_at_ms"];

    if (!appUserId) {
      res.status(400).json({ message: "Missing app_user_id" });
      return;
    }

    logger.info({ eventType, appUserId }, "RevenueCat webhook received");

    if (ACTIVATE_EVENTS.has(eventType)) {
      const subscriptionEndDate =
        typeof expirationAtMs === "number"
          ? new Date(expirationAtMs)
          : undefined;

      const [updated] = await db
        .update(businessProfilesTable)
        .set({
          isActiveSubscription: true,
          ...(subscriptionEndDate ? { subscriptionEndDate } : {}),
          updatedAt: new Date(),
        })
        .where(eq(businessProfilesTable.businessId, appUserId))
        .returning({ businessId: businessProfilesTable.businessId });

      if (!updated) {
        logger.warn({ appUserId, eventType }, "RevenueCat webhook: no matching business");
        res.status(200).json({ status: "no_match" });
        return;
      }

      logger.info({ appUserId, eventType, subscriptionEndDate }, "Business subscription activated");
      res.json({ status: "activated" });
      return;
    }

    if (DEACTIVATE_EVENTS.has(eventType)) {
      await db
        .update(businessProfilesTable)
        .set({ isActiveSubscription: false, updatedAt: new Date() })
        .where(eq(businessProfilesTable.businessId, appUserId));

      logger.info({ appUserId, eventType }, "Business subscription deactivated");
      res.json({ status: "deactivated" });
      return;
    }

    res.json({ status: "ignored", eventType });
  },
);

export default router;
