/**
 * Tests for navigation rows in SettingsSheet.
 *
 * Covers:
 * - Pressing the Permissions row closes the sheet (onClose called).
 * - Pressing the Permissions row calls router.push("/permissions") after the
 *   50 ms setTimeout that guards against the modal close animation.
 * - Only /permissions is navigated to — no other route.
 * - Past Meetings is the only history row and keeps its existing destination.
 */

import React from "react";
import {
  render,
  screen,
  act,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react-native";

// ── Hoisted mock variables ────────────────────────────────────────────────────

// eslint-disable-next-line no-var
var mockRouterPush = jest.fn();
// eslint-disable-next-line no-var
var mockUpdatePreferences = jest.fn();
// eslint-disable-next-line no-var
var mockSubscription: {
  tier: string;
  promoPlusActive: boolean;
  customerInfo?: unknown;
};
// eslint-disable-next-line no-var
var mockLang = "en";
// eslint-disable-next-line no-var
var mockSubmitAppFeedback = jest.fn();

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
      notifyNewEncounters: true,
      notifyWeeklyRecap: true,
      notifyRecurringMeets: true,
      notifyConnectionRequests: true,
      notifyChat: true,
      notifyEventUpdates: true,
      notifyCrownDefense: true,
      notifyRewardUpdates: true,
      autoCleanupDays: 0,
      discoveryRange: "nearby",
    },
    updatePreferences: mockUpdatePreferences,
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
  useT: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (!key.startsWith("settings.subscription")) {
        return options?.date ? `${key}:${String(options.date)}` : key;
      }
      const locales = {
        en: require("@/lib/i18n/locales/en").en,
        fr: require("@/lib/i18n/locales/fr").fr,
        ar: require("@/lib/i18n/locales/ar").ar,
        zh: require("@/lib/i18n/locales/zh").zh,
      };
      const source =
        locales[mockLang as keyof typeof locales] ??
        locales.en;
      const translation = key
        .split(".")
        .reduce((value: any, part) => value?.[part], source);
      if (typeof translation !== "string") return key;
      return translation.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
        options?.[name] === undefined
          ? `{{${name}}}`
          : String(options[name]),
      );
    },
    lang: mockLang,
  }),
  setLanguage: jest.fn().mockResolvedValue({ rtlChanged: false }),
  SUPPORTED_LANGUAGES: [],
}));

jest.mock("@/lib/revenuecat", () => ({
  REVENUECAT_PLUS_ENTITLEMENT: "plus",
  REVENUECAT_PRO_ENTITLEMENT: "pro",
  useSubscription: () => mockSubscription,
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

jest.mock("@workspace/api-client-react", () => ({
  submitAppFeedback: (...args: unknown[]) => mockSubmitAppFeedback(...args),
}));

jest.mock("@/components/KeyboardAwareScrollViewCompat", () => {
  const { ScrollView } = require("react-native");
  return {
    KeyboardAwareScrollViewCompat: ({
      children,
    }: {
      children: React.ReactNode;
    }) => <ScrollView>{children}</ScrollView>,
  };
});

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
  mockLang = "en";
  mockSubscription = {
    tier: "free",
    promoPlusActive: false,
    customerInfo: undefined,
  };
});

afterEach(() => {
  // Unmount rendered trees before clearing timers so any component cleanup
  // effects run while the fake-timer queue is still intact.
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function renderSheet(onClose = jest.fn()) {
  await act(async () => {
    render(<SettingsSheet visible onClose={onClose} />);
  });
  return { onClose };
}

function setBillingSubscription(
  tier: "plus" | "pro",
  details: {
    willRenew: boolean;
    unsubscribeDetectedAt: string | null;
    expirationDate: string | null;
  },
) {
  mockSubscription = {
    tier,
    promoPlusActive: false,
    customerInfo: {
      entitlements: {
        active: {
          [tier]: {
            isActive: true,
            ...details,
          },
        },
      },
    },
  };
}

function formatDateInZone(value: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(new Date(value));
}

function mockDeviceTimeZone(timeZone: string) {
  jest
    .spyOn(Date.prototype, "toLocaleDateString")
    .mockImplementation(function (
      this: Date,
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions,
    ) {
      return new Intl.DateTimeFormat(locales, {
        ...options,
        timeZone,
      }).format(this);
    });
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

describe("SettingsSheet — event history NavRow", () => {
  it("shows Past Meetings as the only history entry", async () => {
    await renderSheet();

    expect(screen.getByText("tabs.events.pastMeetings")).toBeTruthy();
    expect(screen.queryByText("plans.pastHangoutsTitle")).toBeNull();
    expect(screen.getAllByTestId(/^settings-past-/)).toHaveLength(1);
  });

  it("closes Settings before opening the existing Past Meetings screen", async () => {
    const onClose = jest.fn();
    await renderSheet(onClose);

    fireEvent.press(screen.getByTestId("settings-past-meetings"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith("/past-meetings");
  });
});

describe("SettingsSheet — in-app feedback", () => {
  it("submits child-safety feedback without opening an external route", async () => {
    mockSubmitAppFeedback.mockResolvedValue({ id: "feedback-1" });
    await renderSheet();

    await fireEvent.press(screen.getByTestId("settings-about-met"));
    await waitFor(() => expect(screen.getByText("settings.aboutTitle")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("settings-send-feedback"));
    await fireEvent.press(screen.getByTestId("feedback-category-child_safety"));
    await waitFor(() => {
      expect(screen.getByTestId("feedback-child-safety-warning")).toBeTruthy();
    });

    await fireEvent.changeText(
      screen.getByTestId("feedback-message"),
      "A profile appears to be sharing prohibited material.",
    );
    await fireEvent.press(screen.getByTestId("feedback-submit"));

    await waitFor(() => {
      expect(mockSubmitAppFeedback).toHaveBeenCalledWith({
        category: "child_safety",
        message: "A profile appears to be sharing prohibited material.",
      });
    });
    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});

describe("SettingsSheet — subscription billing status", () => {
  const expirationDate = "2027-01-15T00:00:00.000Z";
  const formattedDate = new Date(expirationDate).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  it("shows the renewal date for an active renewing plan", async () => {
    mockSubscription = {
      tier: "plus",
      promoPlusActive: false,
      customerInfo: {
        entitlements: {
          active: {
            plus: {
              isActive: true,
              willRenew: true,
              unsubscribeDetectedAt: null,
              expirationDate,
            },
          },
        },
      },
    };

    await renderSheet();

    expect(screen.getByText("settings.planPlusActive")).toBeTruthy();
    expect(screen.getByText(`Renews ${formattedDate}`)).toBeTruthy();
  });

  it("shows that a canceled plan remains active until its access end date", async () => {
    mockSubscription = {
      tier: "pro",
      promoPlusActive: false,
      customerInfo: {
        entitlements: {
          active: {
            pro: {
              isActive: true,
              willRenew: false,
              unsubscribeDetectedAt: "2026-11-01T00:00:00.000Z",
              expirationDate,
            },
          },
        },
      },
    };

    await renderSheet();

    expect(screen.getByText("settings.planProActive")).toBeTruthy();
    expect(
      screen.getByText(`Canceled · access until ${formattedDate}`),
    ).toBeTruthy();
  });

  it("shows an unavailable-date message rather than inventing a date", async () => {
    mockSubscription = {
      tier: "plus",
      promoPlusActive: false,
      customerInfo: {
        entitlements: {
          active: {
            plus: {
              isActive: true,
              willRenew: true,
              unsubscribeDetectedAt: null,
              expirationDate: null,
            },
          },
        },
      },
    };

    await renderSheet();

    expect(screen.getByText("Billing date unavailable")).toBeTruthy();
    expect(screen.queryByText(/^Renews /)).toBeNull();
  });

  const boundaryDate = "2027-01-14T18:30:00.000Z";
  const localizedSubscriptionLabels = [
    {
      lang: "fr",
      renewalTemplate: "Renouvellement le {{date}}",
      canceledTemplate: "Abonnement résilié · accès jusqu’au {{date}}",
    },
    {
      lang: "ar",
      renewalTemplate: "يتجدد في {{date}}",
      canceledTemplate: "ملغى · الوصول متاح حتى {{date}}",
    },
    {
      lang: "zh",
      renewalTemplate: "于 {{date}} 续订",
      canceledTemplate: "已取消 · 可使用至 {{date}}",
    },
  ] as const;

  it.each(localizedSubscriptionLabels)(
    "formats renewal dates for $lang in the device timezone",
    async ({ lang, renewalTemplate }) => {
      mockLang = lang;
      mockDeviceTimeZone("Asia/Bangkok");
      setBillingSubscription("plus", {
        willRenew: true,
        unsubscribeDetectedAt: null,
        expirationDate: boundaryDate,
      });
      const localizedDate = formatDateInZone(
        boundaryDate,
        lang,
        "Asia/Bangkok",
      );
      const utcDate = formatDateInZone(boundaryDate, lang, "UTC");
      expect(localizedDate).not.toBe(utcDate);

      await renderSheet();

      expect(screen.getByTestId("settings-subscription-billing").props.children)
        .toBe(renewalTemplate.replace("{{date}}", localizedDate));
    },
  );

  it.each(localizedSubscriptionLabels)(
    "keeps the canceled access-end date localized for $lang",
    async ({ lang, canceledTemplate }) => {
      mockLang = lang;
      mockDeviceTimeZone("Asia/Bangkok");
      setBillingSubscription("pro", {
        willRenew: false,
        unsubscribeDetectedAt: "2026-11-01T00:00:00.000Z",
        expirationDate: boundaryDate,
      });
      const localizedDate = formatDateInZone(
        boundaryDate,
        lang,
        "Asia/Bangkok",
      );

      await renderSheet();

      expect(screen.getByTestId("settings-subscription-billing").props.children)
        .toBe(canceledTemplate.replace("{{date}}", localizedDate));
    },
  );
});

describe("SettingsSheet — optional notification controls", () => {
  it("shows separate category switches and saves only the selected choices", async () => {
    await renderSheet();

    await act(async () => {
      fireEvent.press(screen.getByTestId("settings-notifications"));
    });

    expect(screen.getByText("settings.notifyNewEncounters")).toBeTruthy();
    expect(screen.getByText("settings.notifyConnectionRequests")).toBeTruthy();
    expect(screen.getByText("settings.notifyCrownDefense")).toBeTruthy();
    expect(screen.getByText("settings.notifyRewardUpdates")).toBeTruthy();

    fireEvent(
      screen.getByLabelText("settings.notifyConnectionRequests"),
      "valueChange",
      false,
    );
    fireEvent(
      screen.getByLabelText("settings.notifyRewardUpdates"),
      "valueChange",
      false,
    );

    expect(mockUpdatePreferences).toHaveBeenNthCalledWith(1, {
      notifyConnectionRequests: false,
    });
    expect(mockUpdatePreferences).toHaveBeenNthCalledWith(2, {
      notifyRewardUpdates: false,
    });
  });
});
