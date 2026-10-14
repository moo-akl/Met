/**
 * QR check-in helpers: minimal private profile provisioning + server verify.
 */
import { api, ApiError, type RemoteProfile } from "@/lib/api/client";
import { getLanguage } from "@/lib/i18n";
import {
  buildMinimalProfile,
  pickMinimalDisplayName,
} from "@/lib/profileCompletion";
import type { Profile, SocialLinks } from "@/lib/types";

async function firebaseDisplayName(): Promise<string | null> {
  try {
    const authMod = await import("@react-native-firebase/auth");
    return authMod.default().currentUser?.displayName ?? null;
  } catch {
    return null;
  }
}

/** Map a server profile to local, flagging no-photo profiles incomplete. */
export function profileFromRemote(remote: RemoteProfile): Profile {
  const hasPhoto = !!remote.photoUrl;
  return {
    id: remote.uid,
    name: remote.displayName || "",
    bio: remote.bio ?? "",
    photoUri: remote.photoUrl ?? "",
    socials: (remote.socials ?? {}) as SocialLinks,
    interests: (remote.interests ?? []) as string[],
    verified: hasPhoto,
    isVisible: remote.isVisible ?? false,
    photoVerifiedAt: hasPhoto ? Date.now() : undefined,
    extraPhotos: [],
    incomplete: !hasPhoto || !remote.displayName,
  };
}

/**
 * Ensure the signed-in user has a server profile for qr-verify. Never
 * overwrites an existing server profile. Returns the local profile to use.
 */
export async function ensureMinimalProfile(
  uid: string,
  localProfile: Profile | null,
  signal?: AbortSignal,
): Promise<Profile> {
  if (localProfile && localProfile.id === uid) return localProfile;
  try {
    const remote = await api.getMyProfile({ uid, signal });
    if (remote) return profileFromRemote(remote);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) throw err;
  }
  const displayName = pickMinimalDisplayName(await firebaseDisplayName());
  await api.upsertMyProfile(
    { uid, signal },
    {
      displayName,
      photoUrl: null,
      isVisible: false,
      preferredLocale: getLanguage(),
    },
  );
  return buildMinimalProfile(uid, displayName);
}

/** Bound for provisioning + verify so a stalled network surfaces Retry. */
export const QR_REQUEST_TIMEOUT_MS = 18_000;

export type QrVerifyOutcome =
  | { kind: "success"; privateOnly: boolean; streak: number }
  | { kind: "invalid" }
  | { kind: "cooldown" }
  | { kind: "network" }
  | { kind: "error"; status: number };

export function classifyQrError(err: unknown): QrVerifyOutcome {
  if (err instanceof ApiError) {
    if (err.status === 0) return { kind: "network" };
    const body = err.body as { error?: string } | null;
    if (body?.error === "PROFILE_COMPLETION_REQUIRED") return { kind: "error", status: err.status };
    if (err.status === 429 || body?.error === "cooldown") return { kind: "cooldown" };
    if (err.status === 400 || err.status === 404 || err.status === 410 || err.status === 403)
      return { kind: "invalid" };
    return { kind: "error", status: err.status };
  }
  return { kind: "network" };
}

export async function verifyQr(
  uid: string,
  placeId: string,
  token: string,
  signal?: AbortSignal,
): Promise<QrVerifyOutcome> {
  try {
    const res = await api.hubQrVerify({ uid, signal }, { placeId, token });
    if (!res?.verified) return { kind: "invalid" };
    return { kind: "success", privateOnly: !!res.privateOnly, streak: res.streak ?? 0 };
  } catch (err) {
    return classifyQrError(err);
  }
}
