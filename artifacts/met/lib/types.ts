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
};

export type EncounterStatus =
  | "encounter"
  | "request_sent"
  | "request_received"
  | "connected";

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
};
