import React from "react";
import * as Location from "expo-location";
import { AppState, Image, Platform } from "react-native";
import renderer, { act } from "react-test-renderer";

import { HomePlanDiscovery } from "../HomePlanDiscovery";
import { HangoutsNearbyPanel } from "../HangoutsNearbyPanel";
import EventsScreen from "@/app/(tabs)/events";
import PlansScreen from "@/app/plans";
import type { EventFeedItem, NearbyHangoutItem } from "@workspace/api-client-react";

const mockPush = jest.fn();
const mockSetParams = jest.fn();
const mockQueryClient = { invalidateQueries: jest.fn() };
let mockEventsFeed: EventFeedItem[] = [];
let mockRouteParams: Record<string, string> = {};

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
  getGetMyPastHangoutsQueryKey: () => ["my-past-hangouts"],
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
  useGetMyPastHangouts: () => ({
    data: { events: [] },
    isLoading: false,
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

describe("Hangouts discovery", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockPush.mockClear();
    mockSetParams.mockClear();
    mockQueryClient.invalidateQueries.mockClear();
    mockEventsFeed = [];
    mockRouteParams = {};
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
    jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: jest.fn() } as never);
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
      .toBe("tabs.events.hangoutsHeading");
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
      .toBe("tabs.events.eventsHeading");
    act(() => root.unmount());
  });

  it("keeps public Hangouts out of the private Plans screen", () => {
    mockEventsFeed = [
      hangout(82),
      {
        ...hangout(83),
        visibility: "invite_only",
        joinApprovalRequired: false,
        ownerUid: "test-user",
      },
    ];
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<PlansScreen />);
    });

    expect(root.root.findByProps({ testID: "plan-row-83" })).toBeTruthy();
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

  it("shows the host profile photo in each nearby Hangout banner", () => {
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
