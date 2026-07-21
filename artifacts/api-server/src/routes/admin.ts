import { Router, type Request, type Response, type NextFunction } from "express";
import { db, profilesTable } from "@workspace/db";
import { adminAuth } from "../lib/firebaseAdmin";
import { deleteUserData } from "../lib/deleteUserData";
import { logger } from "../lib/logger";

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

export default router;
