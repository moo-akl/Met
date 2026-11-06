import { Platform } from "react-native";
import type {
  VenueAnnouncement,
  VenueEvent,
  VenueOwnerProfile,
  VenueReward,
  VenueReview,
} from "@/lib/api/client";

export const STORE_DEMO_PLACE_ID = "met-sample-mira-house";
export const STORE_DEMO_PLACE_NAME = "The Sunroom Café";

export interface StoreDemoVenue {
  placeId: string;
  placeName: string;
  category: string;
  neighborhood: string;
  weeklyActivity: number;
  color: string;
  lat: number;
  lng: number;
}

export const STORE_DEMO_VENUES: StoreDemoVenue[] = [
  {
    placeId: STORE_DEMO_PLACE_ID,
    placeName: STORE_DEMO_PLACE_NAME,
    category: "Café & garden",
    neighborhood: "East Village",
    weeklyActivity: 128,
    color: "#F97360",
    lat: 40.727,
    lng: -73.9855,
  },
  {
    placeId: "met-sample-juniper-market",
    placeName: "Juniper Market",
    category: "Local market",
    neighborhood: "Williamsburg",
    weeklyActivity: 64,
    color: "#A78BFA",
    lat: 40.7145,
    lng: -73.9575,
  },
  {
    placeId: "met-sample-cypress-books",
    placeName: "Cypress Books",
    category: "Bookshop & café",
    neighborhood: "SoHo",
    weeklyActivity: 42,
    color: "#34D399",
    lat: 40.7231,
    lng: -73.998,
  },
  {
    placeId: "met-sample-daybreak-provisions",
    placeName: "Daybreak Provisions",
    category: "Bakery & coffee",
    neighborhood: "West Village",
    weeklyActivity: 37,
    color: "#E7B95F",
    lat: 40.734,
    lng: -74.006,
  },
];

const now = Date.now();
const dateOffset = (days: number) => new Date(now + days * 86_400_000).toISOString();

export const STORE_DEMO_PROFILE: VenueOwnerProfile = {
  id: 901,
  ownerUid: "store-demo-owner",
  placeId: STORE_DEMO_PLACE_ID,
  placeName: STORE_DEMO_PLACE_NAME,
  businessName: STORE_DEMO_PLACE_NAME,
  checkInMode: "qr_only",
  tagline: "Coffee, garden tables & good company.",
  description:
    "Seasonal brunch, neighborhood makers, and a sunlit patio made for lingering.",
  coverPhotoUrl: null,
  logoUrl: null,
  lat: "40.727",
  lng: "-73.9855",
  verificationDocUrl: null,
  registrationNotes: null,
  isApproved: true,
  isVerified: false,
  rejectionReason: null,
  applicationStatus: "approved",
  status: "approved",
  statusLabel: "Approved",
  submittedAt: dateOffset(-45),
  reviewedAt: dateOffset(-42),
  approvedAt: dateOffset(-42),
  rejectedAt: null,
  withdrawnAt: null,
  expiredAt: null,
  createdAt: dateOffset(-60),
  updatedAt: dateOffset(-1),
  phone: null,
  websiteUrl: null,
  publicEmail: null,
  openingHours: {
    sunday: { open: "8:00 AM", close: "5:00 PM" },
    monday: { open: "7:00 AM", close: "6:00 PM" },
    tuesday: { open: "7:00 AM", close: "6:00 PM" },
    wednesday: { open: "7:00 AM", close: "6:00 PM" },
    thursday: { open: "7:00 AM", close: "8:00 PM" },
    friday: { open: "7:00 AM", close: "8:00 PM" },
    saturday: { open: "8:00 AM", close: "8:00 PM" },
  },
  hasClaimedVenueManager: true,
};

export const STORE_DEMO_EVENTS: VenueEvent[] = [
  {
    id: 901,
    ownerUid: STORE_DEMO_PROFILE.ownerUid,
    placeId: STORE_DEMO_PLACE_ID,
    title: "Courtyard Sessions",
    description: "Live acoustic sets, small-batch pastries, and a long table under the garden lights.",
    imageUrl: null,
    startsAt: dateOffset(2),
    endsAt: dateOffset(2 + 3 / 24),
    capacityLimit: 54,
    visibility: "public",
    inviteLinkEnabled: false,
    invitePasscodeRequired: false,
    rsvpCount: 42,
    isPublished: true,
    createdAt: dateOffset(-3),
    updatedAt: dateOffset(-1),
  },
  {
    id: 902,
    ownerUid: STORE_DEMO_PROFILE.ownerUid,
    placeId: STORE_DEMO_PLACE_ID,
    title: "Sunday Makers Brunch",
    description: "Meet local makers over garden brunch, fresh flowers, and a seasonal coffee flight.",
    imageUrl: null,
    startsAt: dateOffset(6),
    endsAt: dateOffset(6 + 3 / 24),
    capacityLimit: 40,
    visibility: "public",
    inviteLinkEnabled: false,
    invitePasscodeRequired: false,
    rsvpCount: 27,
    isPublished: true,
    createdAt: dateOffset(-2),
    updatedAt: dateOffset(-1),
  },
];

export const STORE_DEMO_REWARDS: VenueReward[] = [
  {
    id: 901,
    ownerUid: STORE_DEMO_PROFILE.ownerUid,
    placeId: STORE_DEMO_PLACE_ID,
    title: "A Sunroom brunch for two",
    description: "A little thank-you for becoming part of the neighborhood.",
    prizeDescription: "Garden brunch and two seasonal drinks",
    rewardType: "experience",
    status: "active",
    startDate: dateOffset(-6),
    endDate: dateOffset(24),
    winnerUid: null,
    winnerSelectedAt: null,
    venueTimezone: "America/New_York",
    createdAt: dateOffset(-8),
    updatedAt: dateOffset(-2),
  },
  {
    id: 902,
    ownerUid: STORE_DEMO_PROFILE.ownerUid,
    placeId: STORE_DEMO_PLACE_ID,
    title: "First light coffee flight",
    description: "Try three small-batch coffees with a fresh-baked pastry.",
    prizeDescription: "Coffee tasting flight and pastry",
    rewardType: "experience",
    status: "active",
    startDate: dateOffset(4),
    endDate: dateOffset(30),
    winnerUid: null,
    winnerSelectedAt: null,
    venueTimezone: "America/New_York",
    createdAt: dateOffset(-1),
    updatedAt: dateOffset(-1),
  },
];

export const STORE_DEMO_ANNOUNCEMENTS: VenueAnnouncement[] = [
  {
    id: 901,
    ownerUid: STORE_DEMO_PROFILE.ownerUid,
    placeId: STORE_DEMO_PLACE_ID,
    title: "The garden patio is open",
    body: "Our courtyard is back for the season. Drop by for fresh mint lemonade, warm pastries, and a little more sunshine.",
    imageUrl: null,
    isPinned: true,
    meta: null,
    createdAt: dateOffset(-1),
    updatedAt: dateOffset(-1),
  },
  {
    id: 902,
    ownerUid: STORE_DEMO_PROFILE.ownerUid,
    placeId: STORE_DEMO_PLACE_ID,
    title: "Meet your neighborhood makers",
    body: "Local ceramics, flowers, and small-batch treats arrive this Sunday. Brunch reservations are filling up.",
    imageUrl: null,
    isPinned: false,
    meta: null,
    createdAt: dateOffset(-3),
    updatedAt: dateOffset(-2),
  },
];

export const STORE_DEMO_REVIEWS: VenueReview[] = [
  { id: 901, starRating: 5, comment: "A lovely place to slow down and meet the neighborhood.", createdAt: dateOffset(-2), displayName: "Taylor M.", photoUrl: "https://i.pravatar.cc/160?img=49" },
  { id: 902, starRating: 5, comment: "Great coffee and a warm welcome every time.", createdAt: dateOffset(-5), displayName: "Jordan E.", photoUrl: "https://i.pravatar.cc/160?img=12" },
  { id: 903, starRating: 4, comment: "The Saturday music morning is worth coming back for.", createdAt: dateOffset(-8), displayName: "Riley C.", photoUrl: "https://i.pravatar.cc/160?img=33" },
];

export const STORE_DEMO_LEADERBOARD = [
  { rank: 1, uid: "sample-1", displayName: "Taylor Morgan", photoUrl: "https://i.pravatar.cc/160?img=49", checkinCount: 12, hasTrophy: true },
  { rank: 2, uid: "sample-2", displayName: "Jordan Ellis", photoUrl: "https://i.pravatar.cc/160?img=12", checkinCount: 9, hasTrophy: false },
  { rank: 3, uid: "store-demo-user", displayName: "Alex Harper", photoUrl: "https://i.pravatar.cc/160?img=13", checkinCount: 7, hasTrophy: false },
  { rank: 4, uid: "sample-4", displayName: "Casey Rivera", photoUrl: "https://i.pravatar.cc/160?img=32", checkinCount: 6, hasTrophy: false },
  { rank: 5, uid: "sample-5", displayName: "Riley Chen", photoUrl: "https://i.pravatar.cc/160?img=33", checkinCount: 4, hasTrophy: false },
  { rank: 6, uid: "sample-6", displayName: "Morgan Lee", photoUrl: "https://i.pravatar.cc/160?img=47", checkinCount: 3, hasTrophy: false },
  { rank: 7, uid: "sample-7", displayName: "Avery Brooks", photoUrl: "https://i.pravatar.cc/160?img=44", checkinCount: 3, hasTrophy: false },
  { rank: 8, uid: "sample-8", displayName: "Samira Patel", photoUrl: "https://i.pravatar.cc/160?img=45", checkinCount: 3, hasTrophy: false },
  { rank: 9, uid: "sample-9", displayName: "Cameron Liu", photoUrl: "https://i.pravatar.cc/160?img=46", checkinCount: 2, hasTrophy: false },
  { rank: 10, uid: "sample-10", displayName: "Quinn Rivera", photoUrl: "https://i.pravatar.cc/160?img=48", checkinCount: 2, hasTrophy: false },
  { rank: 11, uid: "sample-11", displayName: "Maya Thompson", photoUrl: "https://i.pravatar.cc/160?img=50", checkinCount: 2, hasTrophy: false },
  { rank: 12, uid: "sample-12", displayName: "Theo Martin", photoUrl: "https://i.pravatar.cc/160?img=51", checkinCount: 2, hasTrophy: false },
  { rank: 13, uid: "sample-13", displayName: "Lily Evans", photoUrl: "https://i.pravatar.cc/160?img=52", checkinCount: 1, hasTrophy: false },
  { rank: 14, uid: "sample-14", displayName: "Noah Carter", photoUrl: "https://i.pravatar.cc/160?img=53", checkinCount: 1, hasTrophy: false },
  { rank: 15, uid: "sample-15", displayName: "Emma Diaz", photoUrl: "https://i.pravatar.cc/160?img=54", checkinCount: 1, hasTrophy: false },
  { rank: 16, uid: "sample-16", displayName: "Luca Rossi", photoUrl: "https://i.pravatar.cc/160?img=55", checkinCount: 1, hasTrophy: false },
];

export function isStoreScreenshotDemo(screen: string): boolean {
  if (Platform.OS !== "web" || !__DEV__ || typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("demo") === "1" && params.get("storeDemo") === screen;
}