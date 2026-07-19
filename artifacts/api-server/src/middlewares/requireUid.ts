import type { Request, Response, NextFunction } from "express";
import { adminAuth } from "../lib/firebaseAdmin";

declare global {
  namespace Express {
    interface Request {
      uid?: string;
    }
  }
}

const UID_PATTERN = /^[A-Za-z0-9_-]+$/;
const IS_PROD = process.env["NODE_ENV"] === "production";

/**
 * Verifies a Firebase ID token from the `Authorization: Bearer <token>`
 * header and attaches the resulting uid to `req.uid`.
 *
 * ## X-Met-Uid fallback (non-production only)
 *
 * In non-production environments the middleware also accepts a plain
 * `X-Met-Uid` header as a convenience for local dev `curl` calls and the
 * automated test suite, which sets the header directly rather than minting
 * a real Firebase ID token.
 *
 * **Security note:** this fallback is intentionally blocked in production
 * (`NODE_ENV === "production"`), so it can never be abused in the deployed
 * app. The business portal already sends `Authorization: Bearer <token>`
 * on every request (see `artifacts/business-portal/src/lib/api.ts`) and
 * never relies on this path.
 *
 * **Removal plan:** once the automated test suite migrates to use mock
 * Firebase ID tokens (e.g. via `firebase-admin` custom tokens or the
 * Firebase Auth Emulator) this entire `!IS_PROD` block can be deleted.
 * Tracking criteria:
 *   1. All `*.test.ts` files that currently `.set("x-met-uid", uid)` have
 *      been updated to use a Bearer token instead.
 *   2. The Expo web preview no longer needs a non-token fallback (it already
 *      uses Bearer tokens on native; the web path is dev-only).
 * Until then the fallback is acceptable because it is unreachable in
 * production and the set of dev UIDs it can impersonate is contained to
 * the local / CI environment.
 */
export async function requireUid(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  const idToken = match?.[1]?.trim();

  if (idToken) {
    try {
      const decoded = await adminAuth().verifyIdToken(idToken);
      req.uid = decoded.uid;
      next();
      return;
    } catch (err) {
      req.log?.warn(
        { err: (err as Error)?.message },
        "Firebase ID token verification failed",
      );
      res.status(401).json({ message: "Invalid or expired ID token" });
      return;
    }
  }

  // Dev/test convenience fallback — see removal plan in the JSDoc above.
  if (!IS_PROD) {
    const raw = req.header("x-met-uid");
    const uid = typeof raw === "string" ? raw.trim() : "";
    if (uid) {
      if (uid.length > 128 || !UID_PATTERN.test(uid)) {
        res.status(400).json({ message: "Invalid X-Met-Uid header" });
        return;
      }
      req.uid = uid;
      next();
      return;
    }
  }

  res.status(401).json({
    message: IS_PROD
      ? "Missing Authorization: Bearer <id_token>"
      : "Missing Authorization: Bearer <id_token> (or X-Met-Uid in dev)",
  });
}
