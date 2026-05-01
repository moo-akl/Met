import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      uid?: string;
    }
  }
}

/**
 * MVP auth: trusts the `X-Met-Uid` header and treats it as the
 * authenticated Firebase UID. This is intentionally weak — it lets us
 * ship the BLE feature this week. Hardening pass: verify a Firebase ID
 * token via firebase-admin and derive `uid` from the verified claims.
 */
export function requireUid(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const raw = req.header("x-met-uid");
  const uid = typeof raw === "string" ? raw.trim() : "";
  if (!uid) {
    res.status(401).json({ message: "Missing X-Met-Uid header" });
    return;
  }
  if (uid.length > 128 || !/^[A-Za-z0-9_-]+$/.test(uid)) {
    res.status(400).json({ message: "Invalid X-Met-Uid header" });
    return;
  }
  req.uid = uid;
  next();
}
