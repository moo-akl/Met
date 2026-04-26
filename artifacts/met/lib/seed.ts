import type { Encounter, EncounterStatus } from "./types";

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
