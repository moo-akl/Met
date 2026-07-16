export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "x"
  | "tiktok"
  | "snapchat"
  | "linkedin";

export type SocialLinks = Partial<Record<SocialPlatform, string>>;

export type Profile = {
  id: string;
  name: string;
  bio: string;
  photoUri: string;
  socials: SocialLinks;
  verified: boolean;
  isVisible: boolean;
  // Selected interest tags from the predefined list (up to MAX_INTERESTS).
  interests?: string[];
  // Last time the user re-ran face verification (ML Kit equivalent on the
  // Flutter side). `undefined` = never verified.
  photoVerifiedAt?: number;
  // Optional secondary photos. Tier-gated (see MAX_EXTRA_PHOTOS_BY_TIER).
  // Always [] for free; up to 2 for plus, 5 for pro. Each entry has been
  // through the same face + content-safety check as the main photo.
  extraPhotos?: string[];
  // Whether the Rewards Collection (trophies) is visible to other users
  // on the public profile. Defaults to true (public) when absent.
  rewardsPublic?: boolean;
};

export type EncounterStatus =
  | "encounter"
  | "request_sent"
  | "request_received"
  | "connected";

export type OpeningMessage = {
  text: string;
  sentAt: number;
  reply?: { text: string; receivedAt: number };
};

export type Encounter = {
  id: string;
  realName: string;
  photoUri: string;
  bio: string;
  socials: SocialLinks;
  encounterCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
  lastDistanceM: number;
  lastLocation: string;
  status: EncounterStatus;
  blocked?: boolean;
  openingMessage?: OpeningMessage;
  // "Remember the human" extras — all optional and additive so existing
  // local storage stays compatible.
  note?: string; // user's personal note about this person
  tags?: string[]; // user-curated lowercase tags ("coffee", "gym"…)
  requestSentAt?: number; // when the user sent a reveal request — drives 24h expiry
  // Optional personal note attached to a reveal request. Persisted on the
  // encounter so the receiver can read it on their lock card. Cleared when
  // the request transitions away from `request_sent` / `request_received`.
  revealMessage?: string;
  // Peer's selected interests, synced from server during encounter enrichment.
  interests?: string[];
};
