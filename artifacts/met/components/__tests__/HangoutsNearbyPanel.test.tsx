import React from "react";
import * as Location from "expo-location";
import { ActivityIndicator, AppState, Image, Platform, StyleSheet, Text } from "react-native";
import renderer, { act } from "react-test-renderer";

import { HomePlanDiscovery } from "../HomePlanDiscovery";
import { HangoutsNearbyPanel } from "../HangoutsNearbyPanel";
import EventsScreen from "@/app/(tabs)/events";
import PlansScreen from "@/app/plans";
import type { EventFeedItem, NearbyHangoutItem } from "@workspace/api-client-react";

const mockPush = jest.fn();
const mockSetParams = jest.fn();
const mockQueryClient = { invalidateQueries: jest.fn() };
// eslint-disable-next-line no-var
var mockRsvpCommunityEvent = jest.fn().mockResolvedValue(undefined);
let mockEventsFeed: EventFeedItem[] = [];
let mockEventsFeedStatus: {
  isLoading: boolean;
  isError: boolean;
  refetch: jest.Mock;
};
let mockRouteParams: Record<string, string> = {};
let mockNearbyParams: Record<string, unknown> = {};
let mockNearbyHangouts: NearbyHangoutItem[] = [];
let mockNearbyStatus: {
  isLoading: boolean;
  isError: boolean;
  refetch: jest.Mock;
};
let mockAppStateListener: ((state: string) => void) | null = null;

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, setParams: mockSetParams }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { Feather: (props: Record<string, unknown>) => React.createElement(View, props) };
});

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#fff",
    card: "#fff",
    border: "#ddd",
    text: "#111",
    mutedForeground: "#666",
    primary: "#16834b",
    primarySoft: "#e5f3ea",
    primaryForeground: "#fff",
    destructive: "#d33",
  }),
}));

jest.mock("@/lib/i18n", () => ({
  useT: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key === "tabs.events.distanceAway" && options?.distance
        ? `${key}: ${options.distance}`
        : key,
    lang: "en",
    rtl: false,
  }),
}));

jest.mock("@/contexts/AppContext", () => ({
  useApp: () => ({ authedUid: "test-user" }),
}));

jest.mock("@workspace/api-client-react", () => ({
  getGetEventsFeedQueryKey: () => ["events-feed"],
  getGetMyPastHangoutsQueryKey: () => ["my-past-hangouts"],
  getGetNearbyHangoutsQueryKey: () => ["nearby-hangouts"],
  useGetEventsFeed: () => ({
    data: { events: mockEventsFeed },
    ...mockEventsFeedStatus,
    isSuccess: true,
    isFetching: false,
    isRefetching: false,
  }),
  useGetNearbyHangouts: (params: Record<string, unknown>) => {
    mockNearbyParams = params;
    return {
      data: { events: mockNearbyHangouts, nextOffset: null },
      ...mockNearbyStatus,
      isFetching: false,
    };
  },
  useGetMyPastHangouts: () => ({
    data: { events: [] },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useRsvpCommunityEvent: () => ({ mutateAsync: mockRsvpCommunityEvent }),
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false, isError: false }),
  useQueryClient: () => mockQueryClient,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/hooks/useEventReminderCleanup", () => ({
  useEventReminderCleanup: jest.fn(),
}));

jest.mock("@/lib/api/client", () => ({
  api: { rsvpEvent: jest.fn() },
  ApiError: class ApiError extends Error {},
}));

function hangout(id: number): EventFeedItem {
  return {
    id,
    eventType: "member",
    visibility: "public",
    joinApprovalRequired: true,
    ownerUid: "another-user",
    myRsvp: null,
    myJoinRequestStatus: null,
    title: `Hangout ${id}`,
    startsAt: "2030-05-02T18:00:00.000Z",
    location: "City park",
  } as EventFeedItem;
}

function venueEvent(
  id: number,
  latitude: number | null = 13.7653,
  longitude: number | null = 100.5018,
): EventFeedItem {
  return {
    ...hangout(id),
    eventType: "venue",
    joinApprovalRequired: false,
    latitude,
    longitude,
    venueName: "City venue",
  } as EventFeedItem;
}

describe("Hangouts discovery", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockPush.mockClear();
    mockSetParams.mockClear();
    mockQueryClient.invalidateQueries.mockClear();
    mockRsvpCommunityEvent.mockReset().mockResolvedValue(undefined);
    mockEventsFeed = [];
    mockEventsFeedStatus = {
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    };
    mockRouteParams = {};
    mockNearbyParams = {};
    mockNearbyHangouts = [];
    mockNearbyStatus = {
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    };
    mockAppStateListener = null;
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: true,
      status: "denied",
    });
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: true,
      status: "denied",
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 13.7563, longitude: 100.5018 },
    });
    (Location.getForegroundPermissionsAsync as jest.Mock).mockClear();
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockClear();
    (Location.getCurrentPositionAsync as jest.Mock).mockClear();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
      mockAppStateListener = listener as (state: string) => void;
      return { remove: jest.fn() } as never;
    });
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      writable: true,
      value: "ios",
    });
  });

  it("keeps friend plans separate and shows the Hangout host photo", () => {
    mockEventsFeed = [
      {
        ...hangout(72),
        myJoinRequestStatus: "pending",
      },
      {
        ...hangout(73),
        myRsvp: "going",
        myJoinRequestStatus: "accepted",
        creatorName: "Hangout host",
        creatorPhotoUrl: "https://example.com/host.jpg",
      },
      hangout(74),
      {
        ...hangout(71),
        visibility: "invite_only",
        joinApprovalRequired: false,
        ownerUid: "test-user",
      },
    ];
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<HomePlanDiscovery />);
    });

    expect(root.root.findByProps({ testID: "home-plan-71" })).toBeTruthy();
    expect(root.root.findByProps({ testID: "home-hangout-72" })).toBeTruthy();
    expect(root.root.findByProps({ testID: "home-hangout-73" })).toBeTruthy();
    expect(root.root.findByProps({ testID: "home-hangout-74" })).toBeTruthy();
    expect(root.root.findByProps({ testID: "home-hangout-creator-photo-73" }).props.source.uri)
      .toBe("https://example.com/host.jpg");
    expect(root.root.findByProps({ testID: "home-hangout-creator-73" }).props.children)
      .toEqual(["tabs.events.createdBy", " ", "Hangout host"]);
    expect(
      root.root.find((node) => node.type === Image && node.props.source.uri === "https://example.com/host.jpg"),
    ).toBeTruthy();
    act(() => root.root.findByProps({ testID: "home-hangout-73" }).props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/event-chat/73");
    act(() => root.unmount());
  });

  it("shows just nearest and soonest sorting on the Hangouts tab", async () => {
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventsScreen />);
      await Promise.resolve();
    });
    expect(root.root.findByProps({ testID: "events-heading" }).props.children)
      .toBe("tabs.events.nearbyTab");
    expect(root.root.findByProps({ testID: "hangouts-sort-nearest" })).toBeTruthy();
    act(() => {
      root.root.findByProps({ testID: "events-view-hangouts" }).props.onPress();
    });

    expect(mockSetParams).toHaveBeenCalledWith({ view: "hangouts" });
    expect(root.root.findByProps({ testID: "hangouts-sort-nearest" })).toBeTruthy();
    const soonest = root.root.findByProps({ testID: "hangouts-sort-soonest" });
    act(() => soonest.props.onPress());
    expect(root.root.findByProps({ testID: "hangouts-sort-soonest" }).props.accessibilityState.selected)
      .toBe(true);
    expect(root.root.findAllByProps({ testID: "hangouts-keyword-search" })).toHaveLength(0);
    act(() => root.unmount());
  });

  it("announces the selected Events tabs and includes Hangout details", async () => {
    mockRouteParams = { view: "hangouts" };
    mockNearbyHangouts = [
      {
        ...hangout(66),
        title: "Riverside coffee",
        description: "Meet for coffee and conversation",
        creatorName: "Jordan",
      } as NearbyHangoutItem,
    ];
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventsScreen />);
      await Promise.resolve();
    });

    expect(root.root.findByProps({ testID: "events-heading" }).props.accessibilityRole)
      .toBe("header");
    expect(root.root.findByProps({ testID: "events-view-tabs" }).props.accessibilityRole)
      .toBe("tablist");
    expect(root.root.findByProps({ testID: "events-view-hangouts" }).props)
      .toMatchObject({
        accessibilityRole: "tab",
        accessibilityLabel: "tabs.events.nearbyTab",
        accessibilityState: { selected: true },
      });
    expect(root.root.findByProps({ testID: "events-view-events" }).props.accessibilityState)
      .toEqual({ selected: false });
    expect(root.root.findByProps({ testID: "hangouts-sort-nearest" }).props.accessibilityState)
      .toEqual({ selected: true });
    expect(
      StyleSheet.flatten(
        root.root.findByProps({ testID: "nearby-hangout-banner-topline-66" }).props.style,
      ).flexWrap,
    ).toBe("wrap");

    const hangoutCard = root.root.findByProps({ testID: "nearby-hangout-66" });
    expect(hangoutCard.props.accessibilityLabel).toContain("Riverside coffee");
    expect(hangoutCard.props.accessibilityLabel).toContain("Jordan");
    expect(hangoutCard.props.accessibilityLabel).toContain("Meet for coffee and conversation");
    const description = root.root.findAllByType(Text).find(
      (node) => node.props.children === "Meet for coffee and conversation",
    );
    expect(description?.props.numberOfLines).toBeUndefined();
    act(() => root.unmount());
  });

  it("keeps past Hangouts and Networks in the Events top bar", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<EventsScreen />);
    });

    act(() => root.root.findByProps({ testID: "events-past-hangouts" }).props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/plans");
    act(() => root.root.findByProps({ testID: "events-networks" }).props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/networks");
    act(() => root.unmount());
  });

  it("shows the requested Events heading when the Events view is selected", () => {
    mockRouteParams = { view: "events" };
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<EventsScreen />);
    });

    expect(root.root.findByProps({ testID: "events-heading" }).props.children)
      .toBe("tabs.events.title");
    act(() => root.unmount());
  });

  it("groups Events by date, shows gallery photos, and opens the existing detail route", () => {
    mockRouteParams = { view: "events" };
    const firstDate = new Date(2030, 4, 2, 18, 0, 0);
    const secondDate = new Date(2030, 4, 3, 18, 0, 0);
    const coverPhoto = "https://example.com/event-cover.jpg";
    const secondPhoto = "https://example.com/event-second.jpg";
    mockEventsFeed = [
      {
        ...venueEvent(94),
        title: "Gallery opening",
        description: "A quiet opening night for local artists",
        startsAt: firstDate.toISOString(),
        galleryPhotos: [coverPhoto, secondPhoto],
      } as EventFeedItem,
      {
        ...venueEvent(95),
        title: "Sunday market",
        startsAt: secondDate.toISOString(),
      },
    ];
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<EventsScreen />);
    });

    const dateHeaders = root.root
      .findAll((node) =>
        node.type === Text &&
        node.props.accessibilityRole === "header" &&
        node.props.testID !== "events-heading",
      )
      .map((node) => node.props.children);
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: "long",
      month: "long",
      day: "numeric",
      ...(firstDate.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
    };
    expect(dateHeaders).toEqual([
      new Intl.DateTimeFormat("en", dateOptions).format(firstDate),
      new Intl.DateTimeFormat("en", dateOptions).format(secondDate),
    ]);
    expect(root.root.findByProps({ testID: "event-card-gallery-venue-94" })).toBeTruthy();
    expect(root.root.findByProps({ testID: "event-card-gallery-venue-94-image" }).props.source.uri)
      .toBe(coverPhoto);
    expect(root.root.findByProps({ testID: "event-card-gallery-venue-94-image-1" }).props.source.uri)
      .toBe(secondPhoto);
    expect(root.root.findByProps({ testID: "event-card-gallery-venue-94-indicator" }).props.children.props.children)
      .toEqual([1, " / ", 2]);
    const eventCard = root.root.findByProps({ testID: "event-card-venue-94" });
    expect(eventCard.props.accessibilityLabel)
      .toContain("A quiet opening night for local artists");
    const eventDescription = root.root.findAllByType(Text).find(
      (node) => node.props.children === "A quiet opening night for local artists",
    );
    expect(eventDescription?.props.numberOfLines).toBeUndefined();

    act(() => root.root.findByProps({ testID: "event-card-venue-94" }).props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/event-details/venue/94");
    act(() => root.unmount());
  });

  it("shows the Events empty state and keeps its browse-Hangouts action", () => {
    mockRouteParams = { view: "events" };
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<EventsScreen />);
    });

    expect(root.root.findAllByType(Text).some((node) => node.props.children === "tabs.events.empty"))
      .toBe(true);
    act(() => root.root.findByProps({ testID: "events-empty-browse-hangouts" }).props.onPress());
    expect(mockSetParams).toHaveBeenCalledWith({ view: "hangouts" });
    act(() => root.unmount());
  });

  it("keeps the Events loading and retry states connected to feed status", () => {
    mockRouteParams = { view: "events" };
    mockEventsFeedStatus.isLoading = true;
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<EventsScreen />);
    });
    expect(root.root.findByType(ActivityIndicator)).toBeTruthy();
    act(() => root.unmount());

    mockEventsFeedStatus.isLoading = false;
    mockEventsFeedStatus.isError = true;
    act(() => {
      root = renderer.create(<EventsScreen />);
    });
    act(() => root.root.findByProps({ testID: "events-feed-retry" }).props.onPress());
    expect(mockEventsFeedStatus.refetch).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it("routes a nearby Hangout to its existing detail page", async () => {
    mockRouteParams = { view: "hangouts" };
    mockNearbyHangouts = [hangout(46) as NearbyHangoutItem];
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventsScreen />);
      await Promise.resolve();
    });

    act(() => root.root.findByProps({ testID: "nearby-hangout-46" }).props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/event-details/member/46");
    act(() => root.unmount());
  });

  it("submits an RSVP for the selected event using its real event ID", async () => {
    mockRouteParams = { view: "events" };
    mockEventsFeed = [{ ...hangout(96), joinApprovalRequired: false }];
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventsScreen />);
      await Promise.resolve();
    });
    await act(async () => {
      root.root.findByProps({ testID: "event-rsvp-member-96-going" }).props.onPress();
      await Promise.resolve();
    });

    expect(mockRsvpCommunityEvent).toHaveBeenCalledWith({
      eventId: 96,
      data: { status: "going" },
    });
    act(() => root.unmount());
  });

  it("features the first nearby Hangout photo and preserves its press callback", () => {
    const first = {
      ...hangout(44),
      imageUrl: "https://example.com/featured-hangout.jpg",
      creatorName: "Featured host",
    } as NearbyHangoutItem;
    const second = {
      ...hangout(45),
      imageUrl: "https://example.com/second-hangout.jpg",
    } as NearbyHangoutItem;
    const onPressHangout = jest.fn();
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <HangoutsNearbyPanel
          hangouts={[first, second]}
          userLocation={null}
          sortMode="nearest"
          onSortModeChange={jest.fn()}
          nearestFallsBackToTime={false}
          isLoading={false}
          isLoadingMore={false}
          isError={false}
          hasMore={false}
          onLoadMore={jest.fn()}
          onRetry={jest.fn()}
          onPressHangout={onPressHangout}
        />,
      );
    });

    const featuredBannerHeight = StyleSheet.flatten(
      root.root.findByProps({ testID: "nearby-hangout-banner-44" }).props.style,
    ).minHeight;
    const standardBannerHeight = StyleSheet.flatten(
      root.root.findByProps({ testID: "nearby-hangout-banner-45" }).props.style,
    ).minHeight;
    expect(featuredBannerHeight).toBeGreaterThan(standardBannerHeight);
    expect(root.root.findAllByType(Image).some((node) =>
      node.props.source?.uri === "https://example.com/featured-hangout.jpg",
    )).toBe(true);
    act(() => root.root.findByProps({ testID: "nearby-hangout-44" }).props.onPress());
    expect(onPressHangout).toHaveBeenCalledWith(first);
    act(() => root.unmount());
  });

  it("keeps nearby Hangout loading, empty, and retry states visible", () => {
    const onRetry = jest.fn();
    const props = {
      hangouts: [],
      userLocation: null,
      sortMode: "nearest" as const,
      onSortModeChange: jest.fn(),
      nearestFallsBackToTime: false,
      isLoadingMore: false,
      hasMore: false,
      onLoadMore: jest.fn(),
      onRetry,
      onPressHangout: jest.fn(),
    };
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<HangoutsNearbyPanel {...props} isLoading isError={false} />);
    });
    expect(root.root.findByType(ActivityIndicator)).toBeTruthy();
    act(() => root.unmount());

    act(() => {
      root = renderer.create(<HangoutsNearbyPanel {...props} isLoading={false} isError={false} />);
    });
    expect(root.root.findAllByType(Text).some((node) => node.props.children === "tabs.events.noHangouts"))
      .toBe(true);
    act(() => root.unmount());

    act(() => {
      root = renderer.create(
        <HangoutsNearbyPanel
          {...props}
          isLoading={false}
          isError={false}
          isLoadingMore
          hasMore
        />,
      );
    });
    expect(root.root.findByProps({ testID: "hangouts-load-more" }).props)
      .toMatchObject({
        accessibilityLabel: "tabs.events.loadMoreHangouts",
        accessibilityState: { busy: true, disabled: true },
      });
    act(() => root.unmount());

    act(() => {
      root = renderer.create(<HangoutsNearbyPanel {...props} isLoading={false} isError />);
    });
    act(() => root.root.findByProps({ testID: "hangouts-retry" }).props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it("shows a rounded distance on event cards without sharing coordinates", async () => {
    mockRouteParams = { view: "events" };
    mockEventsFeed = [venueEvent(91), venueEvent(92, null, null)];
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: "granted",
    });
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventsScreen />);
      await Promise.resolve();
    });

    expect(root.root.findAllByProps({ testID: "event-card-distance-91" })).toHaveLength(0);
    await act(async () => {
      root.root.findByProps({ testID: "events-enable-nearby-sorting" }).props.onPress();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(root.root.findByProps({ testID: "event-card-distance-91" }).props.children)
      .toBe("tabs.events.distanceAway: ~1 km");
    expect(root.root.findAllByProps({ testID: "event-card-distance-92" })).toHaveLength(0);
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    act(() => {
      root.root.findByProps({ testID: "event-card-venue-91" }).props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith("/event-details/venue/91");
    expect(mockPush.mock.calls[0][0]).not.toContain("13.7653");
    expect(mockPush.mock.calls[0][0]).not.toContain("100.5018");
    act(() => root.unmount());
  });

  it("hides event-card distance and does not request location when location is unavailable", async () => {
    mockRouteParams = { view: "events" };
    mockEventsFeed = [venueEvent(93)];
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventsScreen />);
      await Promise.resolve();
    });

    expect(root.root.findAllByProps({ testID: "event-card-distance-93" })).toHaveLength(0);
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("keeps public Hangouts out of the private Plans screen", () => {
    mockEventsFeed = [
      hangout(82),
      {
        ...hangout(83),
        title: "Dinner with friends",
        location: "Riverside market",
        creatorName: "Sam",
        visibility: "invite_only",
        joinApprovalRequired: false,
        ownerUid: "test-user",
      },
      {
        ...hangout(84),
        title: "Long weekend walk with friends",
        location: "A very long location name that should wrap when text is enlarged",
        creatorName: "Avery",
        startsAt: "2030-05-04T18:00:00.000Z",
        visibility: "invite_only",
        joinApprovalRequired: false,
        ownerUid: "test-user",
      },
    ];
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<PlansScreen />);
    });

    const plan = root.root.findByProps({ testID: "plan-row-83" });
    expect(plan.props.accessibilityRole).toBe("button");
    expect(plan.props.accessibilityLabel).toContain("Dinner with friends");
    expect(plan.props.accessibilityLabel).toContain("Riverside market");
    expect(plan.props.accessibilityLabel).toContain("Sam");
    expect(plan.props.accessibilityHint).toBe("plans.openChatTitleA11y");
    expect(root.root.findAllByType(Text).find(
      (node) => node.props.children === "plans.screenTitle",
    )?.props.accessibilityRole).toBe("header");
    const planTitle = root.root.findAllByType(Text).find(
      (node) => node.props.children === "Dinner with friends",
    );
    expect(planTitle?.props.numberOfLines).toBeUndefined();
    const planLocation = root.root.findAllByType(Text).find(
      (node) => node.props.children === "Riverside market",
    );
    expect(planLocation?.props.numberOfLines).toBeUndefined();
    const planHost = root.root.findAllByType(Text).find(
      (node) => node.props.children === "Sam",
    );
    expect(planHost?.props.numberOfLines).toBeUndefined();
    const featuredDateStyle = StyleSheet.flatten(
      root.root.findByProps({ testID: "plan-featured-date-83" }).props.style,
    );
    const standardDateStyle = StyleSheet.flatten(
      root.root.findByProps({ testID: "plan-date-badge-84" }).props.style,
    );
    const dateColumnStyle = StyleSheet.flatten(
      root.root.findByProps({ testID: "plan-date-column-84" }).props.style,
    );
    expect(featuredDateStyle.minHeight).toBe(55);
    expect(featuredDateStyle.height).toBeUndefined();
    expect(standardDateStyle.minHeight).toBe(53);
    expect(standardDateStyle.height).toBeUndefined();
    expect(dateColumnStyle.minWidth).toBe(54);
    expect(dateColumnStyle.width).toBeUndefined();
    expect(root.root.findAllByProps({ testID: "plan-row-82" })).toHaveLength(0);
    act(() => root.unmount());
  });

  it("asks for location when nearest sorting is selected", async () => {
    mockRouteParams = { view: "hangouts" };
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: "granted",
    });
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventsScreen />);
      await Promise.resolve();
    });
    await act(async () => {
      root.root.findByProps({ testID: "hangouts-sort-nearest" }).props.onPress();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it("refreshes location and nearby Hangouts when returning to the foreground", async () => {
    mockRouteParams = { view: "hangouts" };
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: "granted",
    });
    (Location.getCurrentPositionAsync as jest.Mock)
      .mockResolvedValueOnce({ coords: { latitude: 13.7563, longitude: 100.5018 } })
      .mockResolvedValueOnce({ coords: { latitude: 13.8, longitude: 100.52 } });
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventsScreen />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockNearbyParams).toMatchObject({
      latitude: 13.7563,
      longitude: 100.5018,
    });
    expect(mockAppStateListener).not.toBeNull();
    await act(async () => {
      mockAppStateListener?.("background");
      mockAppStateListener?.("active");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
    expect(mockNearbyParams).toMatchObject({
      latitude: 13.8,
      longitude: 100.52,
    });
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nearby-hangouts"],
    });
    act(() => root.unmount());
  });

  it("clears an old location without prompting if permission is unavailable on resume", async () => {
    mockRouteParams = { view: "hangouts" };
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: "granted",
    });
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventsScreen />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockNearbyParams).toMatchObject({
      latitude: 13.7563,
      longitude: 100.5018,
    });
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: true,
      status: "denied",
    });
    await act(async () => {
      mockAppStateListener?.("background");
      mockAppStateListener?.("active");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
    expect(mockNearbyParams.latitude).toBeUndefined();
    expect(mockNearbyParams.longitude).toBeUndefined();
    act(() => root.unmount());
  });

  it("shows the host and pending request status on nearby Hangout cards", () => {
    const item = {
      eventType: "member",
      id: 42,
      title: "Coffee nearby",
      description: null,
      imageUrl: null,
      startsAt: "2030-05-02T18:00:00.000Z",
      location: "City park",
      latitude: null,
      longitude: null,
      creatorName: "Host",
      creatorPhotoUrl: "https://example.com/host.jpg",
      myJoinRequestStatus: "pending",
      verifiedExplorersOnly: false,
      isVerifiedExplorerHost: false,
    } as NearbyHangoutItem;
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <HangoutsNearbyPanel
          hangouts={[item]}
          userLocation={null}
          sortMode="nearest"
          onSortModeChange={jest.fn()}
          nearestFallsBackToTime
          isLoading={false}
          isLoadingMore={false}
          isError={false}
          hasMore={false}
          onLoadMore={jest.fn()}
          onRetry={jest.fn()}
          onPressHangout={jest.fn()}
        />,
      );
    });

    expect(root.root.findByProps({ testID: "nearby-hangout-42" })).toBeTruthy();
    expect(root.root.findByProps({ testID: "nearby-hangout-banner-42" })).toBeTruthy();
    expect(
      root.root.findByProps({ testID: "nearby-hangout-creator-photo-42" }),
    ).toBeTruthy();
    expect(root.root.findByProps({ testID: "nearby-hangout-creator-42" }).props.children)
      .toBe("Host");
    expect(
      root.root.findByProps({ testID: "nearby-hangout-status-42" }).findByType(Text).props.children,
    ).toBe("tabs.events.joinRequestPending");
    act(() => root.unmount());
  });

  it("shows only a rounded approximate distance on nearby Hangout cards", () => {
    const item = {
      ...hangout(43),
      latitude: 13.7653,
      longitude: 100.5018,
    } as NearbyHangoutItem;
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <HangoutsNearbyPanel
          hangouts={[item]}
          userLocation={{ latitude: 13.7563, longitude: 100.5018 }}
          sortMode="nearest"
          onSortModeChange={jest.fn()}
          nearestFallsBackToTime={false}
          isLoading={false}
          isLoadingMore={false}
          isError={false}
          hasMore={false}
          onLoadMore={jest.fn()}
          onRetry={jest.fn()}
          onPressHangout={jest.fn()}
        />,
      );
    });

    expect(root.root.findByProps({ testID: "nearby-hangout-distance-43" }).props.children)
      .toBe("tabs.events.distanceAway: ~1 km");
    act(() => root.unmount());
  });

  it("shows Hangouts without a search field or local filtering", () => {
    const coffee = {
      ...hangout(41),
      description: "Coffee and conversation",
      creatorName: "Sam",
    } as NearbyHangoutItem;
    const music = {
      ...hangout(42),
      title: "Evening music",
      location: "Riverside",
      description: "Bring a blanket",
      creatorName: "Lee",
    } as NearbyHangoutItem;
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <HangoutsNearbyPanel
          hangouts={[coffee, music]}
          userLocation={null}
          sortMode="nearest"
          onSortModeChange={jest.fn()}
          nearestFallsBackToTime={false}
          isLoading={false}
          isLoadingMore={false}
          isError={false}
          hasMore={false}
          onLoadMore={jest.fn()}
          onRetry={jest.fn()}
          onPressHangout={jest.fn()}
        />,
      );
    });

    expect(root.root.findAllByProps({ testID: "hangouts-keyword-search" })).toHaveLength(0);
    expect(root.root.findByProps({ testID: "nearby-hangout-41" })).toBeTruthy();
    expect(root.root.findByProps({ testID: "nearby-hangout-42" })).toBeTruthy();
    act(() => root.unmount());
  });
});
