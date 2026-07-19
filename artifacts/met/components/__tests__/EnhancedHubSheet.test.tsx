/**
 * Tests for EnhancedHubSheet
 *
 * Covers:
 *  1. Header renders the logo image, Verified Partner badge, and business name
 *  2. Events section renders (empty-state and loading skeleton paths)
 *  3. Reviews section renders (empty-state and loading skeleton paths)
 */

import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react-native";

// ── Module mocks ──────────────────────────────────────────────────────────────
// NOTE: jest.mock() is hoisted before variable declarations, so mock factories
// must not reference variables defined outside them.

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent: (Component: unknown) => Component,
    },
    useAnimatedStyle: () => ({}),
    useSharedValue: (val: unknown) => ({ value: val }),
    withTiming: (val: unknown) => val,
    withSpring: (val: unknown) => val,
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    useAnimatedReaction: jest.fn(),
    Extrapolation: { CLAMP: "clamp" },
    interpolate: jest.fn((val: unknown) => val),
  };
});

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: {
      Pan: jest.fn(() => ({
        onUpdate: jest.fn().mockReturnThis(),
        onEnd: jest.fn().mockReturnThis(),
        enabled: jest.fn().mockReturnThis(),
      })),
    },
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Feather: View };
});

jest.mock("@/hooks/useSlideUpModal", () => ({
  useSlideUpModal: () => ({
    isMounted: true,
    panelStyle: {},
    backdropStyle: {},
    panGesture: {},
  }),
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    card: "#ffffff",
    border: "#e0e0e0",
    muted: "#f5f5f5",
    background: "#fafafa",
    foreground: "#000000",
    mutedForeground: "#666666",
    primary: "#7c3aed",
    primaryForeground: "#ffffff",
  }),
}));

jest.mock("@/contexts/AppContext", () => ({
  useApp: () => ({ authedUid: "test-user-uid" }),
}));

// The factory runs in the hoisted scope — define fns inline so they are never
// undefined. We retrieve references via `api` import below.
jest.mock("@/lib/api/client", () => ({
  api: {
    getBusinessEvents: jest.fn(),
    getBusinessReviews: jest.fn(),
    getMyBusinessCheckin: jest.fn(),
    submitBusinessReview: jest.fn(),
  },
}));

// ── Import component and mocked helpers after mocks ───────────────────────────

import { EnhancedHubSheet } from "../EnhancedHubSheet";
import type { EnhancedHubSheetProps } from "../EnhancedHubSheet";
import { api } from "@/lib/api/client";

// Cast through unknown to avoid TS overlap error when widening the mock shape.
const mockedApi = api as unknown as {
  getBusinessEvents: jest.Mock;
  getBusinessReviews: jest.Mock;
  getMyBusinessCheckin: jest.Mock;
  submitBusinessReview: jest.Mock;
};

// ── Fixtures ──────────────────────────────────────────────────────────────────

const businessProfile: EnhancedHubSheetProps["businessProfile"] = {
  businessId: "biz-001",
  ownerId: "owner-uid",
  name: "The Golden Bean",
  logoUrl: "https://example.com/logo.png",
  description: "A fine coffee shop",
  isActiveSubscription: true,
  mediaUrls: [],
};

function buildProps(overrides: Partial<EnhancedHubSheetProps> = {}): EnhancedHubSheetProps {
  return {
    visible: true,
    onClose: jest.fn(),
    businessProfile,
    placeName: "Golden Bean - Downtown",
    isCheckedIn: false,
    onViewLeaderboard: jest.fn(),
    ...overrides,
  };
}

/** Resolved responses for the common "data loaded" case. */
const EMPTY_EVENTS = { events: [] };
const EMPTY_REVIEWS = { averageRating: null as null, totalReviews: 0, reviews: [] };

/** Never-resolving promise keeps a section in its loading state. */
const PENDING = new Promise<never>(() => {});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("EnhancedHubSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Safe defaults: both calls hang so individual tests can control their state.
    mockedApi.getBusinessEvents.mockReturnValue(PENDING);
    mockedApi.getBusinessReviews.mockReturnValue(PENDING);
    mockedApi.getMyBusinessCheckin.mockReturnValue(PENDING);
  });

  // ── Header rendering ─────────────────────────────────────────────────────

  describe("header section", () => {
    it("renders the business name", async () => {
      mockedApi.getBusinessEvents.mockResolvedValue(EMPTY_EVENTS);
      mockedApi.getBusinessReviews.mockResolvedValue(EMPTY_REVIEWS);

      await act(async () => {
        render(<EnhancedHubSheet {...buildProps()} />);
      });

      expect(screen.getByText("The Golden Bean")).toBeTruthy();
    });

    it("renders the Verified Partner badge", async () => {
      mockedApi.getBusinessEvents.mockResolvedValue(EMPTY_EVENTS);
      mockedApi.getBusinessReviews.mockResolvedValue(EMPTY_REVIEWS);

      await act(async () => {
        render(<EnhancedHubSheet {...buildProps()} />);
      });

      expect(screen.getByText("Verified Partner")).toBeTruthy();
    });

    it("renders the logo Image when logoUrl is provided", async () => {
      mockedApi.getBusinessEvents.mockResolvedValue(EMPTY_EVENTS);
      mockedApi.getBusinessReviews.mockResolvedValue(EMPTY_REVIEWS);

      await act(async () => {
        render(<EnhancedHubSheet {...buildProps()} />);
      });

      const logo = screen.getByTestId("hub-logo");
      expect(logo).toBeTruthy();
      expect(logo.props.source).toEqual({ uri: "https://example.com/logo.png" });
    });

    it("renders a placeholder (no hub-logo element) when logoUrl is null", async () => {
      mockedApi.getBusinessEvents.mockResolvedValue(EMPTY_EVENTS);
      mockedApi.getBusinessReviews.mockResolvedValue(EMPTY_REVIEWS);

      await act(async () => {
        render(
          <EnhancedHubSheet
            {...buildProps({
              businessProfile: { ...businessProfile, logoUrl: null },
            })}
          />,
        );
      });

      expect(screen.queryByTestId("hub-logo")).toBeNull();
      // Business name is still present
      expect(screen.getByText("The Golden Bean")).toBeTruthy();
    });

    it("renders the place name beneath the business name", async () => {
      mockedApi.getBusinessEvents.mockResolvedValue(EMPTY_EVENTS);
      mockedApi.getBusinessReviews.mockResolvedValue(EMPTY_REVIEWS);

      await act(async () => {
        render(<EnhancedHubSheet {...buildProps()} />);
      });

      expect(screen.getByText(/Golden Bean - Downtown/)).toBeTruthy();
    });

    it("renders the business description when provided", async () => {
      mockedApi.getBusinessEvents.mockResolvedValue(EMPTY_EVENTS);
      mockedApi.getBusinessReviews.mockResolvedValue(EMPTY_REVIEWS);

      await act(async () => {
        render(<EnhancedHubSheet {...buildProps()} />);
      });

      expect(screen.getByText("A fine coffee shop")).toBeTruthy();
    });
  });

  // ── Events section ───────────────────────────────────────────────────────

  describe("Upcoming Events section", () => {
    it("renders the section heading", async () => {
      mockedApi.getBusinessEvents.mockResolvedValue(EMPTY_EVENTS);
      mockedApi.getBusinessReviews.mockResolvedValue(EMPTY_REVIEWS);

      await act(async () => {
        render(<EnhancedHubSheet {...buildProps()} />);
      });

      expect(screen.getByText("Upcoming Events")).toBeTruthy();
    });

    it("shows skeleton placeholder rows while events are loading", async () => {
      // Events stays pending; reviews resolves so the component settles.
      mockedApi.getBusinessEvents.mockReturnValue(PENDING);
      mockedApi.getBusinessReviews.mockResolvedValue(EMPTY_REVIEWS);

      await act(async () => {
        render(<EnhancedHubSheet {...buildProps()} />);
      });

      // The events section renders two SkeletonRow elements while loading.
      const skeletons = screen.getAllByTestId("skeleton-row");
      expect(skeletons.length).toBeGreaterThanOrEqual(2);
    });

    it("shows 'No upcoming events' empty state when events array is empty", async () => {
      mockedApi.getBusinessEvents.mockResolvedValue(EMPTY_EVENTS);
      mockedApi.getBusinessReviews.mockResolvedValue(EMPTY_REVIEWS);

      await act(async () => {
        render(<EnhancedHubSheet {...buildProps()} />);
      });

      await waitFor(() => {
        expect(screen.getByText("No upcoming events")).toBeTruthy();
      });
    });

    it("renders an upcoming event title when the API returns future events", async () => {
      const futureStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const futureEnd = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();

      mockedApi.getBusinessEvents.mockResolvedValue({
        events: [
          {
            eventId: 1,
            title: "Summer Jazz Night",
            description: null,
            imageUrl: null,
            startTime: futureStart,
            endTime: futureEnd,
          },
        ],
      });
      mockedApi.getBusinessReviews.mockResolvedValue(EMPTY_REVIEWS);

      await act(async () => {
        render(<EnhancedHubSheet {...buildProps()} />);
      });

      await waitFor(() => {
        expect(screen.getByText("Summer Jazz Night")).toBeTruthy();
      });
    });
  });

  // ── Reviews section ──────────────────────────────────────────────────────

  describe("Reviews section", () => {
    it("renders the section heading", async () => {
      mockedApi.getBusinessEvents.mockResolvedValue(EMPTY_EVENTS);
      mockedApi.getBusinessReviews.mockResolvedValue(EMPTY_REVIEWS);

      await act(async () => {
        render(<EnhancedHubSheet {...buildProps()} />);
      });

      expect(screen.getByText("Reviews")).toBeTruthy();
    });

    it("shows skeleton placeholder rows while reviews are loading", async () => {
      mockedApi.getBusinessEvents.mockResolvedValue(EMPTY_EVENTS);
      mockedApi.getBusinessReviews.mockReturnValue(PENDING);

      await act(async () => {
        render(<EnhancedHubSheet {...buildProps()} />);
      });

      // The reviews section also renders SkeletonRow elements while loading.
      const skeletons = screen.getAllByTestId("skeleton-row");
      expect(skeletons.length).toBeGreaterThanOrEqual(2);
    });

    it("hides the aggregate rating row when there are no reviews", async () => {
      mockedApi.getBusinessEvents.mockResolvedValue(EMPTY_EVENTS);
      mockedApi.getBusinessReviews.mockResolvedValue(EMPTY_REVIEWS);

      await act(async () => {
        render(<EnhancedHubSheet {...buildProps()} />);
      });

      // The "(N)" label is only rendered when totalReviews > 0.
      expect(screen.queryByText(/\(\d+\)/)).toBeNull();
    });

    it("shows the aggregate rating label when reviews exist", async () => {
      mockedApi.getBusinessEvents.mockResolvedValue(EMPTY_EVENTS);
      mockedApi.getBusinessReviews.mockResolvedValue({
        averageRating: 4.5,
        totalReviews: 12,
        reviews: [],
      });

      await act(async () => {
        render(<EnhancedHubSheet {...buildProps()} />);
      });

      await waitFor(() => {
        expect(screen.getByText("4.5 (12)")).toBeTruthy();
      });
    });

    it("does not show the Write a review button for the business owner", async () => {
      mockedApi.getBusinessEvents.mockResolvedValue(EMPTY_EVENTS);
      mockedApi.getBusinessReviews.mockResolvedValue(EMPTY_REVIEWS);

      await act(async () => {
        render(
          <EnhancedHubSheet
            {...buildProps({
              // authedUid === "test-user-uid" (from useApp mock above)
              businessProfile: { ...businessProfile, ownerId: "test-user-uid" },
            })}
          />,
        );
      });

      await waitFor(() => {
        expect(screen.queryByText("Write a review")).toBeNull();
      });
    });
  });

  // ── Action row ────────────────────────────────────────────────────────────

  describe("action row", () => {
    it("always renders the Leaderboard button", async () => {
      mockedApi.getBusinessEvents.mockResolvedValue(EMPTY_EVENTS);
      mockedApi.getBusinessReviews.mockResolvedValue(EMPTY_REVIEWS);

      await act(async () => {
        render(<EnhancedHubSheet {...buildProps()} />);
      });

      expect(screen.getByText("Leaderboard")).toBeTruthy();
    });

    it("renders the Check in button when onCheckin callback is provided", async () => {
      mockedApi.getBusinessEvents.mockResolvedValue(EMPTY_EVENTS);
      mockedApi.getBusinessReviews.mockResolvedValue(EMPTY_REVIEWS);

      await act(async () => {
        render(
          <EnhancedHubSheet {...buildProps({ onCheckin: jest.fn() })} />,
        );
      });

      expect(screen.getByText("Check in")).toBeTruthy();
    });

    it("omits the Check in button when onCheckin is not provided", async () => {
      mockedApi.getBusinessEvents.mockResolvedValue(EMPTY_EVENTS);
      mockedApi.getBusinessReviews.mockResolvedValue(EMPTY_REVIEWS);

      await act(async () => {
        render(<EnhancedHubSheet {...buildProps({ onCheckin: undefined })} />);
      });

      expect(screen.queryByText("Check in")).toBeNull();
    });
  });
});
