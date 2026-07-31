/**
 * Unit tests for the deep-link URL parsing helpers exported from app/_layout.tsx.
 *
 * Covers:
 * - isVenueOwnerUrl: correctly identifies venue-owner URLs (custom scheme +
 *   HTTPS universal link), does NOT fire for unrelated paths.
 * - parseReferralFromUrl: extracts 6-char referral codes from /r/ paths.
 * - parseNetworkInviteFromUrl: extracts 8-char invite codes from /join/ paths.
 *
 * These helpers drive the handleUrl() routing in the root layout, so their
 * correctness is critical for cold-start and warm-start deep link behaviour.
 */

// _layout.tsx imports many native modules — mock them all so the module can be
// loaded in jest-expo without a native runtime.

jest.mock("expo-linking", () => ({
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock("expo-router", () => ({
  Stack: { Screen: jest.fn() },
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  usePathname: jest.fn(() => "/"),
  useSegments: jest.fn(() => []),
}));
jest.mock("expo-notifications", () => ({
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  setNotificationHandler: jest.fn(),
}));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock("@expo-google-fonts/inter", () => ({
  Inter_400Regular: "Inter_400Regular",
  Inter_500Medium: "Inter_500Medium",
  Inter_600SemiBold: "Inter_600SemiBold",
  Inter_700Bold: "Inter_700Bold",
  useFonts: jest.fn(() => [true, null]),
}));
jest.mock("@react-native-firebase/messaging", () => () => ({
  onTokenRefresh: jest.fn(() => jest.fn()),
}));
jest.mock("@workspace/api-client-react", () => ({
  setBaseUrl: jest.fn(),
  setAuthTokenGetter: jest.fn(),
}));
jest.mock("@/contexts/AppContext", () => ({
  AppProvider: jest.fn(({ children }: { children: React.ReactNode }) => children),
  useApp: jest.fn(() => ({
    ready: false,
    profile: null,
    permissionsCompleted: false,
    authedUid: null,
    allEncounters: [],
  })),
}));
jest.mock("@/contexts/ThemeContext", () => ({
  ThemeProvider: jest.fn(({ children }: { children: React.ReactNode }) => children),
}));
jest.mock("@/lib/firestore/client", () => ({
  initializeFirestore: jest.fn().mockResolvedValue(false),
}));
jest.mock("@/lib/i18n", () => ({ initI18n: jest.fn() }));
jest.mock("@/lib/notifications", () => ({
  configureNotifications: jest.fn(),
  getNotificationPermissionGranted: jest.fn().mockResolvedValue(false),
  registerAndUploadPushToken: jest.fn(),
  routeNotifTap: jest.fn(),
  setupNotificationListeners: jest.fn(() => jest.fn()),
}));
jest.mock("@/lib/referrals", () => ({ initReferrals: jest.fn() }));
jest.mock("@/lib/revenuecat", () => ({
  initializeRevenueCat: jest.fn(),
  SubscriptionProvider: jest.fn(({ children }: { children: React.ReactNode }) => children),
  useSubscription: jest.fn(() => ({ tier: "free", isSubscriptionReady: false, promoPlusActive: false })),
}));
jest.mock("@/lib/api/client", () => ({ api: { syncSubscription: jest.fn() } }));
jest.mock("@/lib/tiktok", () => ({
  initTikTok: jest.fn().mockResolvedValue(undefined),
  tiktokTrackLaunch: jest.fn(),
}));
jest.mock("@/lib/storage", () => ({ incrementSessionCount: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/hooks/useColors", () => ({
  useColors: jest.fn(() => ({})),
}));
jest.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: jest.fn(({ children }: { children: React.ReactNode }) => children),
}));
jest.mock("@/components/ChatMessageBanner", () => ({
  ChatMessageBanner: jest.fn(() => null),
}));
jest.mock("react-native-gesture-handler", () => ({
  GestureHandlerRootView: jest.fn(({ children }: { children: React.ReactNode }) => children),
}));
jest.mock("react-native-keyboard-controller", () => ({
  KeyboardProvider: jest.fn(({ children }: { children: React.ReactNode }) => children),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.fn(({ children }: { children: React.ReactNode }) => children),
}));
jest.mock("@tanstack/react-query", () => ({
  QueryClient: jest.fn(() => ({})),
  QueryClientProvider: jest.fn(({ children }: { children: React.ReactNode }) => children),
}));

import {
  isVenueOwnerUrl,
  parseReferralFromUrl,
  parseNetworkInviteFromUrl,
} from "../../app/_layout";

// ---------------------------------------------------------------------------
// isVenueOwnerUrl
// ---------------------------------------------------------------------------

describe("isVenueOwnerUrl", () => {
  describe("should return true for venue-owner URLs", () => {
    const positives: string[] = [
      // Custom scheme
      "met://venue-owner",
      "met://venue-owner/",
      "met://venue-owner/setup",
      "met://venue-owner/dashboard",
      // HTTPS universal link
      "https://metapp.replit.app/venue-owner",
      "https://metapp.replit.app/venue-owner/",
      "https://metapp.replit.app/venue-owner/setup",
      "https://metapp.replit.app/venue-owner/dashboard",
      "https://metapp.replit.app/venue-owner?ref=abc",
      "https://metapp.replit.app/venue-owner/setup?step=1",
    ];

    test.each(positives)("%s → true", (url) => {
      expect(isVenueOwnerUrl(url)).toBe(true);
    });
  });

  describe("should return false for non-venue-owner URLs", () => {
    // The function intentionally does not filter by domain — the OS only
    // delivers URLs to the app that match its registered scheme or associated
    // domains, so domain validation is handled at the platform level.
    const negatives: Array<[string | null, string]> = [
      [null, "null"],
      ["", "empty string"],
      ["met://r/AB2C3D", "referral URL"],
      ["met://join/CODE1234", "network invite URL"],
      ["https://metapp.replit.app/r/AB2C3D", "referral HTTPS"],
      ["https://metapp.replit.app/join/CODE1234", "invite HTTPS"],
      ["https://metapp.replit.app/venue-ownerFoo", "prefix collision — not a segment boundary"],
      ["https://metapp.replit.app/", "root path"],
      ["https://metapp.replit.app/paywall", "paywall path"],
    ];

    test.each(negatives)("%s → false (%s)", (url) => {
      expect(isVenueOwnerUrl(url)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// parseReferralFromUrl
// ---------------------------------------------------------------------------

describe("parseReferralFromUrl", () => {
  it("returns uppercased code from custom scheme", () => {
    // Note: referral codes use [A-Za-z2-9] — digits 0 and 1 are excluded to
    // avoid visual ambiguity. Use valid chars in this test.
    expect(parseReferralFromUrl("met://r/abc234")).toBe("ABC234");
  });

  it("returns uppercased code from HTTPS universal link", () => {
    expect(parseReferralFromUrl("https://metapp.replit.app/r/XY2Z89")).toBe("XY2Z89");
  });

  it("returns null for null input", () => {
    expect(parseReferralFromUrl(null)).toBeNull();
  });

  it("returns null for unrelated URL", () => {
    expect(parseReferralFromUrl("met://venue-owner")).toBeNull();
  });

  it("returns null when code is too short", () => {
    expect(parseReferralFromUrl("https://metapp.replit.app/r/ABC")).toBeNull();
  });

  it("returns null when code is too long", () => {
    expect(parseReferralFromUrl("https://metapp.replit.app/r/ABCDEFG")).toBeNull();
  });

  it("does not match /join/ paths", () => {
    expect(parseReferralFromUrl("https://metapp.replit.app/join/CODE1234")).toBeNull();
  });

  it("handles query strings correctly", () => {
    expect(parseReferralFromUrl("https://metapp.replit.app/r/AB2C3D?foo=bar")).toBe("AB2C3D");
  });
});

// ---------------------------------------------------------------------------
// parseNetworkInviteFromUrl
// ---------------------------------------------------------------------------

describe("parseNetworkInviteFromUrl", () => {
  it("returns uppercased code from custom scheme", () => {
    expect(parseNetworkInviteFromUrl("met://join/ABCD2345")).toBe("ABCD2345");
  });

  it("returns uppercased code from HTTPS universal link", () => {
    expect(parseNetworkInviteFromUrl("https://metapp.replit.app/join/ab2c3d4e")).toBe("AB2C3D4E");
  });

  it("returns null for null input", () => {
    expect(parseNetworkInviteFromUrl(null)).toBeNull();
  });

  it("returns null for referral URL", () => {
    expect(parseNetworkInviteFromUrl("https://metapp.replit.app/r/ABC123")).toBeNull();
  });

  it("returns null when code is too short", () => {
    expect(parseNetworkInviteFromUrl("https://metapp.replit.app/join/ABC12")).toBeNull();
  });

  it("returns null when code is too long", () => {
    expect(parseNetworkInviteFromUrl("https://metapp.replit.app/join/ABCDE1234")).toBeNull();
  });

  it("returns null for venue-owner URL", () => {
    expect(parseNetworkInviteFromUrl("met://venue-owner")).toBeNull();
  });

  it("handles query strings correctly", () => {
    expect(parseNetworkInviteFromUrl("https://metapp.replit.app/join/AB2C3D4E?foo=bar")).toBe("AB2C3D4E");
  });
});

// ---------------------------------------------------------------------------
// Priority: venue-owner wins over referral (same URL can't be both, but test
// the precedence order of the handleUrl logic)
// ---------------------------------------------------------------------------

describe("URL type disambiguation", () => {
  it("isVenueOwnerUrl does not match a pure referral URL", () => {
    const url = "https://metapp.replit.app/r/AB2C3D";
    expect(isVenueOwnerUrl(url)).toBe(false);
    expect(parseReferralFromUrl(url)).toBe("AB2C3D");
  });

  it("isVenueOwnerUrl does not match a network invite URL", () => {
    const url = "https://metapp.replit.app/join/ABCD2345";
    expect(isVenueOwnerUrl(url)).toBe(false);
    expect(parseNetworkInviteFromUrl(url)).toBe("ABCD2345");
  });
});
