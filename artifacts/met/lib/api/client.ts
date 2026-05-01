// Thin fetch wrapper for the Met api-server. Adds the X-Met-Uid header
// (MVP auth — replaced by a verified Firebase ID token later) and
// throws on non-2xx so callers can rely on a parsed JSON body.
//
// Base URL resolution:
//   1. EXPO_PUBLIC_API_URL env var (set in eas.json or app.config)
//   2. Replit dev domain when running locally / in Expo Go
//   3. Throws so we never silently send to the wrong host
import Constants from "expo-constants";

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.replace(/\/+$/, "");
  // Best-effort fallback: if we're served from a Replit dev domain via
  // expo-router web, use the same origin. Mobile builds will not have
  // this set and must rely on EXPO_PUBLIC_API_URL.
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    if (host) return `http://${host}:80`;
  }
  return "";
}

const BASE_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiOptions {
  uid: string;
  signal?: AbortSignal;
}

async function request<T>(
  method: "GET" | "PUT" | "POST" | "DELETE",
  path: string,
  opts: ApiOptions,
  body?: unknown,
): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError("EXPO_PUBLIC_API_URL not configured", 0, null);
  }
  const headers: Record<string, string> = {
    "X-Met-Uid": opts.uid,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: opts.signal,
  });
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // Non-JSON body — keep raw for the error.
      parsed = text;
    }
  }
  if (!res.ok) {
    const msg =
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { message?: unknown }).message === "string"
        ? (parsed as { message: string }).message
        : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, parsed);
  }
  return parsed as T;
}

// ----- typed wrappers (kept hand-rolled to avoid pulling react-query into
// non-react code). Shapes mirror @workspace/api-zod. -----

export interface RemoteProfile {
  uid: string;
  displayName: string;
  photoUrl: string | null;
  bio: string | null;
  socials: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertProfileInput {
  displayName: string;
  photoUrl?: string | null;
  bio?: string | null;
  socials?: Record<string, string>;
}

export interface RemoteEncounter {
  id: number;
  observerUid: string;
  observedUid: string;
  firstSeenAt: string;
  lastSeenAt: string;
  encounterCount: number;
  lastRssi: number | null;
}

export interface NearbyEntry {
  uid: string;
  distanceM: number;
  updatedAt: string;
}

export interface BleResolveEntry {
  hash: string;
  profile: RemoteProfile;
}

export const api = {
  baseUrl: BASE_URL,
  isConfigured: () => BASE_URL.length > 0,
  upsertMyProfile: (opts: ApiOptions, input: UpsertProfileInput) =>
    request<RemoteProfile>("PUT", "/api/profiles/me", opts, input),
  getProfile: (opts: ApiOptions, uid: string) =>
    request<RemoteProfile>(
      "GET",
      `/api/profiles/${encodeURIComponent(uid)}`,
      opts,
    ),
  logEncounter: (
    opts: ApiOptions,
    input: { observedUid: string; rssi?: number | null },
  ) => request<RemoteEncounter>("POST", "/api/encounters", opts, input),
  updatePresence: (
    opts: ApiOptions,
    input: { lat: number; lng: number; accuracyM?: number | null },
  ) => request<unknown>("PUT", "/api/presence", opts, input),
  nearbyPresence: (
    opts: ApiOptions,
    input: {
      lat: number;
      lng: number;
      radiusM?: number;
      maxAgeMin?: number;
    },
  ) => {
    const params = new URLSearchParams({
      lat: String(input.lat),
      lng: String(input.lng),
    });
    if (input.radiusM !== undefined)
      params.set("radiusM", String(input.radiusM));
    if (input.maxAgeMin !== undefined)
      params.set("maxAgeMin", String(input.maxAgeMin));
    return request<NearbyEntry[]>(
      "GET",
      `/api/presence/nearby?${params.toString()}`,
      opts,
    );
  },
  bleResolve: (opts: ApiOptions, hashes: string[]) =>
    request<BleResolveEntry[]>("POST", "/api/ble/resolve", opts, { hashes }),
};
