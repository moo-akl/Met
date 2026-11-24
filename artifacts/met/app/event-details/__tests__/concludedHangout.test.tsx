import React from "react";
import renderer, { act } from "react-test-renderer";
import { Image, Modal, StyleSheet, Text, View } from "react-native";
import { waitFor } from "@testing-library/react-native";
import type { EventWelcomeNoteStyle } from "@workspace/api-client-react";
import { VENUE_GUESTBOOK_THEME } from "@/lib/venueGuestbookTheme";

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
  contactPhone: null as string | null,
  websiteUrl: null as string | null,
  publicEmail: null as string | null,
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
let mockRouteParams: { eventType: string; id: string; approxDistance?: string } = {
  eventType: "member",
  id: "42",
};
const mockQueryClient = { invalidateQueries: jest.fn().mockResolvedValue(undefined) };
const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn() };
const mockRequestLocationPermission = jest.fn();
const mockOpenVenueManager = jest.fn();
const mockWelcomeNoteStorage = new Map<string, string>();
const mockDeleteMemberEvent = jest.fn();
const mockDeleteVenueEvent = jest.fn();
const DEFAULT_WELCOME_NOTE_STYLE = {
  font: "classic",
  color: "ink",
  card: "paper",
} as EventWelcomeNoteStyle;
const CUSTOM_WELCOME_NOTE_STYLE = {
  font: "handwritten",
  color: "forest",
  card: "garden",
} as EventWelcomeNoteStyle;
const mockClaimEventWelcomeNote = jest.fn(async (_input: unknown) => ({
  welcomeNote: null as string | null,
  welcomeNoteStyle: DEFAULT_WELCOME_NOTE_STYLE,
}));
const mockAcknowledgeEventWelcomeNote = jest.fn(async (_input: unknown) => ({
  success: true,
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) =>
      Promise.resolve(mockWelcomeNoteStorage.get(key) ?? null),
    setItem: (key: string, value: string) => {
      mockWelcomeNoteStorage.set(key, value);
      return Promise.resolve();
    },
  },
}));
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { Feather: (props: Record<string, unknown>) => React.createElement(View, props) };
});
jest.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey?: unknown[] }) => {
    if (options.queryKey?.[0] === "event-details") {
      return { data: mockEvent, isLoading: false, error: undefined };
    }
    if (options.queryKey?.[0] === "venue-owner-event") {
      const isOwner = mockEvent.eventType === "venue" && mockEvent.ownerUid === "guest-user";
      return {
        data: isOwner ? { event: mockEvent } : undefined,
        isLoading: false,
        isSuccess: isOwner,
        error: undefined,
      };
    }
    return { data: undefined, isLoading: false, error: undefined };
  },
  useQueryClient: () => mockQueryClient,
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockRouteParams,
  useRouter: () => mockRouter,
}));
jest.mock("expo-location", () => ({
  useForegroundPermissions: () => [null, mockRequestLocationPermission],
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
    secondaryForeground: "#276238",
    text: "#111",
    foreground: "#111",
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
  useDeleteCommunityEvent: () => ({ mutate: mockDeleteMemberEvent, isPending: false }),
  useDeleteVenueOwnerMeEvent: () => ({ mutate: mockDeleteVenueEvent, isPending: false }),
  useCreateCommunityEventInviteLink: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useCreateVenueOwnerEventInviteLink: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useReportCommunityEvent: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRsvpCommunityEvent: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRateCommunityEventHost: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useGetEventReviews: () => ({ data: undefined, isLoading: false, isError: false }),
  useCreateEventReview: () => ({ mutateAsync: jest.fn(), isPending: false, error: null }),
  useRequestToJoinCommunityEvent: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useWithdrawCommunityEventJoinRequest: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useClaimEventWelcomeNote: () => ({ mutateAsync: mockClaimEventWelcomeNote }),
  useAcknowledgeEventWelcomeNote: () => ({
    mutateAsync: mockAcknowledgeEventWelcomeNote,
  }),
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
    mockWelcomeNoteStorage.clear();
    mockClaimEventWelcomeNote.mockReset().mockResolvedValue({
      welcomeNote: null,
      welcomeNoteStyle: DEFAULT_WELCOME_NOTE_STYLE,
    });
    mockAcknowledgeEventWelcomeNote
      .mockReset()
      .mockResolvedValue({ success: true });
    mockEvent = { ...baseEvent };
    mockRouteParams = { eventType: "member", id: "42" };
    mockRequestLocationPermission.mockClear();
  });

  it("shows a claimed welcome note in a dismissible card only for an accepted participant", async () => {
    mockClaimEventWelcomeNote.mockResolvedValue({
      welcomeNote: "The picnic tables are near the lake.",
      welcomeNoteStyle: CUSTOM_WELCOME_NOTE_STYLE,
    });
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventDetailsScreen />);
      await Promise.resolve();
    });

    expect(mockClaimEventWelcomeNote).toHaveBeenCalledWith({
      eventType: "member",
      eventId: 42,
    });
    expect(root.root.findByProps({ testID: "event-welcome-note-card" })).toBeTruthy();
    expect(root.root.findByProps({ testID: "event-welcome-note-body" }).props.children)
      .toBe("The picnic tables are near the lake.");
    expect(
      StyleSheet.flatten(
        root.root.findByProps({ testID: "event-welcome-note-body" }).props.style,
      ),
    ).toMatchObject({
      color: "#276238",
      fontFamily: "Caveat_500Medium",
      fontSize: 21,
    });
    await act(async () => {
      await root.root.findByType(Modal).props.onShow();
    });
    expect(mockWelcomeNoteStorage.get(
      "met:eventWelcomeNoteSeen:v1:guest-user:member:42",
    )).toBe("1");
    expect(mockAcknowledgeEventWelcomeNote).toHaveBeenCalledWith({
      eventType: "member",
      eventId: 42,
    });
    act(() => {
      root.root.findByProps({ testID: "event-welcome-note-dismiss" }).props.onPress();
    });
    expect(root.root.findAllByProps({ testID: "event-welcome-note-card" })).toHaveLength(0);

    act(() => root.unmount());

    for (const status of ["pending", "declined"] as const) {
      mockClaimEventWelcomeNote.mockClear();
      mockEvent = { ...baseEvent, myJoinRequestStatus: status, myRsvp: null };
      const nonParticipantRoot = renderScreen();
      expect(mockClaimEventWelcomeNote).not.toHaveBeenCalled();
      expect(
        nonParticipantRoot.root.findAllByProps({ testID: "event-welcome-note-card" }),
      ).toHaveLength(0);
      act(() => nonParticipantRoot.unmount());
    }
  });

  it("retries a lost claim response and acknowledges after displaying the note", async () => {
    mockClaimEventWelcomeNote
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce({
        welcomeNote: "The tables are beside the lake.",
        welcomeNoteStyle: DEFAULT_WELCOME_NOTE_STYLE,
      });

    const root = renderScreen();
    await waitFor(
      () => expect(mockClaimEventWelcomeNote).toHaveBeenCalledTimes(2),
      { timeout: 2_000, interval: 50 },
    );
    expect(root.root.findByProps({ testID: "event-welcome-note-card" })).toBeTruthy();
    await act(async () => {
      await root.root.findByType(Modal).props.onShow();
    });
    expect(mockAcknowledgeEventWelcomeNote).toHaveBeenCalledWith({
      eventType: "member",
      eventId: 42,
    });
    act(() => root.unmount());
  });

  it("renders the guestbook treatment on the recipient welcome note", async () => {
    mockClaimEventWelcomeNote.mockResolvedValue({
      welcomeNote: "Thank you for joining us. ".repeat(8),
      welcomeNoteStyle: {
        font: "handwritten",
        color: "ink",
        card: "guestbook",
      },
    });
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventDetailsScreen />);
      await Promise.resolve();
    });

    const card = root.root.findByProps({ testID: "event-welcome-note-style-card" });
    expect(card.findByProps({ testID: "event-welcome-note-style-card-rules" })).toBeTruthy();
    expect(card.findByProps({ testID: "event-welcome-note-style-card-margin" })).toBeTruthy();
    expect(card.findByProps({ testID: "event-welcome-note-style-card-heart" })).toBeTruthy();
    const renderedCard = card.findByType(View);
    expect(StyleSheet.flatten(renderedCard.props.style)).toMatchObject({
      backgroundColor: VENUE_GUESTBOOK_THEME.paper,
      borderColor: VENUE_GUESTBOOK_THEME.rule,
      borderRadius: 4,
    });
    expect(
      StyleSheet.flatten(
        card.findByProps({ testID: "event-welcome-note-body" }).props.style,
      ),
    ).toMatchObject({
      color: VENUE_GUESTBOOK_THEME.ink,
      fontFamily: VENUE_GUESTBOOK_THEME.handFont,
      fontSize: 18,
      lineHeight: 27,
      marginLeft: 30,
    });
    const body = card.findByProps({ testID: "event-welcome-note-body" });
    expect(body.props.allowFontScaling).toBe(true);
    expect(body.props.children).toBe("Thank you for joining us. ".repeat(8));
    act(() => root.unmount());
  });

  it("does not show a note again when the same participant reopens the event", async () => {
    mockWelcomeNoteStorage.set(
      "met:eventWelcomeNoteSeen:v1:guest-user:member:42",
      "1",
    );

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventDetailsScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockClaimEventWelcomeNote).not.toHaveBeenCalled();
    expect(mockAcknowledgeEventWelcomeNote).toHaveBeenCalledWith({
      eventType: "member",
      eventId: 42,
    });
    expect(root.root.findAllByProps({ testID: "event-welcome-note-card" })).toHaveLength(0);
    act(() => root.unmount());
  });

  it("retries an acknowledgment after reopening without showing the note again", async () => {
    mockClaimEventWelcomeNote.mockResolvedValue({
      welcomeNote: "The tables are beside the lake.",
      welcomeNoteStyle: DEFAULT_WELCOME_NOTE_STYLE,
    });
    mockAcknowledgeEventWelcomeNote
      .mockRejectedValueOnce(new Error("ack response lost"))
      .mockResolvedValueOnce({ success: true });

    let firstRoot!: renderer.ReactTestRenderer;
    await act(async () => {
      firstRoot = renderer.create(<EventDetailsScreen />);
      await Promise.resolve();
    });
    expect(firstRoot.root.findByProps({ testID: "event-welcome-note-card" })).toBeTruthy();
    await act(async () => {
      await firstRoot.root.findByType(Modal).props.onShow();
    });
    expect(mockWelcomeNoteStorage.get(
      "met:eventWelcomeNoteSeen:v1:guest-user:member:42",
    )).toBe("1");
    act(() => firstRoot.unmount());

    mockClaimEventWelcomeNote.mockClear();
    let reopenedRoot!: renderer.ReactTestRenderer;
    await act(async () => {
      reopenedRoot = renderer.create(<EventDetailsScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockClaimEventWelcomeNote).not.toHaveBeenCalled();
    expect(mockAcknowledgeEventWelcomeNote).toHaveBeenCalledTimes(2);
    expect(reopenedRoot.root.findAllByProps({ testID: "event-welcome-note-card" }))
      .toHaveLength(0);
    act(() => reopenedRoot.unmount());
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
    expect(root.root.findAllByProps({ testID: "hangout-action-dock" })).toHaveLength(0);
    expect(root.root.findByProps({ testID: "button-open-plan-chat" })).toBeTruthy();
    act(() => root.unmount());
  });

  it("keeps an unaccepted Hangout request action in a bottom dock", () => {
    mockEvent = {
      ...baseEvent,
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
      myJoinRequestStatus: "pending",
    };

    const root = renderScreen();
    const dock = root.root.findByProps({ testID: "hangout-action-dock" });
    const requestButton = root.root.findByProps({ testID: "button-request-to-join" });

    expect(requestButton.props.accessibilityLabel).toBe("tabs.events.cancelJoinRequest");
    expect(requestButton.findByType(Text).props.children).toBe("tabs.events.cancelJoinRequest");
    expect(
      dock.findAllByType(Text).some((node) => node.props.children === "tabs.events.joinRequestPending"),
    ).toBe(true);
    act(() => root.unmount());
  });

  it("shows an approximate distance passed from nearby Hangout discovery without requesting location", () => {
    mockEvent = {
      ...baseEvent,
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
    };
    mockRouteParams = { eventType: "member", id: "42", approxDistance: "1400" };

    const root = renderScreen();

    expect(
      root.root
        .findByProps({ testID: "event-detail-hangout-distance" })
        .findByType(Text).props.children,
    ).toBe("tabs.events.distanceAway");
    expect(mockRequestLocationPermission).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("does not change Hangout details when no approximate distance is available", () => {
    mockEvent = {
      ...baseEvent,
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
    };

    const root = renderScreen();

    expect(root.root.findAllByProps({ testID: "event-detail-hangout-distance" }))
      .toHaveLength(0);
    expect(mockRequestLocationPermission).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("gives invite-only Plans an image-led hero with a swipeable gallery", () => {
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

  it("deletes a venue event through the venue-owner endpoint", () => {
    mockEvent = {
      ...baseEvent,
      eventType: "venue",
      ownerUid: "guest-user",
      joinApprovalRequired: false,
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
      placeId: "venue-42",
      visibility: "public",
    };
    mockRouteParams = { eventType: "venue", id: "42" };

    const root = renderScreen();

    act(() => {
      root.root.findByProps({ testID: "button-delete-event" }).props.onPress();
    });
    act(() => {
      root.root.findByProps({ testID: "button-confirm-delete-event" }).props.onPress();
    });

    expect(mockDeleteVenueEvent).toHaveBeenCalledWith({ eventId: 42 });
    expect(mockDeleteMemberEvent).not.toHaveBeenCalled();
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

  it("hides legacy websites on Plans and Hangouts but keeps Event and venue websites", () => {
    const legacyWebsite = "https://example.test/legacy";
    const futureSchedule = {
      startsAt: "2030-04-03T12:00:00.000Z",
      endsAt: "2030-04-03T14:00:00.000Z",
      websiteUrl: legacyWebsite,
    };

    mockEvent = {
      ...baseEvent,
      ...futureSchedule,
      joinApprovalRequired: true,
      visibility: "public",
    };
    let root = renderScreen();
    expect(root.root.findAllByProps({ testID: "event-website-link" })).toHaveLength(0);
    expect(root.root.findAllByProps({ testID: "event-contact-section" })).toHaveLength(0);
    act(() => root.unmount());

    mockEvent = {
      ...baseEvent,
      ...futureSchedule,
      joinApprovalRequired: false,
      visibility: "invite_only",
    };
    root = renderScreen();
    expect(root.root.findAllByProps({ testID: "event-website-link" })).toHaveLength(0);
    expect(root.root.findAllByProps({ testID: "event-contact-section" })).toHaveLength(0);
    act(() => root.unmount());

    mockEvent = {
      ...baseEvent,
      ...futureSchedule,
      joinApprovalRequired: false,
      visibility: "public",
    };
    root = renderScreen();
    expect(root.root.findByProps({ testID: "event-website-link" })).toBeTruthy();
    act(() => root.unmount());

    mockRouteParams = { eventType: "venue", id: "42" };
    mockEvent = {
      ...baseEvent,
      ...futureSchedule,
      eventType: "venue",
      joinApprovalRequired: false,
      visibility: "public",
    };
    root = renderScreen();
    expect(root.root.findByProps({ testID: "event-website-link" })).toBeTruthy();
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

  it("shows venue Event details with the date-first schedule card", () => {
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
    expect(root.root.findByProps({ testID: "event-detail-schedule" })).toBeTruthy();
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

  it("opens venue-event editing in the venue-owner event form", () => {
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

    expect(mockRouter.push).toHaveBeenCalledWith("/venue-owner/events/42");
    expect(mockOpenVenueManager).not.toHaveBeenCalled();
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
