export type VenueManagerFirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
};

/**
 * Obtain the project ID from the existing mobile configuration, but require
 * a dedicated Web SDK key. The Android key may be restricted to signed apps
 * and must not be used by a browser.
 */
export function getVenueManagerFirebaseConfig(
  raw = process.env["GOOGLE_SERVICES_JSON"],
  webApiKey = process.env["FIREBASE_WEB_API_KEY"],
): VenueManagerFirebaseConfig | null {
  const apiKey = webApiKey?.trim() ?? "";
  // Google Firebase Web API keys use the AIza prefix and 39-character form.
  // Reject placeholders at configuration time rather than serving a login
  // screen that can only fail after the user enters their credentials.
  if (!raw?.trim() || !/^AIza[0-9A-Za-z_-]{35}$/.test(apiKey)) return null;
  try {
    const parsed = JSON.parse(raw) as {
      project_info?: { project_id?: unknown };
    };
    const projectId = parsed.project_info?.project_id;
    if (typeof projectId !== "string" || !projectId) return null;
    return { apiKey, authDomain: `${projectId}.firebaseapp.com`, projectId };
  } catch {
    return null;
  }
}