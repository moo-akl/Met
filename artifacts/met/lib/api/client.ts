// Thin fetch wrapper for the Met api-server.
//
// Auth strategy:
//   - On native (iOS / Android with the linked Firebase native module):
//     attach `Authorization: Bearer <firebase id token>`. The server
//     verifies the token via firebase-admin and resolves the uid.
//   - On web preview / Expo Go (no native Firebase): fall back to the
//     legacy `X-Met-Uid` header. The server only honours this header
//     when NODE_ENV !== "production", which is fine for development
//     surfaces and never reaches the deployed app.
//
// Throws on non-2xx so callers can rely on a parsed JSON body.
//
// Base URL resolution:
//   1. EXPO_PUBLIC_API_URL env var (set in eas.json or app.config)
//   2. Replit dev domain when running locally / in Expo Go
//   3. Throws so we never silently send to the wrong host
import Constants from "expo-constants";
import { Platform } from "react-native";

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

// Cache the auth-module dynamic import. We never import it statically
// because on web / Expo Go the native bridge isn't linked and the
// import would crash the bundle.
let authImportFailed = false;
// Cache the resolved module so we only pay the dynamic-import cost once.
let authMod: typeof import("@react-native-firebase/auth") | null = null;

async function getCurrentIdToken(): Promise<string | null> {
  if (authImportFailed) return null;
  if (Platform.OS === "web") return null;

  // Step 1 — import the native module. Only permanent-fail on import errors
  // (e.g. native bridge not linked). Runtime errors like a stale token must
  // NOT set authImportFailed, otherwise a single transient failure would
  // permanently break auth until the app is restarted.
  if (!authMod) {
    try {
      authMod = await import("@react-native-firebase/auth");
    } catch {
      authImportFailed = true;
      return null;
    }
  }

  // Step 2 — fetch the token. Try without force-refresh first (fast path),
  // then retry with force-refresh in case the cached token just expired.
  try {
    const user = authMod.default().currentUser;
    if (!user) return null;
    try {
      return await user.getIdToken(false);
    } catch {
      // Token may be stale — force a network refresh once before giving up.
      return await user.getIdToken(true);
    }
  } catch {
    // getIdToken failed entirely — transient error. Return null so the
    // caller falls back to X-Met-Uid (dev) or gets a 401 (prod). Do NOT
    // set authImportFailed here or every subsequent request will also fail.
    return null;
  }
}

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
  /**
   * Caller's Firebase uid. Used as the `X-Met-Uid` fallback header on
   * platforms where we can't fetch a real ID token (web preview /
   * Expo Go) and as a sanity check the request is for the right user.
   */
  uid: string;
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Venue Owner Portal types
// ---------------------------------------------------------------------------

export type VenueApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  /** Reviewer sent it back for edits; the venue stays claimed and it can be resubmitted. */
  | "changes_requested"
  | "rejected"
  | "resubmitted"
  | "approved"
  | "withdrawn"
  | "expired";

export interface VenueOwnerProfile {
  id: number;
  ownerUid: string;
  placeId: string;
  placeName: string;
  businessName: string;
  tagline: string | null;
  description: string | null;
  coverPhotoUrl: string | null;
  logoUrl: string | null;
  lat: string | null;
  lng: string | null;
  verificationDocUrl: string | null;
  registrationNotes: string | null;
  isApproved: boolean;
  isVerified: boolean;
  rejectionReason: string | null;
  applicationStatus: VenueApplicationStatus;
  /** Stable alias included by the lifecycle API. */
  status?: VenueApplicationStatus;
  statusLabel?: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  withdrawnAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Public contact & hours fields — included by the public venue endpoint. */
  phone: string | null;
  websiteUrl: string | null;
  publicEmail: string | null;
  /** Keyed by lowercase day name. null value = closed that day, omitted = unknown. */
  openingHours: Record<string, { open: string; close: string } | null> | null;
  /**
   * True when the owner has already consumed a registration token and set up
   * their Venue Manager account. Included in the /me/application response.
   */
  hasClaimedVenueManager?: boolean;
}

export interface VenueApplicationHistoryEntry {
  id: number;
  eventType: string;
  fromStatus: VenueApplicationStatus | null;
  toStatus: VenueApplicationStatus | null;
  applicantMessage: string | null;
  createdAt: string;
}

export interface VenueApplicationStatusResponse {
  application: VenueOwnerProfile;
  history: VenueApplicationHistoryEntry[];
}

export interface VenueSearchPlace {
  placeId: string;
  placeName: string;
  address: string | null;
  category: string | null;
  googleMapsUri: string | null;
  lat: number;
  lng: number;
}

export interface VenueEvent {
  id: number;
  ownerUid: string;
  placeId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  capacityLimit: number | null;
  rsvpCount: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VenueReward {
  id: number;
  ownerUid: string;
  placeId: string;
  title: string;
  description: string | null;
  prizeDescription: string;
  rewardType: string;
  status: string;
  startDate: string;
  endDate: string;
  winnerUid: string | null;
  winnerSelectedAt: string | null;
  venueTimezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface VenueAnnouncement {
  id: number;
  ownerUid: string;
  placeId: string;
  title: string;
  body: string;
  imageUrl: string | null;
  isPinned: boolean;
  meta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface VenueOwnerMapPoint {
  placeId: string;
  placeName: string;
  businessName: string;
  tagline: string | null;
  logoUrl: string | null;
  lat: number;
  lng: number;
  hasActiveReward: boolean;
  hasUpcomingEvent: boolean;
}

export interface VenueOwnerDashboard {
  placeId: string;
  placeName: string;
  businessName: string;
  checkInTrend: Array<{ day: string; count: number }>;
  topVisitors: Array<{ userUid: string; displayName: string; photoUrl: string | null; checkinCount: number }>;
  eventRsvpCounts: Array<{ eventId: number; title: string; startsAt: string; going: number; maybe: number }>;
  activeReward: VenueReward | null;
}

/** A venue returned by GET /api/hubs/nearby. */
export interface VenueResult {
  placeId: string;
  displayName: string;
  /** Haversine distance in metres from the queried GPS point. */
  distanceM: number;
}

/** A venue returned by GET /api/hubs/active (check-ins in the last 30 min). */
export interface ActiveVenueResult {
  placeId: string;
  placeName: string;
  lat: number;
  lng: number;
  checkinCount: number;
}

/** A venue returned by GET /api/hubs/heatmap (nearby places with popularity). */
export interface HeatmapVenueResult {
  placeId: string;
  displayName: string;
  lat: number;
  lng: number;
  distanceM: number;
  /** Google Places current_popularity (0–100), null when not available. */
  popularity: number | null;
}

async function request<T>(
  method: "GET" | "PUT" | "POST" | "DELETE" | "PATCH",
  path: string,
  opts: ApiOptions,
  body?: unknown,
): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError("EXPO_PUBLIC_API_URL not configured", 0, null);
  }
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  // Prefer a real Firebase ID token when we can get one. The dev-only
  // X-Met-Uid header is sent as a fallback so any path that runs before
  // sign-in completes (or in web preview) still works.
  const idToken = await getCurrentIdToken();
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  } else {
    headers["X-Met-Uid"] = opts.uid;
  }
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
  /** User-selected interest tags, may be null/absent for older server responses. */
  interests?: string[] | null;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
  /** True for the first 500 users (Founders). Present on GET /profiles/me. */
  isPioneer?: boolean;
  /** Running count of successful referrals. Present on GET /profiles/me. */
  referralCount?: number;
  /** Subscription tier from server. Present on GET /profiles/me. */
  subscriptionTier?: "free" | "plus" | "pro" | null;
  /** True when the user has an active Plus or Pro subscription. Present on GET /profiles/me. */
  isSubscribed?: boolean;
}

export interface UpsertProfileInput {
  displayName: string;
  photoUrl?: string | null;
  bio?: string | null;
  socials?: Record<string, string>;
  /** Selected interest tags (predefined list, up to 10). */
  interests?: string[] | null;
  /**
   * Ghost Mode flag. Optional on upsert — when omitted the server
   * preserves the existing value (and defaults to true on first
   * create), so we never silently flip a user out of Ghost Mode just
   * by saving an unrelated profile field.
   */
  isVisible?: boolean;
  /** BCP-47 language code selected in the app. Optional; null preserves existing. */
  preferredLocale?: string | null;
  /** Server-side notification delivery flags. Null = all enabled (default). */
  notificationPrefs?: {
    notifyNewEncounters?: boolean;
    notifyReencounter?: boolean;
    notifyChat?: boolean;
  } | null;
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

export interface RecordEncounterResult {
  otherUid: string;
  metCount: number;
  lastMet: string;
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

export type RevealStatus = "pending" | "accepted" | "declined";

export interface RemoteRevealRequest {
  id: number;
  senderUid: string;
  recipientUid: string;
  message: string | null;
  status: RevealStatus;
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
}

export interface RemoteRevealRequestWithProfile extends RemoteRevealRequest {
  // Inbox entries: profile is the SENDER. Outbox entries: profile is the RECIPIENT.
  // The endpoint context determines which.
  profile: RemoteProfile;
}

export const api = {
  baseUrl: BASE_URL,
  isConfigured: () => BASE_URL.length > 0,
  getMyProfile: (opts: ApiOptions) =>
    request<RemoteProfile>("GET", "/api/profiles/me", opts),
  upsertMyProfile: (opts: ApiOptions, input: UpsertProfileInput) =>
    request<RemoteProfile>("PUT", "/api/profiles/me", opts, input),
  /**
   * Permanently delete the caller's account — removes all data from
   * Postgres, Firestore, and Firebase Auth. Cannot be undone.
   */
  deleteMe: (opts: ApiOptions) =>
    request<void>("DELETE", "/api/profiles/me", opts),
  /**
   * Upload a profile photo as raw base64 (no `data:` prefix). Server
   * stores it in Firebase Storage at `profile-photos/{uid}.{ext}` and
   * returns a tokenised public download URL that can be saved as the
   * profile's `photoUrl`. Local `file://` URIs MUST be uploaded via
   * this endpoint before being sent to other devices, or the photo
   * will fail to render on the recipient.
   */
  uploadProfilePhoto: (
    opts: ApiOptions,
    input: { base64: string; contentType?: string },
  ) =>
    request<{ photoUrl: string }>("POST", "/api/profiles/me/photo", opts, {
      base64: input.base64,
      contentType: input.contentType ?? "image/jpeg",
    }),
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
  /**
   * Symmetric Firestore encounter write — replaces logEncounter for the
   * Firestore-backed pipeline. Server writes mirror docs to BOTH users'
   * met_people subcollections in a single batched commit.
   */
  recordEncounter: (
    opts: ApiOptions,
    input: { otherUid: string; location?: { lat: number; lng: number } | null },
  ) =>
    request<RecordEncounterResult>(
      "POST",
      "/api/encounters/record",
      opts,
      input,
    ),
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
  // ----- Reveal requests -----
  sendReveal: (
    opts: ApiOptions,
    input: { recipientUid: string; message?: string | null },
  ) =>
    request<RemoteRevealRequestWithProfile>("POST", "/api/reveals", opts, {
      recipientUid: input.recipientUid,
      message: input.message ?? null,
    }),
  listInboundReveals: (opts: ApiOptions) =>
    request<RemoteRevealRequestWithProfile[]>(
      "GET",
      "/api/reveals/inbox",
      opts,
    ),
  listOutboundReveals: (opts: ApiOptions) =>
    request<RemoteRevealRequestWithProfile[]>(
      "GET",
      "/api/reveals/outbox",
      opts,
    ),
  acceptReveal: (opts: ApiOptions, senderUid: string) =>
    request<RemoteRevealRequest>("POST", "/api/reveals/accept", opts, {
      senderUid,
    }),
  declineReveal: (opts: ApiOptions, senderUid: string) =>
    request<RemoteRevealRequest>("POST", "/api/reveals/decline", opts, {
      senderUid,
    }),
  cancelReveal: (opts: ApiOptions, recipientUid: string) =>
    request<{ success: boolean }>("POST", "/api/reveals/cancel", opts, {
      senderUid: recipientUid,
    }),
  /**
   * Symmetric removal of a connection — deletes the underlying reveal-
   * request rows on the server for BOTH directions and mirrors the
   * removal to Firestore so the peer's device drops the encounter from
   * its UI without polling.
   */
  removeConnection: (opts: ApiOptions, peerUid: string) =>
    request<{ success: boolean }>("POST", "/api/connections/remove", opts, {
      peerUid,
    }),
  /**
   * Register (or refresh) the device's Expo push token with the server so
   * it can deliver remote notifications for reveals and nearby encounters.
   * Best-effort — call fire-and-forget; the app works fine without it.
   */
  registerPushToken: (opts: ApiOptions, token: string) =>
    request<{ success: boolean }>(
      "POST",
      "/api/profiles/me/push-token",
      opts,
      { token },
    ),
  // ----- Referrals -----
  /**
   * Register (or update) the caller's referral code on the server.
   * Call once after generating the code during onboarding.
   */
  registerReferralCode: (opts: ApiOptions, code: string) =>
    request<{ code: string }>("POST", "/api/referrals/register", opts, {
      code,
    }),
  /**
   * Redeem another user's referral code. The server validates, records the
   * redemption, and grants the inviter a 30-day Plus entitlement when they
   * reach 3 invites.
   */
  redeemReferralCode: (
    opts: ApiOptions,
    code: string,
  ) =>
    request<{
      result:
        | "accepted"
        | "invalid_format"
        | "self_referral"
        | "already_used"
        | "code_not_found";
    }>("POST", "/api/referrals/redeem", opts, { code }),
  /**
   * Fetch the caller's referral stats: their code, invite count, and whether
   * the reward is currently active (30-day Plus from RevenueCat).
   */
  getReferralStats: (opts: ApiOptions) =>
    request<{
      code: string | null;
      count: number;
      rewardActive: boolean;
      rewardExpiresAt: number | null;
    }>("GET", "/api/referrals/stats", opts),
  /**
   * Submit a content / abuse report. Server persists to Firestore
   * `reports` collection so the team can action within 24h per Apple
   * Guideline 1.2. Best-effort from the client side — we always also
   * keep a local copy via lib/reports.ts so the user sees instant
   * confirmation even if the server is unreachable.
   */
  submitReport: (
    opts: ApiOptions,
    input: {
      encounterId: string;
      reportedUid?: string | null;
      reason: "inappropriate" | "harassment" | "spam" | "underage" | "other";
      revealMessage?: string | null;
    },
  ) =>
    request<{ id: string }>("POST", "/api/reports", opts, {
      encounterId: input.encounterId,
      reportedUid: input.reportedUid ?? null,
      reason: input.reason,
      revealMessage: input.revealMessage ?? null,
    }),
  /**
   * Upload a photo for a network announcement. Stored in Firebase Storage
   * at `network-announcement-photos/{networkId}/{timestamp}.{ext}`.
   * Returns a public URL to embed in the announcement's `photoUrl`.
   */
  uploadAnnouncementPhoto: (
    opts: ApiOptions,
    networkId: number,
    input: { base64: string; contentType?: string },
  ) =>
    request<{ photoUrl: string }>(
      "POST",
      `/api/networks/${networkId}/announcements/photo`,
      opts,
      { base64: input.base64, contentType: input.contentType ?? "image/jpeg" },
    ),
  uploadNetworkPhoto: (
    opts: ApiOptions,
    networkId: number,
    input: { base64: string; contentType?: string },
  ) =>
    request<{ photoUrl: string }>(
      "POST",
      `/api/networks/${networkId}/photo`,
      opts,
      { base64: input.base64, contentType: input.contentType ?? "image/jpeg" },
    ),
  uploadNetworkCoverPhoto: (
    opts: ApiOptions,
    networkId: number,
    input: { base64: string; contentType?: string },
  ) =>
    request<{ coverPhotoUrl: string }>(
      "POST",
      `/api/networks/${networkId}/cover-photo`,
      opts,
      { base64: input.base64, contentType: input.contentType ?? "image/jpeg" },
    ),
  /**
   * Best-effort: ask the server to send an FCM push notification to a
   * chat recipient. Call this immediately after a successful Firestore
   * batch commit in sendMessage. Never throws — notification failure
   * must not block the chat UX.
   */
  notifyChatMessage: (
    opts: ApiOptions,
    input: { recipientUid: string; text: string; chatPeerUid: string },
  ) =>
    request<{ sent: boolean; reason?: string }>(
      "POST",
      "/api/chats/notify",
      opts,
      input,
    ),
  /**
   * Returns users who are accepted connections of BOTH the caller and `otherUid`.
   * Useful for showing "You both know N people" on a connection profile card.
   */
  getMutualConnections: (opts: ApiOptions, otherUid: string) =>
    request<{ count: number; names: string[] }>(
      "GET",
      `/api/profiles/me/mutual?with=${encodeURIComponent(otherUid)}`,
      opts,
    ),
  /**
   * Returns the caller's connection streak stats computed from reveal_requests.
   * currentStreak = consecutive days (ending today/yesterday) with ≥1 new connection.
   */
  getStreak: (opts: ApiOptions) =>
    request<{ currentStreak: number; longestStreak: number; totalConnections: number }>(
      "GET",
      "/api/profiles/me/streak",
      opts,
    ),
  /**
   * Returns all recognised Google Places venues within 50 m of the given
   * coordinates (up to 5), ordered by distance. Call this first when the user
   * triggers a check-in; if > 1 venue is returned, show the SelectVenueModal
   * so the user can pick before confirming.
   * Throws ApiError with status 404 when no venues are found.
   */
  hubNearby: (opts: ApiOptions, input: { lat: number; lng: number }) =>
    request<{ venues: VenueResult[] }>(
      "GET",
      `/api/hubs/nearby?lat=${input.lat}&lng=${input.lng}`,
      opts,
    ),
  /**
   * Hub check-in — records the visit to the given venue and updates the user's
   * hub streak. When `placeId` is provided (chosen from the multi-venue modal)
   * the server skips the Google Places lookup. Otherwise it auto-resolves from
   * lat/lng (single-venue fast path).
   * Throws ApiError with status 404 when no venue is found (auto-resolve path).
   * Throws ApiError with status 403 { error: "cooldown" } when the 4-hour
   * cooldown for this (user, venue) pair has not yet elapsed.
   */
  hubCheckin: (
    opts: ApiOptions,
    input: {
      lat: number;
      lng: number;
      placeId?: string;
      placeName?: string;
    },
  ) =>
    request<{
      placeId: string;
      placeName: string;
      streak: number;
      isRegisteredVenue?: boolean;
      isQrVerified?: boolean;
    }>(
      "POST",
      "/api/hubs/checkin",
      opts,
      input,
    ),
  /**
   * Validate a venue QR code token and record the user's physical presence,
   * unlocking reward eligibility for the current check-in session.
   */
  hubQrVerify: (
    opts: ApiOptions,
    input: { placeId: string; token: string },
  ) =>
    request<{ verified: boolean; streak: number }>(
      "POST",
      "/api/hubs/qr-verify",
      opts,
      input,
    ),
  /**
   * Check whether a venue is a registered (approved) venue and whether the
   * authenticated user has QR-verified their presence within the last 4 h.
   */
  hubCheckinStatus: (opts: ApiOptions, placeId: string) =>
    request<{ isRegisteredVenue: boolean; isQrVerified: boolean }>(
      "GET",
      `/api/hubs/${encodeURIComponent(placeId)}/checkin-status`,
      opts,
    ),
  /**
   * Record that the caller viewed another user's profile.
   * Server fires a "vibe-checked" push to the target (24 h dedup).
   */
  recordProfileView: (opts: ApiOptions, targetUid: string) =>
    request<{ recorded: boolean; pushSent: boolean }>(
      "POST",
      "/api/profile-views",
      opts,
      { targetUid },
    ),
  /**
   * Submit a scored peer review (one per reviewer/receiver pair).
   * Accepts 3 dimension scores (1–5 each) and updates community_standing.
   */
  submitReview: (
    opts: ApiOptions,
    input: {
      receiverUid: string;
      starRating: number;
      vibeTags?: string[];
      context?: "chat" | "meeting";
    },
  ) =>
    request<{ recorded: boolean }>("POST", "/api/reviews", opts, input),
  /**
   * Fetch aggregated review scores (v2 — Community Impact Score).
   * Returns weighted average star rating and vibe tag frequency breakdown.
   * hasEnough=false when fewer than 3 scored reviews exist.
   */
  getReviewSummary: (opts: ApiOptions, uid: string) =>
    request<{
      count: number;
      hasEnough: boolean;
      averageRating?: number;
      vibeTags?: Record<string, number>;
      communityStanding?: number;
    }>("GET", `/api/users/${encodeURIComponent(uid)}/review-summary`, opts),
  /**
   * Fetch pre-reveal community standing for a peer (no vibe-tag breakdown).
   * Only exposes averageRating + communityStanding — individual dimension
   * scores are withheld until after a mutual reveal.
   */
  getCommunityStanding: (opts: ApiOptions, uid: string) =>
    request<{
      count: number;
      hasEnough: boolean;
      averageRating?: number;
      communityStanding?: number;
      isPioneer?: boolean;
      /** Activity score: referrals×20 + check-ins×2 + chat connections×5. Grows with usage. */
      pioneerScore?: number;
      trophyCount?: number;
      trustScore?: number;
      /** True when the peer has an active Plus or Pro subscription. */
      isSubscriber?: boolean;
    }>("GET", `/api/users/${encodeURIComponent(uid)}/community-standing`, opts),
  /**
   * Fetch hub streaks, trust score, and average rating for any user.
   */
  getUserStats: (opts: ApiOptions, uid: string) =>
    request<{
      userUid: string;
      hubStreaks: Record<string, number>;
      trustScore: number;
      lastStreakUpdate: string | null;
      averageRating: number;
      reviewCount: number;
    }>("GET", `/api/users/${encodeURIComponent(uid)}/stats`, opts),
  /**
   * Fetch leaderboard for a hub. period defaults to "all_time".
   * "current_month" filters to check-ins from the start of the current UTC month.
   */
  getLeaderboard: (
    opts: ApiOptions,
    placeId: string,
    period: "all_time" | "current_month" = "all_time",
  ) =>
    request<
      Array<{
        rank: number;
        uid: string;
        displayName: string;
        photoUrl: string | null;
        checkinCount: number;
        hasTrophy: boolean;
      }>
    >(
      "GET",
      `/api/hubs/${encodeURIComponent(placeId)}/leaderboard?period=${period}`,
      opts,
    ),
  /**
   * Fetch all past monthly champion badges for a user.
   * Returns wins where rank = 1, ordered newest first.
   */
  getChampionBadges: (opts: ApiOptions, uid: string) =>
    request<
      Array<{
        placeId: string;
        placeName: string | null;
        month: string;
        rank: number;
        checkinCount: number;
      }>
    >("GET", `/api/users/${encodeURIComponent(uid)}/champion-badges`, opts),
  /**
   * Fetch the user's weekly rankings for the previous calendar week.
   * Returns one entry per venue the user checked into last week,
   * including their rank and total check-ins at that venue.
   */
  getWeeklyRankings: (opts: ApiOptions, uid: string) =>
    request<
      Array<{
        placeId: string;
        placeName: string | null;
        rank: number;
        checkinCount: number;
        weekStart: string;
      }>
    >("GET", `/api/users/${encodeURIComponent(uid)}/weekly-rankings`, opts),
  /**
   * Get server-side subscription record for a user.
   */
  getSubscription: (opts: ApiOptions) =>
    request<{
      userUid: string;
      tier: "free" | "plus" | "pro";
      status: "active" | "inactive";
      expiryDate: string | null;
    }>("GET", "/api/user/subscription", opts),

  /**
   * Sync tier to server after a successful RevenueCat purchase.
   * Also called on app launch to keep server in sync.
   */
  syncSubscription: (
    opts: ApiOptions,
    body: {
      tier: "free" | "plus" | "pro";
      status: "active" | "inactive";
      expiryDate?: string | null;
    },
  ) =>
    request<{ success: boolean }>("POST", "/api/user/subscription", opts, body),

  /**
   * DEV ONLY — manually set a tier in the subscriptions table for testing.
   * The endpoint is disabled in production.
   */
  devSetTier: (
    opts: ApiOptions,
    body: { tier: "free" | "plus" | "pro" },
  ) =>
    request<{ success: boolean }>("POST", "/api/dev/set-tier", opts, body),

  /**
   * Lightweight server-sync of notification preferences. Accepts any subset
   * of the known keys; merges with existing values on the server.
   * Best-effort — call fire-and-forget; the app works fine without it.
   */
  syncNotificationPrefs: (
    opts: ApiOptions,
    prefs: {
      notifyNewEncounters?: boolean;
      notifyReencounter?: boolean;
      notifyChat?: boolean;
    },
  ) =>
    request<{ success: boolean }>(
      "PATCH",
      "/api/profiles/me/notification-prefs",
      opts,
      prefs,
    ),
  /**
   * Returns all venues that have had at least one Met check-in in the last
   * 30 minutes. Used by HeatmapMap to render the real-time "people here now"
   * pulsing dot layer.
   */
  hubActive: (opts: ApiOptions) =>
    request<{ venues: ActiveVenueResult[] }>("GET", "/api/hubs/active", opts),
  /**
   * Returns nearby venues (within `radius` metres, default 1 000 m) with
   * Google Places current_popularity data for the density heat layer.
   * popularity is null for venues that have no live data from Google.
   */
  hubHeatmap: (
    opts: ApiOptions,
    input: { lat: number; lng: number; radius?: number },
  ) => {
    const params = new URLSearchParams({
      lat: String(input.lat),
      lng: String(input.lng),
    });
    if (input.radius !== undefined) params.set("radius", String(input.radius));
    return request<{ venues: HeatmapVenueResult[] }>(
      "GET",
      `/api/hubs/heatmap?${params.toString()}`,
      opts,
    );
  },

  /**
   * Fetch the top 50 Pioneers ranked by pioneer_score.
   * Score = referrals×20 + check-ins×2 + chats×5.
   * The top 5 entries have random_prize_eligibility: true.
   * Rank #1 has isTopContributor: true.
   */
  getPioneerLeaderboard: (opts: ApiOptions) =>
    request<{
      leaderboard: Array<{
        rank: number;
        uid: string;
        displayName: string;
        photoUrl: string | null;
        pioneerScore: number;
        referralCount: number;
        chatConnections: number;
        isTopContributor: boolean;
        random_prize_eligibility: boolean;
        prize_label: string | null;
      }>;
    }>("GET", "/api/pioneer-leaderboard", opts),

  /**
   * Fetch the caller's trophy collection (rank 1–3 monthly hub wins).
   * Results are ordered newest-first.
   */
  getTrophies: (opts: ApiOptions) =>
    request<{
      trophies: Array<{
        id: number;
        hubId: string;
        hubName: string | null;
        monthYear: string;
        rankAchieved: number;
        trophyType: string;
        awardedAt: string;
      }>;
    }>("GET", "/api/profiles/me/trophies", opts),

  /**
   * Notify the server that the caller started a new one-on-one chat.
   * Increments chat_connections for pioneer score calculation.
   */
  recordChatConnection: (opts: ApiOptions) =>
    request<{ ok: boolean }>("POST", "/api/users/record-chat-connection", opts),

  /**
   * Best-effort: increment the shared message_count for the connection
   * between the caller and peerUid. Called after each successful message send.
   * Never throws — failure must not block the chat UX.
   */
  incrementMessageCount: (opts: ApiOptions, peerUid: string) =>
    request<{ ok: boolean }>("POST", "/api/chats/message-count", opts, {
      peerUid,
    }),

  /**
   * Confirm that the caller and peerUid met in real life.
   * Sets has_met_in_real_life = true on the shared connection row.
   */
  markAsMet: (opts: ApiOptions, peerUid: string) =>
    request<{ ok: boolean }>("POST", "/api/connections/mark-met", opts, {
      peerUid,
    }),

  /**
   * Fetch the quality-threshold fields for the connection with peerUid.
   * Returns messageCount and hasMetInRealLife used to gate the review prompt.
   */
  getConnectionQuality: (opts: ApiOptions, peerUid: string) =>
    request<{ messageCount: number; hasMetInRealLife: boolean }>(
      "GET",
      `/api/chats/quality?peerUid=${encodeURIComponent(peerUid)}`,
      opts,
    ),

  // ---------------------------------------------------------------------------
  // Venue Owner Portal
  // ---------------------------------------------------------------------------

  searchVenuePlaces: (
    opts: ApiOptions,
    query: string,
    location?: { lat: number; lng: number },
  ) => {
    const params = new URLSearchParams({ query });
    if (location) {
      params.set("lat", String(location.lat));
      params.set("lng", String(location.lng));
    }
    return request<{ places: VenueSearchPlace[] }>(
      "GET",
      `/api/venue-owner/places/search?${params.toString()}`,
      opts,
    ).then((response) => ({
      places: Array.isArray(response?.places) ? response.places : [],
    }));
  },

  /**
   * Upload a cover photo or logo for the venue owner profile.
   * photoType: 'cover' | 'logo'
   */
  uploadVenueProfilePhoto: (
    opts: ApiOptions,
    input: { base64: string; contentType?: string; photoType: "cover" | "logo" },
  ) =>
    request<{ url: string }>(
      "POST",
      "/api/venue-owner/upload-photo",
      opts,
      { base64: input.base64, contentType: input.contentType ?? "image/jpeg", photoType: input.photoType },
    ),

  /**
   * Upload a verification document image (base64) to Firebase Storage and
   * return a public URL that can be saved as verificationDocUrl on the
   * venue owner application.
   */
  uploadVenueVerificationDoc: (
    opts: ApiOptions,
    input: { base64: string; contentType?: string },
  ) =>
    request<{ url: string }>(
      "POST",
      "/api/venue-owner/upload-verification-doc",
      opts,
      { base64: input.base64, contentType: input.contentType ?? "image/jpeg" },
    ),

  /** Register a venue owner claim. */
  registerVenueOwner: (
    opts: ApiOptions,
    body: {
      placeId: string;
      placeName: string;
      businessName: string;
      lat?: string;
      lng?: string;
      tagline?: string;
      description?: string;
      verificationDocUrl?: string;
      registrationNotes?: string;
    },
  ) =>
    request<{ profile: VenueOwnerProfile }>(
      "POST",
      "/api/venue-owner/register",
      opts,
      body,
    ),

  /** Fetch the caller's own venue owner profile. Throws 404 if not registered. */
  getMyVenueOwnerProfile: (opts: ApiOptions) =>
    request<{ profile: VenueOwnerProfile }>("GET", "/api/venue-owner/me", opts),

  /** Fetches the canonical application status plus applicant-safe history. */
  getMyVenueApplication: (opts: ApiOptions) =>
    request<VenueApplicationStatusResponse>(
      "GET",
      "/api/venue-owner/me/application",
      opts,
    ),

  /**
   * Generates a fresh Venue Manager setup link for an approved owner.
   * Each call mints a new single-use token valid for 7 days.
   */
  getMyVenueManagerRegistrationLink: (opts: ApiOptions) =>
    request<{ url: string }>("GET", "/api/venue-owner/me/registration-link", opts),

  /** Withdraw a submitted application before it is decided. */
  withdrawMyVenueApplication: (opts: ApiOptions) =>
    request<{ application: VenueOwnerProfile }>(
      "POST",
      "/api/venue-owner/me/application/withdraw",
      opts,
    ),

  /** Re-submit a rejected venue owner application with updated details. */
  reapplyVenueOwner: (
    opts: ApiOptions,
    body: {
      placeId: string;
      placeName: string;
      businessName: string;
      lat?: string;
      lng?: string;
      tagline?: string;
      description?: string;
      verificationDocUrl?: string;
      registrationNotes?: string;
    },
  ) =>
    request<{ profile: VenueOwnerProfile }>(
      "POST",
      "/api/venue-owner/reapply",
      opts,
      body,
    ),

  /** Update the caller's own venue owner profile. */
  updateMyVenueOwnerProfile: (
    opts: ApiOptions,
    body: {
      businessName?: string;
      tagline?: string | null;
      description?: string | null;
      coverPhotoUrl?: string | null;
      logoUrl?: string | null;
    },
  ) =>
    request<{ profile: VenueOwnerProfile }>("PUT", "/api/venue-owner/me", opts, body),

  /** Fetch a public venue owner profile (approved venues only). */
  getVenueOwnerProfile: (opts: ApiOptions, placeId: string) =>
    request<{ profile: VenueOwnerProfile }>(
      "GET",
      `/api/venue-owner/${encodeURIComponent(placeId)}`,
      opts,
    ),

  /** Create an event at the caller's venue. */
  createVenueEvent: (
    opts: ApiOptions,
    body: {
      title: string;
      description?: string | null;
      imageUrl?: string | null;
      startsAt: string;
      endsAt?: string | null;
      capacityLimit?: number | null;
      isPublished?: boolean;
    },
  ) =>
    request<{ event: VenueEvent }>(
      "POST",
      "/api/venue-owner/me/events",
      opts,
      body,
    ),

  /** List events for a venue (public). */
  getVenueEvents: (opts: ApiOptions, placeId: string) =>
    request<{ events: VenueEvent[] }>(
      "GET",
      `/api/venue-owner/${encodeURIComponent(placeId)}/events`,
      opts,
    ),

  /** Update an event owned by the caller. */
  updateVenueEvent: (
    opts: ApiOptions,
    eventId: number,
    body: {
      title?: string;
      description?: string | null;
      imageUrl?: string | null;
      startsAt?: string;
      endsAt?: string | null;
      capacityLimit?: number | null;
      isPublished?: boolean;
    },
  ) =>
    request<{ event: VenueEvent }>(
      "PUT",
      `/api/venue-owner/me/events/${eventId}`,
      opts,
      body,
    ),

  /** Delete an event owned by the caller. */
  deleteVenueEvent: (opts: ApiOptions, eventId: number) =>
    request<{ success: boolean }>(
      "DELETE",
      `/api/venue-owner/me/events/${eventId}`,
      opts,
    ),

  /** RSVP to an event. */
  rsvpEvent: (
    opts: ApiOptions,
    eventId: number,
    status: "going" | "maybe" | "not_going",
  ) =>
    request<{ success: boolean; status: string }>(
      "POST",
      `/api/venue-events/${eventId}/rsvp`,
      opts,
      { status },
    ),

  /** Get the caller's RSVP for an event. */
  getMyEventRsvp: (opts: ApiOptions, eventId: number) =>
    request<{ rsvp: { status: string } | null }>(
      "GET",
      `/api/venue-events/${eventId}/rsvp`,
      opts,
    ),

  /** Create a reward campaign at the caller's venue. */
  createVenueReward: (
    opts: ApiOptions,
    body: {
      title: string;
      description?: string | null;
      prizeDescription: string;
      rewardType?: "free_drink" | "discount" | "experience" | "custom";
      status?: "draft" | "active";
      startDate: string;
      endDate: string;
      venueTimezone?: string;
    },
  ) =>
    request<{ reward: VenueReward }>(
      "POST",
      "/api/venue-owner/me/rewards",
      opts,
      body,
    ),

  /** List rewards for a venue (public, excludes cancelled). */
  getVenueRewards: (opts: ApiOptions, placeId: string) =>
    request<{ rewards: VenueReward[] }>(
      "GET",
      `/api/venue-owner/${encodeURIComponent(placeId)}/rewards`,
      opts,
    ),

  /** Update a reward owned by the caller. */
  updateVenueReward: (
    opts: ApiOptions,
    rewardId: number,
    body: {
      title?: string;
      description?: string | null;
      prizeDescription?: string;
      rewardType?: "free_drink" | "discount" | "experience" | "custom";
      status?: "draft" | "active" | "cancelled";
      startDate?: string;
      endDate?: string;
      venueTimezone?: string;
    },
  ) =>
    request<{ reward: VenueReward }>(
      "PUT",
      `/api/venue-owner/me/rewards/${rewardId}`,
      opts,
      body,
    ),

  /** Create an announcement at the caller's venue. */
  createVenueAnnouncement: (
    opts: ApiOptions,
    body: {
      title: string;
      body: string;
      imageUrl?: string | null;
      isPinned?: boolean;
    },
  ) =>
    request<{ announcement: VenueAnnouncement }>(
      "POST",
      "/api/venue-owner/me/announcements",
      opts,
      body,
    ),

  /** List announcements for a venue (public). Pinned first, then newest. */
  getVenueAnnouncements: (opts: ApiOptions, placeId: string) =>
    request<{ announcements: VenueAnnouncement[] }>(
      "GET",
      `/api/venue-owner/${encodeURIComponent(placeId)}/announcements`,
      opts,
    ),

  /** Delete an announcement owned by the caller. */
  deleteVenueAnnouncement: (opts: ApiOptions, announcementId: number) =>
    request<{ success: boolean }>(
      "DELETE",
      `/api/venue-owner/me/announcements/${announcementId}`,
      opts,
    ),

  /** Fetch approved+verified venue owner map points for the map layer. */
  getVenueOwnerMapPoints: (opts: ApiOptions) =>
    request<{ venues: VenueOwnerMapPoint[] }>(
      "GET",
      "/api/hubs/venue-owners",
      opts,
    ),

  /** Fetch owner analytics dashboard. */
  getVenueOwnerDashboard: (opts: ApiOptions) =>
    request<VenueOwnerDashboard>("GET", "/api/venue-owner/me/dashboard", opts),
};
