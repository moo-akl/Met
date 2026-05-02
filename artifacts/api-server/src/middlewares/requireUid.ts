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
