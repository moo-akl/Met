import type { Request, Response, NextFunction } from "express";
import { adminAuth } from "../lib/firebaseAdmin";
import { needsSocialProfile } from "../lib/socialEligibility";
import { canUseSocialFeatures } from "../lib/socialProfileAccess";

declare global {
  namespace Express {
    interface Request {
      uid?: string;
    }
  }
}

const UID_PATTERN = /^[A-Za-z0-9_-]+$/;
const IS_PROD = process.env["NODE_ENV"] === "production";

async function authorizeProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (needsSocialProfile(req.method, req.path)) {
    if (!(await canUseSocialFeatures(req.uid!))) {
      res.status(403).json({
        code: "PROFILE_COMPLETION_REQUIRED",
        message: "Complete your profile and add a photo before using social features. Private QR check-in is still available.",
      });
      return;
    }
  }
  next();
}

/**
 * Verifies a Firebase ID token from the `Authorization: Bearer <token>`
 * header and attaches the resulting uid to `req.uid`.
 *
 * In non-production environments we also accept a fallback `X-Met-Uid`
 * header so existing dev curls and the Replit web preview keep working
 * during the Firestore migration. Once every client sends ID tokens we
 * can drop the fallback.
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
    let verifier: ReturnType<typeof adminAuth>;
    try {
      verifier = adminAuth();
    } catch {
      // Server configuration failures are not evidence that the caller's
      // Firebase session is invalid. Never fall back to an unverified UID.
      req.log?.error(
        { code: "AUTH_SERVICE_UNAVAILABLE" },
        "Firebase authentication service could not initialize",
      );
      res.setHeader("Retry-After", "30");
      res.status(503).json({
        code: "AUTH_SERVICE_UNAVAILABLE",
        message: "Sign-in service is temporarily unavailable. Please try again shortly.",
      });
      return;
    }
    try {
      const decoded = await verifier.verifyIdToken(idToken);
      req.uid = decoded.uid;
    } catch (err) {
      req.log?.warn(
        { err: (err as Error)?.message },
        "Firebase ID token verification failed",
      );
      res.status(401).json({ message: "Invalid or expired ID token" });
      return;
    }
    await authorizeProfile(req, res, next);
    return;
  }

  if (!IS_PROD) {
    const raw = req.header("x-met-uid");
    const uid = typeof raw === "string" ? raw.trim() : "";
    if (uid) {
      if (uid.length > 128 || !UID_PATTERN.test(uid)) {
        res.status(400).json({ message: "Invalid X-Met-Uid header" });
        return;
      }
      req.uid = uid;
      await authorizeProfile(req, res, next);
      return;
    }
  }

  res.status(401).json({
    message: IS_PROD
      ? "Missing Authorization: Bearer <id_token>"
      : "Missing Authorization: Bearer <id_token> (or X-Met-Uid in dev)",
  });
}
