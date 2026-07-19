import { Router, type Request, type Response, type NextFunction } from "express";
import { eq, asc, inArray } from "drizzle-orm";
import { db, profilesTable, businessProfilesTable } from "@workspace/db";
import { adminAuth } from "../lib/firebaseAdmin";
import { deleteUserData } from "../lib/deleteUserData";
import { requireUid } from "../middlewares/requireUid";
import { logger } from "../lib/logger";
import { z } from "zod/v4";

const router: Router = Router();

/**
 * Middleware: requires the `X-Admin-Secret` header to match the `ADMIN_SECRET`
 * environment variable. Returns 503 if the variable is not set (endpoint
 * effectively disabled), 401 if the secret is wrong.
 */
function requireAdminSecret(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const secret = process.env["ADMIN_SECRET"];
  if (!secret) {
    res.status(503).json({ message: "Admin endpoints are not enabled" });
    return;
  }
  if (req.header("x-admin-secret") !== secret) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

/**
 * POST /api/admin/cleanup-deleted-users
 *
 * Scans every profile in Postgres and checks whether the corresponding
 * Firebase Auth account still exists. Profiles whose Auth account is gone
 * are considered orphaned and get deleted along with all related data.
 *
 * Query params:
 *   ?dry_run=true   Preview orphaned UIDs without deleting anything.
 *
 * Requires header: X-Admin-Secret: <ADMIN_SECRET env var>
 */
router.post(
  "/admin/cleanup-deleted-users",
  requireAdminSecret,
  async (req: Request, res: Response) => {
    const dryRun = req.query["dry_run"] === "true";

    const rows = await db.select({ uid: profilesTable.uid }).from(profilesTable);
    const uids = rows.map((r) => r.uid);

    const orphaned: string[] = [];
    const checkErrors: { uid: string; error: string }[] = [];

    // Check each UID against Firebase Auth (sequential to avoid overwhelming the API).
    for (const uid of uids) {
      try {
        await adminAuth().getUser(uid);
        // Account exists — not orphaned.
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === "auth/user-not-found") {
          orphaned.push(uid);
        } else {
          checkErrors.push({ uid, error: String(err) });
        }
      }
    }

    req.log.info(
      { total: uids.length, orphaned: orphaned.length, dryRun },
      "Admin cleanup scan complete",
    );

    if (dryRun) {
      res.json({
        total_profiles: uids.length,
        orphaned_count: orphaned.length,
        orphaned_uids: orphaned,
        check_errors: checkErrors,
        deleted: false,
      });
      return;
    }

    const deleted: string[] = [];
    const deleteErrors: { uid: string; error: string }[] = [];

    for (const uid of orphaned) {
      try {
        await deleteUserData(uid);
        deleted.push(uid);
        logger.info({ uid }, "Admin cleanup: deleted orphaned user");
      } catch (err: unknown) {
        deleteErrors.push({ uid, error: String(err) });
        logger.error({ uid, err }, "Admin cleanup: failed to delete orphaned user");
      }
    }

    res.json({
      total_profiles: uids.length,
      deleted_count: deleted.length,
      deleted_uids: deleted,
      errors: [...checkErrors, ...deleteErrors],
    });
  },
);

// ---------------------------------------------------------------------------
// requireAdminUid — Firebase-authenticated admin check
// Reads ADMIN_UIDS env var (comma-separated list of Firebase UIDs).
// ---------------------------------------------------------------------------

function requireAdminUid(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const adminUidsEnv = process.env["ADMIN_UIDS"] ?? "";
  if (!adminUidsEnv) {
    res.status(503).json({ message: "Admin UID list not configured" });
    return;
  }
  const allowlist = new Set(adminUidsEnv.split(",").map((u) => u.trim()).filter(Boolean));
  const uid = (req as Request & { uid?: string }).uid;
  if (!uid || !allowlist.has(uid)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// GET /api/admin/me
// Returns { isAdmin: boolean } for the authenticated user.
// Safe to call by any authenticated user — never returns 403.
// ---------------------------------------------------------------------------

router.get(
  "/admin/me",
  requireUid,
  (req: Request, res: Response): void => {
    const adminUidsEnv = process.env["ADMIN_UIDS"] ?? "";
    const allowlist = new Set(adminUidsEnv.split(",").map((u) => u.trim()).filter(Boolean));
    const uid = (req as Request & { uid?: string }).uid;
    res.json({ isAdmin: !!(uid && allowlist.has(uid)) });
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/generate-sales-link
// Generates a business registration URL with an embedded agent ID.
// Requires Firebase Auth (requireUid) + admin UID allowlist.
// ---------------------------------------------------------------------------

const GenerateSalesLinkBody = z.object({
  agentId: z.string().min(1).max(64),
});

router.post(
  "/admin/generate-sales-link",
  requireUid,
  requireAdminUid,
  async (req: Request, res: Response) => {
    const parsed = GenerateSalesLinkBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "agentId is required" });
      return;
    }

    const { agentId } = parsed.data;
    const url = `https://met-app.org/business-register?agent=${encodeURIComponent(agentId)}`;

    logger.info({ agentId, url }, "Sales link generated");
    res.json({ url, agentId });
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/businesses
// Returns all business profiles, sorted by sales_agent_id then created_at.
// Includes owner profile display name and email (from Firebase Auth).
// ---------------------------------------------------------------------------

router.get(
  "/admin/businesses",
  requireUid,
  requireAdminUid,
  async (req: Request, res: Response) => {
    const businesses = await db
      .select()
      .from(businessProfilesTable)
      .orderBy(
        asc(businessProfilesTable.salesAgentId),
        asc(businessProfilesTable.createdAt),
      );

    // Enrich with owner display names from Postgres profiles
    const ownerUids = [...new Set(businesses.map((b) => b.ownerId))];
    const ownerProfiles =
      ownerUids.length > 0
        ? await db
            .select({ uid: profilesTable.uid, displayName: profilesTable.displayName })
            .from(profilesTable)
            .where(inArray(profilesTable.uid, ownerUids))
        : [];

    const ownerMap: Record<string, string> = {};
    for (const p of ownerProfiles) {
      ownerMap[p.uid] = p.displayName;
    }

    // Fetch owner emails from Firebase Auth (best-effort)
    const ownerEmailMap: Record<string, string> = {};
    for (const uid of ownerUids) {
      try {
        const fbUser = await adminAuth().getUser(uid);
        ownerEmailMap[uid] = fbUser.email ?? "";
      } catch {
        ownerEmailMap[uid] = "";
      }
    }

    const enriched = businesses.map((b) => ({
      ...b,
      ownerDisplayName: ownerMap[b.ownerId] ?? null,
      ownerEmail: ownerEmailMap[b.ownerId] ?? null,
    }));

    // Group by salesAgentId (null → unassigned)
    const groupMap = new Map<string | null, typeof enriched>();
    for (const b of enriched) {
      const key = b.salesAgentId ?? null;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(b);
    }

    const grouped = Array.from(groupMap.entries()).map(([salesAgentId, items]) => ({
      salesAgentId,
      businesses: items,
    }));

    res.json({ grouped, total: enriched.length });
  },
);

export default router;
