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
};
