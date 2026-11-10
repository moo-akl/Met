import React from "react";
import * as Location from "expo-location";
import { AppState, Linking, Platform, type AppStateStatus } from "react-native";
import renderer, { act } from "react-test-renderer";

import { HomePlanDiscovery } from "../HomePlanDiscovery";
import { HangoutsNearbyPanel } from "../HangoutsNearbyPanel";
import type { EventFeedItem, NearbyHangoutItem } from "@workspace/api-client-react";
import EventsScreen from "@/app/(tabs)/events";
import PlansScreen from "@/app/plans";

const mockPush = jest.fn();
const mockSetParams = jest.fn();
const mockQueryClient = { invalidateQueries: jest.fn() };
let mockEventsFeed: unknown[] = [];
let mockRouteParams: Record<string, string> = {};
let mockAppStateChange: ((state: AppStateStatus) => void) | undefined;

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
    t: (key: string) => key,
    lang: "en",
    rtl: false,
  }),
}));

jest.mock("@/contexts/AppContext", () => ({
  useApp: () => ({ authedUid: "test-user" }),
}));

jest.mock("@workspace/api-client-react", () => ({
  getGetEventsFeedQueryKey: () => ["events-feed"],
  getGetNearbyHangoutsQueryKey: () => ["nearby-hangouts"],
  useGetEventsFeed: () => ({
    data: { events: mockEventsFeed },
    isLoading: false,
    isError: false,
    isSuccess: true,
    isFetching: false,
    isRefetching: false,
    refetch: jest.fn(),
  }),
  useGetNearbyHangouts: () => ({
    data: { events: [], nextOffset: null },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useRsvpCommunityEvent: () => ({ mutateAsync: jest.fn() }),
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

function expandHangoutFilters(root: renderer.ReactTestRenderer) {
  expect(root.root.findByProps({ testID: "hangouts-sort-options" })).toBeTruthy();
}

function makeHangout(id: number): EventFeedItem {
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

describe("Hangouts entry and filters", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockAppStateChange = undefined;
    jest.spyOn(AppState, "addEventListener").mockImplementation((eventName, listener) => {
      if (eventName === "change") mockAppStateChange = listener;
      return { remove: jest.fn() };
    });
    jest.restoreAllMocks();
    mockPush.mockClear();
    mockSetParams.mockClear();
    mockQueryClient.invalidateQueries.mockClear();
    mockEventsFeed = [];
    mockRouteParams = {};
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: false,
      status: "denied",
    });
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: false,
      status: "denied",
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 0, longitude: 0 },
    });
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      writable: true,
      value: "ios",
    });
  });

  it("opens Hangouts from the home section", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<HomePlanDiscovery />);
    });

    expect(root.root.findByProps({ testID: "home-create-hangout" })).toBeTruthy();
    act(() => {
      root.root.findByProps({ testID: "home-hangouts-nearby" }).props.onPress();
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(tabs)/events",
      params: { view: "hangouts" },
    });
    act(() => root.unmount());
  });

  it("keeps friend plans and public hangouts in separate Home sections", () => {
    mockEventsFeed = [
      {
        id: 71,
        eventType: "member",
        visibility: "invite_only",
        joinApprovalRequired: false,
        ownerUid: "test-user",
        myRsvp: null,
        myJoinRequestStatus: null,
        title: "Dinner with friends",
        startsAt: "2030-05-01T18:00:00.000Z",
        location: "Riverside",
      },
      {
        id: 72,
        eventType: "member",
        visibility: "public",
        joinApprovalRequired: true,
        ownerUid: "another-user",
        myRsvp: null,
        myJoinRequestStatus: "pending",
        title: "Public park walk",
        startsAt: "2030-05-02T18:00:00.000Z",
        location: "City park",
      },
    ];
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<HomePlanDiscovery />);
    });

    expect(root.root.findByProps({ testID: "home-plan-71" })).toBeTruthy();
    expect(root.root.findByProps({ testID: "home-hangout-72" })).toBeTruthy();
    expect(root.root.findAllByProps({ testID: "home-plan-72" })).toHaveLength(0);
    act(() => root.unmount());
  });

  it("opens the Hangouts tab from the Events screen and consumes the Home route", async () => {
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventsScreen />);
      await Promise.resolve();
    });

    act(() => {
      root.root.findByProps({ testID: "events-view-hangouts" }).props.onPress();
    });

    expect(mockSetParams).toHaveBeenCalledWith({ view: "hangouts" });
    expect(root.root.findAllByProps({ testID: "hangouts-filter-toggle" })).toHaveLength(0);
    expect(root.root.findAllByProps({ testID: "hangouts-keyword-search" })).toHaveLength(0);
    expandHangoutFilters(root);
    expect(root.root.findByProps({ testID: "hangouts-use-location" })).toBeTruthy();
    act(() => root.unmount());

    mockRouteParams = { view: "hangouts" };
    await act(async () => {
      root = renderer.create(<EventsScreen />);
      await Promise.resolve();
    });
    expandHangoutFilters(root);
    expect(root.root.findByProps({ testID: "hangouts-use-location" })).toBeTruthy();
    act(() => root.unmount());
  });

  it("offers Settings after permanent location denial without search or filters", async () => {
    mockRouteParams = { view: "hangouts" };
    const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventsScreen />);
      await Promise.resolve();
    });
    expect(root.root.findAllByProps({ testID: "hangouts-filter-toggle" })).toHaveLength(0);
    expect(root.root.findAllByProps({ testID: "hangouts-keyword-search" })).toHaveLength(0);
    expect(root.root.findAllByProps({ testID: "hangouts-location-search" })).toHaveLength(0);
    expect(root.root.findAllByProps({ testID: "hangouts-date-filter" })).toHaveLength(0);
    expect(root.root.findAllByProps({ testID: "hangouts-time-evening" })).toHaveLength(0);
    expect(
      root.root.findAll((node) => node.props.accessibilityRole === "alert")
        .some((node) => node.props.children === "tabs.events.locationDenied"),
    ).toBe(true);
    expect(root.root.findByProps({ testID: "hangouts-use-location" }).props.accessibilityLabel)
      .toBe("tabs.events.openLocationSettings");
    await act(async () => {
      root.root.findByProps({ testID: "hangouts-use-location" }).props.onPress();
      await Promise.resolve();
    });
    expect(openSettings).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    openSettings.mockRestore();
  });

  it("fetches a fresh location when permission was granted in Settings", async () => {
    mockRouteParams = { view: "hangouts" };
    const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventsScreen />);
      await Promise.resolve();
    });
    expandHangoutFilters(root);

    expect(root.root.findByProps({ testID: "hangouts-use-location" }).props.accessibilityLabel)
      .toBe("tabs.events.openLocationSettings");
    await act(async () => {
      root.root.findByProps({ testID: "hangouts-use-location" }).props.onPress();
      await Promise.resolve();
    });
    expect(openSettings).toHaveBeenCalledTimes(1);

    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: "granted",
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 13.7563, longitude: 100.5018 },
    });
    const onAppStateChange = mockAppStateChange;
    expect(onAppStateChange).toBeDefined();

    await act(async () => {
      onAppStateChange?.("background");
      onAppStateChange?.("active");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
    expect(root.root.findByProps({ testID: "hangouts-use-location" }).props.accessibilityLabel)
      .toBe("tabs.events.updateLocation");
    expect(root.root.findAll((node) => node.props.accessibilityRole === "alert"))
      .toHaveLength(0);
    act(() => root.unmount());
    openSettings.mockRestore();
  });

  it("clears the saved location when permission is revoked while away", async () => {
    mockRouteParams = { view: "hangouts" };
    (Location.getForegroundPermissionsAsync as jest.Mock)
      .mockResolvedValueOnce({
        granted: true,
        canAskAgain: true,
        status: "granted",
      })
      .mockResolvedValueOnce({
        granted: false,
        canAskAgain: true,
        status: "denied",
      });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 13.7563, longitude: 100.5018 },
    });

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventsScreen />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expandHangoutFilters(root);
    expect(root.root.findByProps({ testID: "hangouts-use-location" }).props.accessibilityLabel)
      .toBe("tabs.events.updateLocation");

    await act(async () => {
      mockAppStateChange?.("background");
      mockAppStateChange?.("active");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(root.root.findByProps({ testID: "hangouts-use-location" }).props.accessibilityLabel)
      .toBe("tabs.events.useLocation");
    expect(
      root.root.findAll((node) => node.props.accessibilityRole === "alert")
        .some((node) => node.props.children === "tabs.events.locationDenied"),
    ).toBe(true);
    act(() => root.unmount());
  });

  it("keeps a request-and-retry action when location permission can be requested again", async () => {
    mockRouteParams = { view: "hangouts" };
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
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventsScreen />);
      await Promise.resolve();
    });
    expandHangoutFilters(root);

    await act(async () => {
      root.root.findByProps({ testID: "hangouts-use-location" }).props.onPress();
      await Promise.resolve();
    });
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(root.root.findByProps({ testID: "hangouts-use-location" }).props.accessibilityLabel)
      .toBe("tabs.events.useLocation");

    await act(async () => {
      root.root.findByProps({ testID: "hangouts-use-location" }).props.onPress();
      await Promise.resolve();
    });
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(2);
    act(() => {
      root.root.findByProps({ testID: "hangouts-sort-soonest" }).props.onPress();
    });
    expect(root.root.findByProps({ testID: "hangouts-sort-soonest" }).props.accessibilityState.selected)
      .toBe(true);
    act(() => root.unmount());
  });

  it("exposes location actions and only nearest/soonest sorting", () => {
    const onSortModeChange = jest.fn();
    const onUseLocation = jest.fn();
    const onLoadMore = jest.fn();
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <HangoutsNearbyPanel
          hangouts={[]}
          userLocation={null}
          locationLoading={false}
          locationError={null}
          locationNeedsSettings={false}
          onUseLocation={onUseLocation}
          onOpenSettings={jest.fn()}
          sortMode="nearest"
          onSortModeChange={onSortModeChange}
          nearestFallsBackToTime
          isLoading={false}
          isLoadingMore={false}
          isError={false}
          hasMore
          onLoadMore={onLoadMore}
          onRetry={jest.fn()}
          onPressHangout={jest.fn()}
        />,
      );
    });
    expect(root.root.findByProps({ testID: "hangouts-sort-nearest" })).toBeTruthy();
    expect(root.root.findByProps({ testID: "hangouts-sort-soonest" })).toBeTruthy();
    for (const testID of [
      "hangouts-keyword-search",
      "hangouts-location-search",
      "hangouts-date-filter",
      "hangouts-time-evening",
      "hangouts-filter-toggle",
    ]) {
      expect(root.root.findAllByProps({ testID })).toHaveLength(0);
    }
    act(() => {
      root.root.findByProps({ testID: "hangouts-sort-soonest" }).props.onPress();
      root.root.findByProps({ testID: "hangouts-use-location" }).props.onPress();
    });
    expect(onSortModeChange).toHaveBeenCalledWith("soonest");
    expect(onUseLocation).toHaveBeenCalledTimes(1);
    expect(root.root.findByProps({ testID: "hangouts-nearest-fallback" })).toBeTruthy();
    act(() => root.root.findByProps({ testID: "hangouts-load-more" }).props.onPress());
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it("shows all loaded Hangouts without a search field and shows the host photo in the banner", () => {
    const hangouts = [
      {
        id: 41, eventType: "member", title: "Coffee chat", description: "Coffee and conversation",
        startsAt: "2030-05-02T18:00:00.000Z", location: "City park", latitude: null, longitude: null,
        creatorName: "Sam", creatorPhotoUrl: "https://example.com/sam.jpg", imageUrl: null,
      },
      {
        id: 42, eventType: "member", title: "Evening music", description: "Bring a blanket",
        startsAt: "2030-05-03T18:00:00.000Z", location: "Riverside", latitude: null, longitude: null,
        creatorName: "Lee", creatorPhotoUrl: null, imageUrl: null,
      },
    ] as unknown as NearbyHangoutItem[];
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <HangoutsNearbyPanel
          hangouts={hangouts}
          userLocation={null}
          locationLoading={false}
          locationError={null}
          locationNeedsSettings={false}
          onUseLocation={jest.fn()}
          onOpenSettings={jest.fn()}
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
    expect(root.root.findByProps({ testID: "nearby-hangout-creator-photo-41" }).props.source.uri)
      .toBe("https://example.com/sam.jpg");
    act(() => root.unmount());
  });

  it("keeps public Hangouts out of the private Plans screen", () => {
    mockEventsFeed = [
      { ...makeHangout(82), visibility: "public" },
      {
        ...makeHangout(83),
        visibility: "invite_only",
        joinApprovalRequired: false,
        ownerUid: "test-user",
      },
    ];
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<PlansScreen />); });
    expect(root.root.findByProps({ testID: "plan-row-83" })).toBeTruthy();
    expect(root.root.findAllByProps({ testID: "plan-row-82" })).toHaveLength(0);
    act(() => root.unmount());
  });

});
