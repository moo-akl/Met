import { getApp } from "firebase-admin/app";
import { logger } from "./logger";

const VISION_API_URL =
  "https://vision.googleapis.com/v1/images:annotate";

/**
 * Google Vision API SafeSearch likelihood levels, ordered 0–5 so we can
 * compare numerically without a chain of string comparisons.
 */
const LIKELIHOOD_RANK: Record<string, number> = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  VERY_LIKELY: 5,
};

/** Reject adult/violence at LIKELY or higher; racy only at VERY_LIKELY. */
const ADULT_THRESHOLD = 4; // LIKELY
const VIOLENCE_THRESHOLD = 4; // LIKELY
const RACY_THRESHOLD = 5; // VERY_LIKELY

export type ModerationResult =
  | { safe: true; faceCount: number }
  | { safe: false; reason: string; faceCount: number };

/**
 * Get a short-lived Google OAuth2 access token from the Firebase Admin
 * service-account credential — no extra packages needed.
 */
async function getAccessToken(): Promise<string> {
  const app = getApp();
  const credential = app.options.credential;
  if (!credential) throw new Error("Firebase Admin app has no credential");
  const token = await credential.getAccessToken();
  return token.access_token;
}

/**
 * Run Google Cloud Vision Safe Search on a raw base64-encoded image.
 *
 * Fails OPEN on every error (network, API not enabled, auth failure) so a
 * Vision API outage never blocks legitimate photo uploads. The server logs
 * a structured error in those cases so the issue is visible without user
 * impact.
 *
 * Requires the Cloud Vision API to be enabled in the GCP project that owns
 * the Firebase service account. If it is not yet enabled, the call returns
 * a 403 and the function returns { safe: true } — uploads are unaffected.
 */
export async function moderateImage(
  base64: string,
): Promise<ModerationResult> {
  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    logger.error(
      { err },
      "content-moderation: failed to get access token — skipping check",
    );
    return { safe: true, faceCount: 1 };
  }

  const body = {
    requests: [
      {
        image: { content: base64 },
        features: [
          { type: "SAFE_SEARCH_DETECTION", maxResults: 1 },
          { type: "FACE_DETECTION", maxResults: 5 },
        ],
      },
    ],
  };

  let resp: Response;
  try {
    resp = await fetch(VISION_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.error(
      { err },
      "content-moderation: Vision API request failed — skipping check",
    );
    return { safe: true, faceCount: 1 };
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    logger.error(
      { status: resp.status, body: text.slice(0, 500) },
      "content-moderation: Vision API error response — skipping check",
    );
    return { safe: true, faceCount: 1 };
  }

  let data: unknown;
  try {
    data = await resp.json();
  } catch (err) {
    logger.error(
      { err },
      "content-moderation: failed to parse Vision API response — skipping check",
    );
    return { safe: true, faceCount: 1 };
  }

  const response = (
    data as {
      responses?: Array<{
        safeSearchAnnotation?: {
          adult?: string;
          violence?: string;
          racy?: string;
        };
        faceAnnotations?: Array<{ detectionConfidence?: number }>;
      }>;
    }
  )?.responses?.[0];

  const annotation = response?.safeSearchAnnotation;
  const faceCount = response?.faceAnnotations?.length ?? 0;

  if (!annotation) {
    return { safe: true, faceCount };
  }

  const adult = LIKELIHOOD_RANK[annotation.adult ?? "UNKNOWN"] ?? 0;
  const violence = LIKELIHOOD_RANK[annotation.violence ?? "UNKNOWN"] ?? 0;
  const racy = LIKELIHOOD_RANK[annotation.racy ?? "UNKNOWN"] ?? 0;

  if (adult >= ADULT_THRESHOLD) {
    return {
      safe: false,
      faceCount,
      reason:
        "This photo contains adult content and can't be used as a profile photo. Please choose a different photo.",
    };
  }
  if (violence >= VIOLENCE_THRESHOLD) {
    return {
      safe: false,
      faceCount,
      reason:
        "This photo contains violent content and can't be used as a profile photo. Please choose a different photo.",
    };
  }
  if (racy >= RACY_THRESHOLD) {
    return {
      safe: false,
      faceCount,
      reason:
        "This photo doesn't meet our community guidelines. Please choose a different photo.",
    };
  }

  return { safe: true, faceCount };
}
