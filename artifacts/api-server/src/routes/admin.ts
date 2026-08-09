import { Router, type Request, type Response, type NextFunction } from "express";
import { db, profilesTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { adminAuth, adminDb, adminStorage } from "../lib/firebaseAdmin";
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

/**
 * GET /api/admin/cleanup/orphaned-photos
 *
 * Lists profile-photos/ objects in Firebase Storage whose uid no longer has
 * a matching profile row in Postgres. These files were left behind because
 * Storage cleanup failed during account deletion.
 *
 * Query params:
 *   ?dry_run=true   (default) List orphaned files only — no deletions.
 *   ?dry_run=false  Delete the orphaned files from Storage.
 *
 * Requires header: X-Admin-Secret: <ADMIN_SECRET env var>
 */
router.get(
  "/admin/cleanup/orphaned-photos",
  requireAdminSecret,
  async (req: Request, res: Response) => {
    const dryRun = req.query["dry_run"] !== "false";

    // 1. List all objects under profile-photos/
    const bucket = adminStorage().bucket();
    const [files] = await bucket.getFiles({ prefix: "profile-photos/" });

    // Extract uid from filenames like "profile-photos/{uid}.jpg".
    // Strip only known image extensions from the END so UIDs containing
    // periods (which Firebase allows) are preserved in full.
    const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|heic)$/i;
    const filesByUid = new Map<string, (typeof files)[number][]>();
    for (const file of files) {
      const name = file.name; // e.g. "profile-photos/user.name.jpg"
      const basename = name.slice("profile-photos/".length); // "user.name.jpg"
      const uid = basename.replace(IMAGE_EXT_RE, ""); // "user.name"
      if (!uid || uid === basename) continue; // skip if no recognised extension
      const existing = filesByUid.get(uid) ?? [];
      existing.push(file);
      filesByUid.set(uid, existing);
    }

    const storageUids = Array.from(filesByUid.keys());

    // 2. Find which of those uids still have a profile row
    const existingUids = new Set<string>();
    if (storageUids.length > 0) {
      const rows = await db
        .select({ uid: profilesTable.uid })
        .from(profilesTable)
        .where(inArray(profilesTable.uid, storageUids));
      for (const row of rows) existingUids.add(row.uid);
    }

    // 3. Orphaned = in Storage but not in Postgres
    const orphanedUids = storageUids.filter((uid) => !existingUids.has(uid));
    const orphanedFiles = orphanedUids.flatMap(
      (uid) => filesByUid.get(uid) ?? [],
    );

    req.log.info(
      {
        totalStorageUids: storageUids.length,
        orphanedCount: orphanedUids.length,
        dryRun,
      },
      "Admin orphaned-photos scan complete",
    );

    if (dryRun) {
      res.json({
        total_storage_uids: storageUids.length,
        orphaned_count: orphanedUids.length,
        orphaned_uids: orphanedUids,
        orphaned_files: orphanedFiles.map((f) => f.name),
        deleted: false,
      });
      return;
    }

    // 4. Delete orphaned files, tracking success per uid so we only clear
    //    Firestore failure records when ALL files for a uid are gone.
    //    A 404 response means the object is already absent — treat it as
    //    success (idempotent), matching the semantics of deleteStorageAssets.
    const deleted: string[] = [];
    const deleteErrors: { file: string; error: string }[] = [];
    const fullyCleanedUids = new Set<string>();

    for (const uid of orphanedUids) {
      const uidFiles = filesByUid.get(uid) ?? [];
      let allDeleted = true;
      for (const file of uidFiles) {
        try {
          await file.delete();
          deleted.push(file.name);
          logger.info({ file: file.name }, "Admin orphaned-photos: deleted file");
        } catch (err: unknown) {
          // 404 means the object is already gone — that is a success.
          const code = (err as { code?: number })?.code;
          if (code === 404) {
            deleted.push(file.name);
            logger.info({ file: file.name }, "Admin orphaned-photos: file already absent");
          } else {
            allDeleted = false;
            deleteErrors.push({ file: file.name, error: String(err) });
            logger.error({ file: file.name, err }, "Admin orphaned-photos: failed to delete file");
          }
        }
      }
      if (allDeleted) fullyCleanedUids.add(uid);
    }

    // UIDs that are in the Firestore failure queue but have no Storage objects
    // at all (files were cleaned in a prior run) have no path to removal via
    // the orphaned-file scan. Fetch the queue and clear those stale records too.
    try {
      const fsDb = adminDb();
      const queueSnap = await fsDb
        .collection("admin")
        .doc("failed-storage-cleanup")
        .collection("uids")
        .get();
      for (const doc of queueSnap.docs) {
        const queuedUid = doc.id as string;
        // If the uid still has files in Storage it was already handled above.
        // If it has NO files in Storage at all, every file is gone — clean.
        if (!filesByUid.has(queuedUid)) {
          fullyCleanedUids.add(queuedUid);
        }
      }
    } catch (fsErr) {
      logger.warn({ fsErr }, "Admin orphaned-photos: could not read failure queue for reconciliation");
    }

    // 5. Clear Firestore failed-storage-cleanup records ONLY for uids whose
    //    files were all successfully removed.
    if (fullyCleanedUids.size > 0) {
      try {
        const fsDb = adminDb();
        const colRef = fsDb
          .collection("admin")
          .doc("failed-storage-cleanup")
          .collection("uids");
        const batch = fsDb.batch();
        for (const uid of fullyCleanedUids) {
          batch.delete(colRef.doc(uid));
        }
        await batch.commit();
      } catch (fsErr) {
        logger.warn({ fsErr }, "Admin orphaned-photos: could not clear Firestore cleanup records");
      }
    }

    res.json({
      total_storage_uids: storageUids.length,
      orphaned_count: orphanedUids.length,
      deleted_count: deleted.length,
      deleted_files: deleted,
      errors: deleteErrors,
    });
  },
);

/**
 * GET /api/admin/cleanup/failed-storage-cleanup
 *
 * Returns the list of UIDs whose Storage cleanup failed during account
 * deletion (persisted by deleteStorageAssets).
 *
 * Requires header: X-Admin-Secret: <ADMIN_SECRET env var>
 */
router.get(
  "/admin/cleanup/failed-storage-cleanup",
  requireAdminSecret,
  async (req: Request, res: Response) => {
    const fsDb = adminDb();
    const snapshot = await fsDb
      .collection("admin")
      .doc("failed-storage-cleanup")
      .collection("uids")
      .orderBy("failedAt", "desc")
      .get();

    const records = snapshot.docs.map((d) => d.data());
    res.json({ count: records.length, records });
  },
);

export default router;
