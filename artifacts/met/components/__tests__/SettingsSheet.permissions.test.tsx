/**
 * Tests for the Permissions NavRow in SettingsSheet.
 *
 * Covers:
 * - Pressing the Permissions row closes the sheet (onClose called).
 * - Pressing the Permissions row calls router.push("/permissions") after the
 *   50 ms setTimeout that guards against the modal close animation.
 * - Only /permissions is navigated to — no other route.
 */

import React from "react";
import {
  render,
  screen,
  act,
  fireEvent,
  cleanup,
} from "@testing-library/react-native";

// ── Hoisted mock variables ────────────────────────────────────────────────────

// eslint-disable-next-line no-var
var mockRouterPush = jest.fn();

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return {
    Feather: ({ name }: { name: string }) => (
      <View testID={`feather-${name}`} />
    ),
  };
});

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.0.0" } },
}));

jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-updates", () => ({
  reloadAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock("@/contexts/AppContext", () => ({
  useApp: () => ({
    profile: {
      displayName: "Test User",
      photoUri: "",
      uid: "uid-1",
      id: "uid-1",
    },
    setProfile: jest.fn(),
    authedUid: "uid-1",
    blockedEncounters: [],
    setBlocked: jest.fn(),
    resetAll: jest.fn(),
    signOutAndClear: jest.fn(),
    preferences: {
      notifyRecurringMeets: true,
      notifyChat: true,
      autoCleanupDays: 0,
      discoveryRange: "nearby",
    },
    updatePreferences: jest.fn(),
    markPhotoVerified: jest.fn(),
    permissionsCompleted: true,
  }),
}));

jest.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "light",
    toggleTheme: jest.fn(),
    isDark: false,
  }),
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    card: "#ffffff",
    background: "#f8f8f8",
    foreground: "#000000",
    mutedForeground: "#666666",
    muted: "#eeeeee",
    border: "#dddddd",
    primary: "#00aa00",
    primaryForeground: "#ffffff",
    secondary: "#8888ff",
    actionButton: "#888888",
    radius: 12,
  }),
}));

jest.mock("@/lib/i18n", () => ({
  useT: () => ({ t: (k: string) => k, lang: "en" }),
  setLanguage: jest.fn().mockResolvedValue({ rtlChanged: false }),
  SUPPORTED_LANGUAGES: [],
}));

jest.mock("@/lib/revenuecat", () => ({
  useSubscription: () => ({ tier: "free", promoPlusActive: false }),
}));

jest.mock("@/lib/referrals", () => ({
  useReferrals: () => ({ count: 0 }),
}));

jest.mock("@/hooks/useVisibility", () => ({
  useVisibility: () => ({ isVisible: false, toggle: jest.fn() }),
}));

jest.mock("@/hooks/useVenueOwner", () => ({
  useVenueOwner: () => ({
    profile: null,
    isLoading: false,
    error: null,
  }),
}));

jest.mock("@/lib/venueOwnerLifecycle", () => ({
  getVenueOwnerDestination: jest
    .fn()
    .mockReturnValue("/venue-owner/setup"),
}));

jest.mock("@/lib/auth", () => ({
  getCurrentUserAccount: jest.fn().mockResolvedValue({
    email: "test@example.com",
    provider: "email",
  }),
}));

jest.mock("@/lib/api/client", () => ({
  __esModule: true,
  api: {
    syncNotificationPrefs: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/components/ActionSheet", () => {
  const { View } = require("react-native");
  return {
    ActionSheet: ({
      children,
    }: {
      children: React.ReactNode;
    }) => <View>{children}</View>,
  };
});

jest.mock("@/components/Avatar", () => {
  const { View } = require("react-native");
  return { Avatar: () => <View testID="avatar" /> };
});

jest.mock("@/components/PhotoVerifier", () => {
  const { View } = require("react-native");
  return { PhotoVerifier: () => <View testID="photo-verifier" /> };
});

jest.mock("@/components/TierBadge", () => {
  const { View } = require("react-native");
  return { TierBadge: () => <View testID="tier-badge" /> };
});

// ── Import under test ─────────────────────────────────────────────────────────

import { SettingsSheet } from "../SettingsSheet";

// ── Suite setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  // Fresh fake-timer environment per test so setTimeout calls from one test
  // cannot bleed into the next.
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  // Unmount rendered trees before clearing timers so any component cleanup
  // effects run while the fake-timer queue is still intact.
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function renderSheet(onClose = jest.fn()) {
  await act(async () => {
    render(<SettingsSheet visible onClose={onClose} />);
  });
  return { onClose };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SettingsSheet — Permissions NavRow", () => {
  it("renders a row whose label matches settings.permissions", async () => {
    await renderSheet();

    expect(screen.getByText("settings.permissions")).toBeTruthy();
  });

  it("calls onClose when the Permissions row is pressed", async () => {
    const onClose = jest.fn();
    await renderSheet(onClose);

    fireEvent.press(screen.getByText("settings.permissions"));

    // close() is called synchronously before the setTimeout.
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls router.push('/permissions') after the 50 ms guard timeout", async () => {
    const onClose = jest.fn();
    await renderSheet(onClose);

    fireEvent.press(screen.getByText("settings.permissions"));

    // The push must NOT have fired yet — the 50 ms guard hasn't elapsed.
    expect(mockRouterPush).not.toHaveBeenCalled();

    // Advance past the guard.
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith("/permissions");
  });

  it("navigates only to /permissions (not to paywall or any other route)", async () => {
    await renderSheet();

    fireEvent.press(screen.getByText("settings.permissions"));

    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Exactly one navigation call, to the permissions screen.
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith("/permissions");
  });
});
