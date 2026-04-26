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
  // Last time the user re-ran face verification (ML Kit equivalent on the
  // Flutter side). `undefined` = never verified.
  photoVerifiedAt?: number;
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
};
