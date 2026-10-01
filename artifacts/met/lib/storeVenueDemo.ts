import { Platform } from "react-native";
import type {
  VenueAnnouncement,
  VenueEvent,
  VenueOwnerProfile,
  VenueReward,
  VenueReview,
} from "@/lib/api/client";

export const STORE_DEMO_PLACE_ID = "met-sample-mira-house";
export const STORE_DEMO_PLACE_NAME = "Mira House Coffee";

export interface StoreDemoVenue {
  placeId: string;
  placeName: string;
  category: string;
  neighborhood: string;
  weeklyActivity: number;
  color: string;
}

export const STORE_DEMO_VENUES: StoreDemoVenue[] = [
  {
    placeId: STORE_DEMO_PLACE_ID,
    placeName: STORE_DEMO_PLACE_NAME,
    category: "Coffee & bakery",
    neighborhood: "River District",
    weeklyActivity: 86,
    color: "#F97360",
  },
  {
    placeId: "met-sample-juniper-market",
    placeName: "Juniper Market",
    category: "Local market",
    neighborhood: "Market Quarter",
    weeklyActivity: 64,
    color: "#A78BFA",
  },
  {
    placeId: "met-sample-cypress-books",
    placeName: "Cypress Books",
    category: "Bookshop & café",
    neighborhood: "Old Town",
    weeklyActivity: 42,
    color: "#34D399",
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
  tagline: "An illustrative café concept.",
  description:
    "A sample venue concept for previewing local makers, community gatherings, and rewards.",
  coverPhotoUrl: null,
  logoUrl: null,
  lat: null,
  lng: null,
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
    title: "Saturday Vinyl & Slow Pour",
    description: "Bring a record, meet a neighbor, stay for another cup.",
    imageUrl: null,
    startsAt: dateOffset(3),
    endsAt: dateOffset(3 + 4 / 24),
    capacityLimit: 48,
    rsvpCount: 31,
    isPublished: true,
    createdAt: dateOffset(-3),
    updatedAt: dateOffset(-1),
  },
  {
    id: 902,
    ownerUid: STORE_DEMO_PROFILE.ownerUid,
    placeId: STORE_DEMO_PLACE_ID,
    title: "Meet the Makers Morning",
    description: "A casual showcase from neighborhood artists and makers.",
    imageUrl: null,
    startsAt: dateOffset(8),
    endsAt: dateOffset(8 + 3 / 24),
    capacityLimit: 36,
    rsvpCount: 19,
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
    title: "Mira House regular",
    description: "A little thank-you for showing up.",
    prizeDescription: "A coffee and pastry for two",
    rewardType: "experience",
    status: "active",
    startDate: dateOffset(-6),
    endDate: dateOffset(24),
    winnerUid: null,
    winnerSelectedAt: null,
    venueTimezone: "America/Los_Angeles",
    createdAt: dateOffset(-8),
    updatedAt: dateOffset(-2),
  },
];

export const STORE_DEMO_ANNOUNCEMENTS: VenueAnnouncement[] = [
  {
    id: 901,
    ownerUid: STORE_DEMO_PROFILE.ownerUid,
    placeId: STORE_DEMO_PLACE_ID,
    title: "A note from the team",
    body: "The community table is open all weekend. Come say hello.",
    imageUrl: null,
    isPinned: true,
    meta: null,
    createdAt: dateOffset(-1),
    updatedAt: dateOffset(-1),
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
];

export function isStoreScreenshotDemo(screen: string): boolean {
  if (Platform.OS !== "web" || !__DEV__ || typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("demo") === "1" && params.get("storeDemo") === screen;
}