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
  imageUrl: "https://example.test/hangout.jpg" as string | null,
  galleryPhotos: [] as string[],
  location: "Lumphini Park",
  placeId: null as string | null,
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
let mockEvent: Omit<typeof baseEvent, "myRsvp"> & {
  myRsvp: "going" | "maybe" | "not_going" | null;
} = { ...baseEvent };
let mockRouteParams: { eventType: string; id: string } = {
  eventType: "member",
  id: "42",
};
const mockQueryClient = { invalidateQueries: jest.fn().mockResolvedValue(undefined) };
const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn() };
const mockOpenVenueManager = jest.fn();
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
  getActiveVenueBusinessHeaders: () => ({}),
  getActiveVenueBusinessId: () => null,
}));
jest.mock("@/lib/firestore/client", () => ({ getAppCheckToken: jest.fn() }));
jest.mock("@/lib/eventLinks", () => ({ buildEventDetailsUrl: jest.fn() }));
jest.mock("@/lib/eventReminders", () => ({ cancelEventReminder: jest.fn() }));
jest.mock("@/lib/venueManagerLink", () => ({
  openVenueManager: (...args: unknown[]) => mockOpenVenueManager(...args),
}));
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
  getGetVenueOwnerMeEventQueryKey: () => ["venue-owner-event"],
  getGetVenueOwnerMeEventQueryOptions: () => ({ queryKey: ["venue-owner-event-options"] }),
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
    jest.clearAllMocks();
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
    const photos = [
      "https://example.test/hangout-1.jpg",
      "https://example.test/hangout-2.jpg",
    ];
    mockEvent = {
      ...baseEvent,
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
      galleryPhotos: photos,
    };

    const root = renderScreen();

    expect(root.root.findByProps({ testID: "event-detail-hangout-hero" })).toBeTruthy();
    const gallery = root.root.findByProps({
      testID: "event-detail-hangout-gallery",
    });
    expect(
      gallery.findByProps({ testID: "event-detail-hangout-gallery-scroll" })
        .props.horizontal,
    ).toBe(true);
    expect(
      gallery.findByProps({ testID: "event-detail-hangout-gallery-image-1" })
        .props.source.uri,
    ).toBe(photos[1]);
    expect(root.root.findAllByProps({ testID: "event-detail-plan-hero" })).toHaveLength(0);
    expect(root.root.findAllByProps({ testID: "event-detail-standard-hero" })).toHaveLength(0);
    act(() => root.unmount());
  });

  it("gives invite-only Plans their own date-first visual hero", () => {
    const photos = [
      "https://example.test/plan-1.jpg",
      "https://example.test/plan-2.jpg",
    ];
    mockEvent = {
      ...baseEvent,
      joinApprovalRequired: false,
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
      visibility: "invite_only",
      galleryPhotos: photos,
    };

    const root = renderScreen();

    expect(root.root.findByProps({ testID: "event-detail-plan-hero" })).toBeTruthy();
    const gallery = root.root.findByProps({
      testID: "event-detail-plan-gallery",
    });
    expect(
      gallery.findByProps({ testID: "event-detail-plan-gallery-scroll" })
        .props.horizontal,
    ).toBe(true);
    expect(
      gallery.findByProps({ testID: "event-detail-plan-gallery-image-1" })
        .props.source.uri,
    ).toBe(photos[1]);
    expect(root.root.findAllByProps({ testID: "event-detail-hangout-hero" })).toHaveLength(0);
    expect(root.root.findAllByProps({ testID: "event-detail-standard-hero" })).toHaveLength(0);
    act(() => root.unmount());
  });

  it("limits a private Plan creator to deleting the Plan, not RSVP or edit controls", () => {
    mockEvent = {
      ...baseEvent,
      ownerUid: "guest-user",
      joinApprovalRequired: false,
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
      visibility: "invite_only",
    };

    const root = renderScreen();

    expect(root.root.findAllByProps({ testID: "event-details-edit-button" })).toHaveLength(0);
    expect(root.root.findAllByProps({ testID: "button-direct-rsvp-going" })).toHaveLength(0);
    expect(root.root.findAllByProps({ testID: "button-direct-rsvp-maybe" })).toHaveLength(0);
    expect(root.root.findAllByProps({ testID: "button-direct-rsvp-not_going" })).toHaveLength(0);
    expect(
      root.root.findAll((node) => node.props.children === "tabs.events.rsvpHeading"),
    ).toHaveLength(0);
    expect(root.root.findByProps({ testID: "event-rsvp-count" })).toBeTruthy();
    act(() => {
      root.root.findByProps({ testID: "button-delete-event" }).props.onPress();
    });
    expect(root.root.findByProps({ testID: "button-confirm-delete-event" })).toBeTruthy();

    act(() => root.unmount());
  });

  it("keeps friend Plan acceptance and leaving controls for invitees", () => {
    mockEvent = {
      ...baseEvent,
      ownerUid: "another-user",
      isInvited: true,
      joinApprovalRequired: false,
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
      visibility: "invite_only",
      myRsvp: null,
    };

    const invitedRoot = renderScreen();
    expect(invitedRoot.root.findByProps({ testID: "button-accept-plan-invitation" })).toBeTruthy();
    act(() => invitedRoot.unmount());

    mockEvent = { ...mockEvent, myRsvp: "going" };
    const acceptedRoot = renderScreen();
    expect(acceptedRoot.root.findByProps({ testID: "button-leave-friend-plan" })).toBeTruthy();
    act(() => acceptedRoot.unmount());
  });

  it("keeps RSVP choices visible to a non-owner viewing a community event", () => {
    mockEvent = {
      ...baseEvent,
      ownerUid: "another-user",
      joinApprovalRequired: false,
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
      visibility: "public",
      myRsvp: null,
    };

    const root = renderScreen();
    expect(
      root.root.findAll(
        (node) =>
          node.props.accessibilityRole === "header" &&
          node.props.children === "tabs.events.rsvpHeading",
      ),
    ).not.toHaveLength(0);
    expect(root.root.findByProps({ testID: "button-direct-rsvp-going" })).toBeTruthy();
    expect(root.root.findByProps({ testID: "button-direct-rsvp-maybe" })).toBeTruthy();
    expect(root.root.findByProps({ testID: "button-direct-rsvp-not_going" })).toBeTruthy();
    act(() => root.unmount());
  });

  it("keeps direct RSVP controls for guests of venue events", () => {
    mockEvent = {
      ...baseEvent,
      eventType: "venue",
      ownerUid: "venue-owner",
      joinApprovalRequired: false,
      placeId: "venue-place",
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
      visibility: "public",
    };
    mockRouteParams = { eventType: "venue", id: "42" };

    const root = renderScreen();

    expect(root.root.findByProps({ testID: "button-direct-rsvp-going" })).toBeTruthy();
    expect(root.root.findByProps({ testID: "button-direct-rsvp-maybe" })).toBeTruthy();
    expect(root.root.findByProps({ testID: "button-direct-rsvp-not_going" })).toBeTruthy();
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

  it("shows the first of all uploaded photos in the standard event gallery", () => {
    const photos = [
      "https://example.test/event-1.jpg",
      "https://example.test/event-2.jpg",
      "https://example.test/event-3.jpg",
      "https://example.test/event-4.jpg",
    ];
    mockEvent = {
      ...baseEvent,
      eventType: "venue",
      joinApprovalRequired: false,
      visibility: "public",
      galleryPhotos: photos,
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
    };
    mockRouteParams = { eventType: "venue", id: "42" };

    const root = renderScreen();
    const gallery = root.root.findByProps({
      testID: "event-detail-standard-hero",
    });
    expect(
      gallery.findByProps({ testID: "event-detail-standard-hero-scroll" })
        .props.horizontal,
    ).toBe(true);
    expect(
      root.root.findByProps({ testID: "event-detail-standard-hero-image" }).props,
    ).toMatchObject({
      source: { uri: photos[0] },
      accessibilityLabel: "tabs.events.planPhotos, 1 of 4",
    });
    expect(
      root.root.findByProps({ testID: "event-detail-standard-hero-indicator" }),
    ).toBeTruthy();
    act(() => root.unmount());
  });

  it("keeps a single photo usable and shows the standard placeholder with no photos", () => {
    mockEvent = {
      ...baseEvent,
      eventType: "venue",
      joinApprovalRequired: false,
      visibility: "public",
      galleryPhotos: [],
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
    };
    mockRouteParams = { eventType: "venue", id: "42" };

    const singlePhotoRoot = renderScreen();
    const singlePhotoCarousel = singlePhotoRoot.root.findByProps({
      testID: "event-detail-standard-hero",
    });
    expect(
      singlePhotoCarousel.findByProps({
        testID: "event-detail-standard-hero-image",
      }).props.source.uri,
    ).toBe(baseEvent.imageUrl);
    expect(
      singlePhotoCarousel.findAllByProps({
        testID: "event-detail-standard-hero-indicator",
      }),
    ).toHaveLength(0);
    act(() => singlePhotoRoot.unmount());

    mockEvent = { ...mockEvent, imageUrl: null };
    const noPhotoRoot = renderScreen();
    expect(
      noPhotoRoot.root.findByProps({
        testID: "event-detail-standard-hero-placeholder",
      }),
    ).toBeTruthy();
    expect(
      noPhotoRoot.root.findAllByProps({ testID: "event-detail-standard-hero" }),
    ).toHaveLength(0);
    act(() => noPhotoRoot.unmount());
  });

  it("opens venue-event editing through the venue manager", () => {
    mockEvent = {
      ...baseEvent,
      eventType: "venue",
      ownerUid: "guest-user",
      joinApprovalRequired: false,
      placeId: "venue-place",
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
    };
    mockRouteParams = { eventType: "venue", id: "42" };

    const root = renderScreen();
    act(() => {
      root.root.findByProps({ testID: "event-details-edit-button" }).props.onPress();
    });

    expect(mockOpenVenueManager).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("hides guest check-in before the start while keeping RSVP, then shows it after start", () => {
    const startsAt = Date.now() + 60_000;
    mockEvent = {
      ...baseEvent,
      eventType: "venue",
      ownerUid: "venue-owner",
      joinApprovalRequired: false,
      placeId: "venue-place",
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(startsAt + 60 * 60_000).toISOString(),
      myRsvp: null,
    };
    mockRouteParams = { eventType: "venue", id: "42" };

    const root = renderScreen();
    expect(root.root.findAllByProps({ testID: "event-checkin-panel" })).toHaveLength(0);
    expect(root.root.findAll((node) => node.props.children === "tabs.events.rsvpHeading").length)
      .toBeGreaterThan(0);
    expect(root.root.findAllByProps({ testID: "button-scan-event-qr" })).toHaveLength(0);

    mockEvent = {
      ...mockEvent,
      startsAt: new Date(Date.now() - 1_000).toISOString(),
      endsAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    };
    act(() => root.update(<EventDetailsScreen />));

    expect(root.root.findByProps({ testID: "event-checkin-panel" })).toBeTruthy();
    expect(root.root.findByProps({ testID: "button-scan-event-qr" })).toBeTruthy();
    expect(root.root.findAllByProps({ testID: "button-check-in-by-location" })).toHaveLength(0);
    expect(root.root.findAll((node) => node.props.children === "tabs.events.attendanceGuestHint")).toHaveLength(0);
    act(() => root.unmount());
  });

  it("keeps the event owner's RSVP-management action available before the event starts", () => {
    const startsAt = Date.now() + 60_000;
    mockEvent = {
      ...baseEvent,
      eventType: "venue",
      ownerUid: "guest-user",
      joinApprovalRequired: false,
      placeId: "venue-place",
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(startsAt + 60 * 60_000).toISOString(),
    };
    mockRouteParams = { eventType: "venue", id: "42" };

    const root = renderScreen();
    expect(root.root.findByProps({ testID: "button-manage-event-attendance" })).toBeTruthy();
    expect(root.root.findAllByProps({ testID: "event-checkin-panel" })).toHaveLength(0);
    act(() => root.unmount());
  });

  it("keeps member-event editing on the community editor", () => {
    mockEvent = {
      ...baseEvent,
      ownerUid: "guest-user",
      joinApprovalRequired: false,
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
    };

    const root = renderScreen();
    act(() => {
      root.root.findByProps({ testID: "event-details-edit-button" }).props.onPress();
    });

    expect(mockRouter.push).toHaveBeenCalledWith("/event-edit/42");
    act(() => root.unmount());
  });

  it("keeps active Hangout editing on the community editor", () => {
    mockEvent = {
      ...baseEvent,
      ownerUid: "guest-user",
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
    };

    const root = renderScreen();
    act(() => {
      root.root.findByProps({ testID: "event-details-edit-button" }).props.onPress();
    });

    expect(mockRouter.push).toHaveBeenCalledWith("/event-edit/42");
    act(() => root.unmount());
  });

  it("does not show venue-event editing to someone who is not the owner", () => {
    mockEvent = {
      ...baseEvent,
      eventType: "venue",
      joinApprovalRequired: false,
      placeId: "venue-place",
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
    };
    mockRouteParams = { eventType: "venue", id: "42" };

    const root = renderScreen();

    expect(root.root.findAllByProps({ testID: "event-details-edit-button" })).toHaveLength(0);
    act(() => root.unmount());
  });

  it("hides venue-event editing when the venue manager route cannot identify its venue", () => {
    mockEvent = {
      ...baseEvent,
      eventType: "venue",
      ownerUid: "guest-user",
      joinApprovalRequired: false,
      placeId: null,
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
    };
    mockRouteParams = { eventType: "venue", id: "42" };

    const root = renderScreen();

    expect(root.root.findAllByProps({ testID: "event-details-edit-button" })).toHaveLength(0);
    act(() => root.unmount());
  });
});
