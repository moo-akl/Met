import React from "react";
import {
  cleanup,
  fireEvent,
  render,
} from "@testing-library/react-native";

// eslint-disable-next-line no-var
var mockRouterPush = jest.fn();
// eslint-disable-next-line no-var
var mockRouterBack = jest.fn();
// eslint-disable-next-line no-var
var mockPastHangouts: any;
// eslint-disable-next-line no-var
var mockEventsFeed: any;

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

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockRouterPush, back: mockRouterBack }),
}));

jest.mock("@/contexts/AppContext", () => ({
  useApp: () => ({ authedUid: "uid-1" }),
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#ffffff",
    card: "#f8f8f8",
    border: "#dddddd",
    primary: "#008800",
    primarySoft: "#e8f5e9",
    primaryForeground: "#ffffff",
    mutedForeground: "#666666",
    text: "#111111",
    foreground: "#111111",
    actionButton: "#008800",
    radius: 12,
  }),
}));

jest.mock("@/lib/i18n", () => ({
  useT: () => ({ t: (key: string) => key, lang: "en" }),
}));

jest.mock("@/hooks/useEventReminderCleanup", () => ({
  useEventReminderCleanup: jest.fn(),
}));

jest.mock("@workspace/api-client-react", () => ({
  getGetEventsFeedQueryKey: () => ["events-feed"],
  getGetMyPastHangoutsQueryKey: () => ["my-past-hangouts"],
  useGetEventsFeed: () => mockEventsFeed,
  useGetMyPastHangouts: () => mockPastHangouts,
}));

import PlansScreen from "../plans";
import PastHangoutsScreen from "../past-hangouts";

function privatePlan(
  id: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    eventType: "member",
    visibility: "invite_only",
    joinApprovalRequired: false,
    ownerUid: "uid-1",
    isInvited: false,
    myRsvp: null,
    title: `Plan ${id}`,
    startsAt: "2030-05-02T18:00:00.000Z",
    creatorName: "Plan host",
    creatorPhotoUrl: null,
    imageUrl: null,
    galleryPhotos: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockRouterPush.mockReset();
  mockRouterBack.mockReset();
  mockPastHangouts = {
    data: { events: [] },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  };
  mockEventsFeed = {
    data: { events: [] },
    isLoading: false,
    isError: false,
    isSuccess: true,
    isFetching: false,
    refetch: jest.fn(),
  };
});

afterEach(() => {
  cleanup();
});

describe("Past Hangouts access", () => {
  it("keeps the All Plans screen focused on plans", async () => {
    const view = await render(<PlansScreen />);

    expect(view.getByText("plans.screenTitle")).toBeTruthy();
    expect(view.queryByText("plans.pastHangoutsTitle")).toBeNull();
  });

  it("uses the featured Plan's uploaded photo and opens its conversation for the owner", async () => {
    const photoUrl = "https://example.test/plan-cover.jpg";
    mockEventsFeed.data = {
      events: [privatePlan(101, { imageUrl: photoUrl })],
    };

    const view = await render(<PlansScreen />);

    expect(view.getByTestId("plan-featured-artwork")).toBeTruthy();
    expect(view.getByTestId("plan-featured-photo").props.source.uri).toBe(photoUrl);
    expect(view.queryByTestId("plan-featured-fallback")).toBeNull();

    fireEvent.press(view.getByTestId("plan-row-101"));

    expect(mockRouterPush).toHaveBeenCalledWith("/event-chat/101");
  });

  it("shows fallback artwork without a photo and opens invite details for an invitee", async () => {
    mockEventsFeed.data = {
      events: [privatePlan(102, { ownerUid: "host-1", isInvited: true })],
    };

    const view = await render(<PlansScreen />);

    expect(view.getByTestId("plan-featured-artwork")).toBeTruthy();
    expect(view.getByTestId("plan-featured-fallback")).toBeTruthy();
    expect(view.queryByTestId("plan-featured-photo")).toBeNull();

    fireEvent.press(view.getByTestId("plan-row-102"));

    expect(mockRouterPush).toHaveBeenCalledWith("/event-details/member/102");
  });

  it("opens the conversation for an accepted attendee", async () => {
    mockEventsFeed.data = {
      events: [
        privatePlan(103, {
          ownerUid: "host-1",
          isInvited: true,
          myRsvp: "going",
        }),
      ],
    };

    const view = await render(<PlansScreen />);

    fireEvent.press(view.getByTestId("plan-row-103"));

    expect(mockRouterPush).toHaveBeenCalledWith("/event-chat/103");
  });

  it("shows a loading state until the signed-in user's history loads", async () => {
    mockPastHangouts.isLoading = true;
    const view = await render(<PastHangoutsScreen />);

    expect(view.getByTestId("past-hangouts-loading")).toBeTruthy();
  });

  it("allows retrying when past Hangouts fail to load", async () => {
    mockPastHangouts.isError = true;
    const view = await render(<PastHangoutsScreen />);

    fireEvent.press(view.getByTestId("past-hangouts-retry"));

    expect(mockPastHangouts.refetch).toHaveBeenCalledTimes(1);
  });

  it("shows a clear empty state when there are no past Hangouts", async () => {
    const view = await render(<PastHangoutsScreen />);

    expect(view.getByTestId("past-hangouts-empty")).toBeTruthy();
    expect(view.getByText("plans.pastHangoutsEmpty")).toBeTruthy();
  });

  it("preserves rating prompts and opens the existing Hangout details", async () => {
    mockPastHangouts.data = {
      events: [
        {
          id: 42,
          title: "Sunday dinner",
          startsAt: "2026-10-01T18:00:00.000Z",
          creatorName: "A host",
          myRating: null,
        },
        {
          id: 43,
          title: "Movie night",
          startsAt: "2026-10-02T18:00:00.000Z",
          creatorName: "Another host",
          myRating: 4,
        },
      ],
    };
    const view = await render(<PastHangoutsScreen />);

    expect(view.getByText("plans.rateHost")).toBeTruthy();
    expect(view.getByText("plans.updateHostRating · 4/5")).toBeTruthy();

    fireEvent.press(view.getByTestId("past-hangout-42"));

    expect(mockRouterPush).toHaveBeenCalledWith("/event-details/member/42");
  });

  it("returns from the history screen with its back button", async () => {
    const view = await render(<PastHangoutsScreen />);

    fireEvent.press(view.getByTestId("past-hangouts-back"));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });
});
