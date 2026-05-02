import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { logger } from "./logger";

let app: App | null = null;
let initError: Error | null = null;

function init(): App {
  if (app) return app;
  if (initError) throw initError;

  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0]!;
    return app;
  }

  const raw = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
  if (!raw || !raw.trim()) {
    initError = new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON env var is not set. " +
        "Cannot initialize Firebase Admin SDK.",
    );
    throw initError;
  }

  let parsed: { project_id?: string; client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch (err) {
    initError = new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: " +
        (err as Error).message,
    );
    throw initError;
  }

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    initError = new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is missing required fields " +
        "(project_id, client_email, private_key).",
    );
    throw initError;
  }

  app = initializeApp({
    credential: cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      // Private keys arrive with literal "\n" sequences when stored as a
      // single-line env var; convert them back to real newlines.
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    }),
    projectId: parsed.project_id,
  });

  logger.info({ projectId: parsed.project_id }, "Firebase Admin SDK initialized");
  return app;
}

export function adminAuth(): Auth {
  return getAuth(init());
}

export function adminDb(): Firestore {
  return getFirestore(init());
}

/** Probe init without throwing; returns null on failure. */
export function tryInitAdmin(): App | null {
  try {
    return init();
  } catch (err) {
    logger.error({ err }, "Firebase Admin SDK init failed");
    return null;
  }
}
