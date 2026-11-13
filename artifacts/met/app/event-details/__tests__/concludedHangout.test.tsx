import React from "react";
import renderer, { act } from "react-test-renderer";
import { Image } from "react-native";

const baseEvent = {
  id: 42,
  eventType: "member",
  ownerUid: "hangout-host",
  joinApprovalRequired: true,
  startsAt: "2025-04-03T12:00:00.000Z",
  endsAt: "2025-04-03T14:00:00.000Z",
  title: "Coffee in the park",
  description: "This longer description should not appear in the concluded summary.",
  imageUrl: "https://example.test/hangout.jpg",
  location: "Lumphini Park",
  venueName: null,
  visibility: "public",
  isInvited: false,
  myRsvp: null,
  myJoinRequestStatus: "accepted",
  creatorName: "Host Name",
  creatorPhotoUrl: null,
  meetingHostRating: {
    averageRating: 4.5,
    reviewCount: 2,
    myRating: null,
  },
};
let mockEvent = { ...baseEvent };
let mockRouteParams: { eventType: string; id: string } = {
  eventType: "member",
  id: "42",
};
const mockQueryClient = { invalidateQueries: jest.fn().mockResolvedValue(undefined) };
const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn() };
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { Feather: (props: Record<string, unknown>) => React.createElement(View, props) };
});
jest.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey?: unknown[] }) =>
    options.queryKey?.[0] === "event-details"
      ? { data: mockEvent, isLoading: false, error: undefined }
      : { data: undefined, isLoading: false, error: undefined },
  useQueryClient: () => mockQueryClient,
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockRouteParams,
  useRouter: () => mockRouter,
}));
jest.mock("expo-location", () => ({
  useForegroundPermissions: () => [null, jest.fn()],
  Accuracy: { Highest: 6 },
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock("@/contexts/AppContext", () => ({
  useApp: () => ({ authedUid: "guest-user" }),
}));
jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#fff",
    border: "#ddd",
    card: "#fafafa",
    destructive: "#c00",
    muted: "#eee",
    mutedForeground: "#666",
    primary: "#30a83c",
    primaryForeground: "#fff",
    primarySoft: "#e5f4e5",
    text: "#111",
  }),
}));
jest.mock("@/lib/i18n", () => ({
  useT: () => ({ lang: "en", t: (key: string) => key }),
}));
jest.mock("@/lib/api/client", () => ({
  api: { getCommunityStanding: jest.fn() },
  ApiError: class ApiError extends Error {},
}));
jest.mock("@/lib/firestore/client", () => ({ getAppCheckToken: jest.fn() }));
jest.mock("@/lib/eventLinks", () => ({ buildEventDetailsUrl: jest.fn() }));
jest.mock("@/lib/eventReminders", () => ({ cancelEventReminder: jest.fn() }));
jest.mock("@/components/EventFollowThroughActions", () => () => null);
jest.mock("@/components/TrustScoreBadge", () => ({ TrustScoreBadge: () => null }));
jest.mock("react-native-keyboard-controller", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    KeyboardAvoidingView: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement(View, props, children),
  };
});
jest.mock("@workspace/api-client-react", () => ({
  getGetEventDetailsQueryKey: () => ["event-details"],
  getGetEventReviewsQueryKey: () => ["event-reviews"],
  getGetEventDetailsQueryOptions: () => ({ queryKey: ["event-details-options"] }),
  getGetCommunityEventForEditQueryOptions: () => ({ queryKey: ["event-edit-options"] }),
  getGetEventsFeedQueryKey: () => ["events-feed"],
  checkInEventByLocation: jest.fn(),
  useDeleteCommunityEvent: () => ({ mutate: jest.fn(), isPending: false }),
  useCreateCommunityEventInviteLink: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useCreateVenueOwnerEventInviteLink: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useReportCommunityEvent: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRsvpCommunityEvent: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRateCommunityEventHost: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useGetEventReviews: () => ({ data: undefined, isLoading: false, isError: false }),
  useCreateEventReview: () => ({ mutateAsync: jest.fn(), isPending: false, error: null }),
  useRequestToJoinCommunityEvent: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useWithdrawCommunityEventJoinRequest: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

import EventDetailsScreen from "../[eventType]/[id]";

function renderScreen() {
  let root!: renderer.ReactTestRenderer;
  act(() => {
    root = renderer.create(<EventDetailsScreen />);
  });
  return root;
}

describe("event detail layouts", () => {
  beforeEach(() => {
    mockEvent = { ...baseEvent };
    mockRouteParams = { eventType: "member", id: "42" };
  });

  it("shows a short completed summary and keeps host reviews while hiding active-event content", () => {
    const root = renderScreen();

    expect(root.root.findByProps({ testID: "concluded-hangout-summary" })).toBeTruthy();
    expect(root.root.findAllByProps({ testID: "hangout-creator-rating" }).length).toBeGreaterThan(0);
    expect(root.root.findAllByProps({ testID: "event-reviews" }).length).toBeGreaterThan(0);
    expect(root.root.findAllByProps({ testID: "button-open-plan-chat" })).toHaveLength(0);
    expect(root.root.findAllByProps({ testID: "button-request-to-join" })).toHaveLength(0);
    expect(
      root.root.findAll((node) => node.props.children === mockEvent.description),
    ).toHaveLength(0);
    expect(root.root.findAllByType(Image)).toHaveLength(0);

    act(() => root.unmount());
  });

  it("gives active Hangouts their own visual hero", () => {
    mockEvent = {
      ...baseEvent,
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
    };

    const root = renderScreen();

    expect(root.root.findByProps({ testID: "event-detail-hangout-hero" })).toBeTruthy();
    expect(root.root.findAllByProps({ testID: "event-detail-plan-hero" })).toHaveLength(0);
    expect(root.root.findAllByProps({ testID: "event-detail-standard-hero" })).toHaveLength(0);
    act(() => root.unmount());
  });

  it("gives invite-only Plans their own date-first visual hero", () => {
    mockEvent = {
      ...baseEvent,
      joinApprovalRequired: false,
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
      visibility: "invite_only",
    };

    const root = renderScreen();

    expect(root.root.findByProps({ testID: "event-detail-plan-hero" })).toBeTruthy();
    expect(root.root.findAllByProps({ testID: "event-detail-hangout-hero" })).toHaveLength(0);
    expect(root.root.findAllByProps({ testID: "event-detail-standard-hero" })).toHaveLength(0);
    act(() => root.unmount());
  });

  it("keeps venue Event details on the standard event layout", () => {
    mockEvent = {
      ...baseEvent,
      eventType: "venue",
      joinApprovalRequired: false,
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
      visibility: "public",
    };
    mockRouteParams = { eventType: "venue", id: "42" };

    const root = renderScreen();

    expect(root.root.findByProps({ testID: "event-detail-standard-hero" })).toBeTruthy();
    expect(root.root.findAllByProps({ testID: "event-detail-hangout-hero" })).toHaveLength(0);
    expect(root.root.findAllByProps({ testID: "event-detail-plan-hero" })).toHaveLength(0);
    act(() => root.unmount());
  });
});
