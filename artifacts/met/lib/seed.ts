import type { Encounter, EncounterStatus, Profile } from "./types";

function rid() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

type SeedPerson = Omit<Encounter, "id" | "lastSeenAt" | "firstSeenAt"> & {
  minutesAgo: number;
  daysSinceFirst: number;
};

const seedPeople: SeedPerson[] = [
  {
    realName: "Alexandra",
    photoUri: "https://i.pravatar.cc/600?img=45",
    bio: "Photographer. Finds the prettiest light in the city.",
    socials: { instagram: "alexandra", facebook: "alexandra" },
    encounterCount: 20,
    lastDistanceM: 14,
    lastLocation: "Mission Park",
    status: "encounter",
    minutesAgo: 1,
    daysSinceFirst: 35,
  },
  {
    realName: "Maya Okafor",
    photoUri: "https://i.pravatar.cc/600?img=47",
    bio: "Architect. Always chasing better light.",
    socials: { instagram: "mayabuilds", x: "mayabuilds" },
    encounterCount: 4,
    lastDistanceM: 12,
    lastLocation: "Roastery on 3rd",
    status: "encounter",
    minutesAgo: 6,
    daysSinceFirst: 14,
  },
  {
    realName: "Rio Tanaka",
    photoUri: "https://i.pravatar.cc/600?img=12",
    bio: "Sound designer. Vinyl, late nights, and slow walks.",
    socials: { instagram: "riotanaka", tiktok: "riotanaka", snapchat: "riotnk" },
    encounterCount: 2,
    lastDistanceM: 28,
    lastLocation: "Mission Park",
    status: "request_received",
    minutesAgo: 22,
    daysSinceFirst: 7,
  },
  {
    realName: "Léa Bouchard",
    photoUri: "https://i.pravatar.cc/600?img=44",
    bio: "Climber, espresso snob, occasional writer.",
    socials: { instagram: "lea.b", linkedin: "lea-bouchard" },
    encounterCount: 1,
    lastDistanceM: 41,
    lastLocation: "Crosstown station",
    status: "encounter",
    minutesAgo: 47,
    daysSinceFirst: 1,
  },
  {
    realName: "Diego Ramírez",
    photoUri: "https://i.pravatar.cc/600?img=15",
    bio: "Cycling everywhere. Building things slowly.",
    socials: { instagram: "diegoramirez", x: "dgrz", facebook: "diego.ramirez" },
    encounterCount: 6,
    lastDistanceM: 8,
    lastLocation: "Coffee at Mira",
    status: "connected",
    minutesAgo: 90,
    daysSinceFirst: 21,
  },
  {
    realName: "Naomi Park",
    photoUri: "https://i.pravatar.cc/600?img=49",
    bio: "Translates books between two oceans.",
    socials: { instagram: "naomipark", tiktok: "naomipark" },
    encounterCount: 1,
    lastDistanceM: 33,
    lastLocation: "Riverside trail",
    status: "encounter",
    minutesAgo: 130,
    daysSinceFirst: 0,
  },
  {
    realName: "Hassan Ali",
    photoUri: "https://i.pravatar.cc/600?img=33",
    bio: "Restaurant kitchens. Open-water swimmer.",
    socials: { instagram: "hassan.cooks", facebook: "hassan.ali" },
    encounterCount: 3,
    lastDistanceM: 19,
    lastLocation: "Night market",
    status: "request_received",
    minutesAgo: 240,
    daysSinceFirst: 9,
  },
  {
    realName: "Priya Shah",
    photoUri: "https://i.pravatar.cc/600?img=23",
    bio: "Product designer. Quietly obsessed with maps.",
    socials: { instagram: "priyashah", x: "priya_shah", linkedin: "priyashah" },
    encounterCount: 2,
    lastDistanceM: 22,
    lastLocation: "Library plaza",
    status: "encounter",
    minutesAgo: 360,
    daysSinceFirst: 4,
  },
  {
    realName: "Theo Lindgren",
    photoUri: "https://i.pravatar.cc/600?img=68",
    bio: "Photographer of in-between moments.",
    socials: { instagram: "theolindgren", facebook: "theolindgren" },
    encounterCount: 1,
    lastDistanceM: 47,
    lastLocation: "Promenade",
    status: "encounter",
    minutesAgo: 720,
    daysSinceFirst: 0,
  },
];

export function buildSeedEncounters(): Encounter[] {
  const now = Date.now();
  return seedPeople.map((p, i) => {
    const { minutesAgo, daysSinceFirst, ...rest } = p;
    const status: EncounterStatus = rest.status;
    const lastSeenAt = now - minutesAgo * 60 * 1000;
    const firstSeenAt =
      daysSinceFirst === 0 ? lastSeenAt : now - daysSinceFirst * 24 * 60 * 60 * 1000;
    return {
      ...rest,
      status,
      id: rid() + "_" + i,
      lastSeenAt,
      firstSeenAt,
    };
  });
}

/**
 * Screenshot-only store-demo data. Never returned by `buildSeedEncounters`
 * and only injected by the `__DEV__` Expo web `?demo=1` path.
 */
export const STORE_DEMO_IDS = {
  viewer: "local-store-demo-viewer",
  recent: "store-demo-maya",
  detail: "store-demo-maya",
  request: "store-demo-rio",
  connection: "store-demo-diego",
  chat: "store-demo-diego",
} as const;

export function buildStoreDemoProfile(): Profile {
  return {
    id: STORE_DEMO_IDS.viewer,
    name: "Alex Morgan",
    bio: "Coffee walks, live music, and getting to know my city.",
    photoUri: "https://i.pravatar.cc/600?u=met-store-demo-alex",
    socials: { instagram: "alex.morgan" },
    interests: ["Coffee", "Photography", "Music"],
    verified: true,
    isVisible: true,
    extraPhotos: [
      "https://i.pravatar.cc/600?u=met-store-demo-alex-2",
      "https://i.pravatar.cc/600?u=met-store-demo-alex-3",
    ],
  };
}

export function buildStoreDemoEncounters(): Encounter[] {
  const now = Date.now();
  const records: Array<Omit<Encounter, "firstSeenAt" | "lastSeenAt"> & {
    minutesAgo: number;
    daysSinceFirst: number;
  }> = [
    {
      id: "store-demo-alexandra",
      realName: "Alexandra Reed",
      photoUri: "https://i.pravatar.cc/600?img=45",
      bio: "Photographer. Finds the prettiest light in the city.",
      socials: { instagram: "alexandrareed" },
      interests: ["Photography", "Art", "Coffee"],
      encounterCount: 3,
      lastDistanceM: 14,
      lastLocation: "Mission Park",
      status: "encounter",
      minutesAgo: 1,
      daysSinceFirst: 5,
    },
    {
      id: STORE_DEMO_IDS.recent,
      realName: "Maya Okafor",
      photoUri: "https://i.pravatar.cc/600?img=47",
      bio: "Architect. Always chasing better light.",
      socials: { instagram: "mayabuilds" },
      interests: ["Art", "Tech", "Coffee"],
      encounterCount: 4,
      lastDistanceM: 12,
      lastLocation: "Roastery on 3rd",
      status: "encounter",
      minutesAgo: 6,
      daysSinceFirst: 4,
    },
    {
      id: STORE_DEMO_IDS.request,
      realName: "Rio Tanaka",
      photoUri: "https://i.pravatar.cc/600?img=12",
      bio: "Sound designer. Vinyl, late nights, and slow walks.",
      socials: { instagram: "riotnk", tiktok: "riotnk" },
      interests: ["Music", "Film", "Nature"],
      encounterCount: 2,
      lastDistanceM: 28,
      lastLocation: "Mission Park",
      status: "request_received",
      revealMessage: "We keep running into each other at Mission Park. Want to say hello?",
      minutesAgo: 22,
      daysSinceFirst: 3,
    },
    {
      id: "store-demo-lea",
      realName: "Léa Bouchard",
      photoUri: "https://i.pravatar.cc/600?img=44",
      bio: "Climber, espresso fan, occasional writer.",
      socials: { instagram: "lea.b" },
      interests: ["Sport", "Coffee", "Reading"],
      encounterCount: 1,
      lastDistanceM: 41,
      lastLocation: "Crosstown station",
      status: "encounter",
      minutesAgo: 47,
      daysSinceFirst: 1,
    },
    {
      id: STORE_DEMO_IDS.connection,
      realName: "Diego Ramírez",
      photoUri: "https://i.pravatar.cc/600?img=15",
      bio: "Cycling everywhere. Building things slowly.",
      socials: { instagram: "diegoramirez", x: "dgrz" },
      interests: ["Cycling", "Coffee", "Tech"],
      encounterCount: 6,
      lastDistanceM: 8,
      lastLocation: "Coffee at Mira",
      status: "connected",
      note: "Coffee at Mira",
      tags: ["coffee", "cycling"],
      openingMessage: {
        text: "Great running into you at Mira. Let’s stay in touch.",
        sentAt: now - 42 * 60 * 1000,
        reply: {
          text: "Likewise! I’m usually around there on weekends.",
          receivedAt: now - 36 * 60 * 1000,
        },
      },
      minutesAgo: 90,
      daysSinceFirst: 21,
    },
    {
      id: "store-demo-naomi",
      realName: "Naomi Park",
      photoUri: "https://i.pravatar.cc/600?img=49",
      bio: "Translates books between two oceans.",
      socials: { instagram: "naomipark" },
      interests: ["Reading", "Travel", "Music"],
      encounterCount: 2,
      lastDistanceM: 33,
      lastLocation: "Riverside trail",
      status: "connected",
      note: "Long walk by the water",
      tags: ["books", "walks"],
      minutesAgo: 130,
      daysSinceFirst: 8,
    },
    {
      id: "store-demo-hassan",
      realName: "Hassan Ali",
      photoUri: "https://i.pravatar.cc/600?img=33",
      bio: "Restaurant kitchens. Open-water swimmer.",
      socials: { instagram: "hassan.cooks" },
      interests: ["Food", "Sport", "Music"],
      encounterCount: 3,
      lastDistanceM: 19,
      lastLocation: "Night market",
      status: "encounter",
      minutesAgo: 240,
      daysSinceFirst: 9,
    },
    {
      id: "store-demo-priya",
      realName: "Priya Shah",
      photoUri: "https://i.pravatar.cc/600?img=23",
      bio: "Product designer. Quietly obsessed with maps.",
      socials: { instagram: "priyashah" },
      interests: ["Tech", "Art", "Photography"],
      encounterCount: 2,
      lastDistanceM: 22,
      lastLocation: "Library plaza",
      status: "encounter",
      minutesAgo: 360,
      daysSinceFirst: 7,
    },
  ];

  return records.map(({ minutesAgo, daysSinceFirst, ...person }) => ({
    ...person,
    firstSeenAt:
      daysSinceFirst === 0
        ? now - minutesAgo * 60_000
        : now - daysSinceFirst * 86_400_000,
    lastSeenAt: now - minutesAgo * 60_000,
  }));
}
