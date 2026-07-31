import {
  Router,
  type IRouter,
  type Request,
  type Response as ExpressResponse,
} from "express";
import { logger } from "../lib/logger";

/**
 * POST /internal/check-deep-links
 *
 * Cron-guarded endpoint that fetches both Apple and Android deep-link
 * verification files from the production domain and asserts they contain
 * the expected app identifiers.
 *
 * Called daily by the GitHub Actions scheduled workflow
 * (.github/workflows/check-deep-links.yml).  Can also be triggered manually
 * by any authorised operator with the CRON_SECRET.
 *
 * Guards: X-Cron-Secret header must match the CRON_SECRET env var.
 */

const PRODUCTION_BASE_URL =
  process.env["DEEP_LINK_CHECK_BASE_URL"] ?? "https://metapp.replit.app";

// These values must stay in sync with:
//   - artifacts/api-server/src/routes/legal.ts  (the files being served)
//   - artifacts/met/app.json                     (the app identifiers)
const EXPECTED_APPLE_APP_ID = "AWHU9BTQQX.app.met.founders";
const EXPECTED_ANDROID_PACKAGE = "app.met.founders";
const EXPECTED_ANDROID_SHA256 =
  "A0:FF:D9:D6:F1:6C:9F:C8:FB:72:7A:84:F6:3E:01:5B:FE:9F:B1:F1:83:A3:ED:0B:AC:00:55:23:5B:3F:42:59";

interface CheckResult {
  url: string;
  ok: boolean;
  error?: string;
}

/** Fetch a URL and return the parsed JSON, or throw a descriptive error. */
async function fetchJson(url: string): Promise<unknown> {
  let fetchRes: globalThis.Response;
  try {
    fetchRes = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    throw new Error(`Network error fetching ${url}: ${String(err)}`);
  }
  if (!fetchRes.ok) {
    throw new Error(`HTTP ${fetchRes.status} from ${url}`);
  }
  try {
    return await fetchRes.json();
  } catch {
    throw new Error(`Response from ${url} is not valid JSON`);
  }
}

async function checkAppleAppSiteAssociation(): Promise<CheckResult> {
  const url = `${PRODUCTION_BASE_URL}/.well-known/apple-app-site-association`;
  try {
    const body = (await fetchJson(url)) as {
      applinks?: { details?: Array<{ appID?: string }> };
    };

    const details = body?.applinks?.details;
    if (!Array.isArray(details)) {
      return {
        url,
        ok: false,
        error: "applinks.details is missing or not an array",
      };
    }

    const found = details.some((d) => d?.appID === EXPECTED_APPLE_APP_ID);
    if (!found) {
      return {
        url,
        ok: false,
        error: `Expected appID '${EXPECTED_APPLE_APP_ID}' not found. Got: ${JSON.stringify(details.map((d) => d?.appID))}`,
      };
    }

    return { url, ok: true };
  } catch (err) {
    return { url, ok: false, error: String(err) };
  }
}

async function checkAssetLinks(): Promise<CheckResult> {
  const url = `${PRODUCTION_BASE_URL}/.well-known/assetlinks.json`;
  try {
    const body = (await fetchJson(url)) as Array<{
      target?: {
        package_name?: string;
        sha256_cert_fingerprints?: string[];
      };
    }>;

    if (!Array.isArray(body)) {
      return { url, ok: false, error: "Response is not a JSON array" };
    }

    const hasPackage = body.some(
      (entry) => entry?.target?.package_name === EXPECTED_ANDROID_PACKAGE,
    );
    if (!hasPackage) {
      return {
        url,
        ok: false,
        error: `Expected package_name '${EXPECTED_ANDROID_PACKAGE}' not found`,
      };
    }

    const hasFingerprint = body.some((entry) =>
      entry?.target?.sha256_cert_fingerprints?.includes(EXPECTED_ANDROID_SHA256),
    );
    if (!hasFingerprint) {
      return {
        url,
        ok: false,
        error: `Expected SHA-256 fingerprint not found in assetlinks.json`,
      };
    }

    return { url, ok: true };
  } catch (err) {
    return { url, ok: false, error: String(err) };
  }
}

const router: IRouter = Router();

router.post(
  "/internal/check-deep-links",
  async (req: Request, res: ExpressResponse) => {
    const secret = process.env["CRON_SECRET"];
    if (!secret || req.header("x-cron-secret") !== secret) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const [appleResult, androidResult] = await Promise.all([
      checkAppleAppSiteAssociation(),
      checkAssetLinks(),
    ]);

    const failures = [appleResult, androidResult].filter((r) => !r.ok);

    if (failures.length > 0) {
      for (const f of failures) {
        logger.error(
          { url: f.url, error: f.error },
          "deep-link-check: verification file check FAILED — deep links may fall back to browser",
        );
      }
      res.status(200).json({
        ok: false,
        failures: failures.map((f) => ({ url: f.url, error: f.error })),
      });
      return;
    }

    logger.info(
      {
        appleUrl: appleResult.url,
        androidUrl: androidResult.url,
      },
      "deep-link-check: all verification files OK",
    );

    res.status(200).json({ ok: true, failures: [] });
  },
);

export {
  checkAppleAppSiteAssociation,
  checkAssetLinks,
  EXPECTED_APPLE_APP_ID,
  EXPECTED_ANDROID_PACKAGE,
  EXPECTED_ANDROID_SHA256,
};

export default router;
