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

  it("puts the nearest Plan first and labels the remaining list", async () => {
    mockEventsFeed.data = {
      events: [
        privatePlan(104, { startsAt: "2030-05-03T18:00:00.000Z" }),
        privatePlan(105, { startsAt: "2030-05-02T18:00:00.000Z" }),
      ],
    };

    const view = await render(<PlansScreen />);

    const rowIds = view.getAllByTestId(/^plan-row-/).map((row) => row.props.testID);
    expect(rowIds).toEqual(["plan-row-105", "plan-row-104"]);
    expect(view.getByText("plans.homeSubtitle")).toBeTruthy();
    expect(view.getAllByText("plans.upNext")).toHaveLength(2);
    expect(view.getByText("plans.afterThat")).toBeTruthy();
    expect(view.getByText("02")).toBeTruthy();
    expect(view.getByText("01")).toBeTruthy();
  });

  it("filters Plans by hosting and invitations", async () => {
    mockEventsFeed.data = {
      events: [
        privatePlan(106, { ownerUid: "uid-1" }),
        privatePlan(107, { ownerUid: "host-1", isInvited: true }),
      ],
    };

    const view = await render(<PlansScreen />);
    expect(view.getAllByTestId(/^plan-row-/)).toHaveLength(2);

    await fireEvent.press(view.getByTestId("plans-filter-hosting"));
    expect(view.getByTestId("plan-row-106")).toBeTruthy();
    expect(view.queryByTestId("plan-row-107")).toBeNull();

    await fireEvent.press(view.getByTestId("plans-filter-invitations"));
    expect(view.getByTestId("plan-row-107")).toBeTruthy();
    expect(view.queryByTestId("plan-row-106")).toBeNull();
  });

  it("opens date options and applies the week filter", async () => {
    const startsSoon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const startsLater = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    mockEventsFeed.data = {
      events: [
        privatePlan(108, { startsAt: startsSoon }),
        privatePlan(109, { startsAt: startsLater }),
      ],
    };

    const view = await render(<PlansScreen />);
    expect(view.getAllByTestId(/^plan-row-/)).toHaveLength(2);
    await fireEvent.press(view.getByTestId("plans-date-filter-toggle"));
    await fireEvent.press(view.getByTestId("plans-date-filter-week"));

    expect(view.getByTestId("plan-row-108")).toBeTruthy();
    expect(view.queryByTestId("plan-row-109")).toBeNull();
  });

  it("shows the Plans empty state and keeps its create action", async () => {
    const view = await render(<PlansScreen />);

    expect(view.getByText("plans.screenEmptyTitle")).toBeTruthy();
    expect(view.getByText("plans.screenEmptyBody")).toBeTruthy();
    await fireEvent.press(view.getByTestId("plans-empty-create"));
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: "/event-create",
      params: { mode: "friends" },
    });
  });

  it("shows the Plans loading state", async () => {
    mockEventsFeed.isLoading = true;
    const view = await render(<PlansScreen />);
    expect(view.getByText("plans.loading")).toBeTruthy();
  });

  it("keeps the Plans retry action connected to feed errors", async () => {
    mockEventsFeed.isError = true;
    const view = await render(<PlansScreen />);
    await fireEvent.press(view.getByTestId("plans-retry"));
    expect(mockEventsFeed.refetch).toHaveBeenCalledTimes(1);
  });

  it("opens the private Plan detail screen for the owner", async () => {
    mockEventsFeed.data = {
      events: [privatePlan(101)],
    };

    const view = await render(<PlansScreen />);

    await fireEvent.press(view.getByTestId("plan-row-101"));

    expect(mockRouterPush).toHaveBeenCalledWith("/event-details/member/101");
  });

  it("opens invitation details for an invitee", async () => {
    mockEventsFeed.data = {
      events: [privatePlan(102, { ownerUid: "host-1", isInvited: true })],
    };

    const view = await render(<PlansScreen />);

    await fireEvent.press(view.getByTestId("plan-row-102"));

    expect(mockRouterPush).toHaveBeenCalledWith("/event-details/member/102");
  });

  it("opens details for an accepted attendee before they enter the conversation", async () => {
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

    await fireEvent.press(view.getByTestId("plan-row-103"));

    expect(mockRouterPush).toHaveBeenCalledWith("/event-details/member/103");
  });

  it("shows a loading state until the signed-in user's history loads", async () => {
    mockPastHangouts.isLoading = true;
    const view = await render(<PastHangoutsScreen />);

    expect(view.getByTestId("past-hangouts-loading")).toBeTruthy();
  });

  it("allows retrying when past Hangouts fail to load", async () => {
    mockPastHangouts.isError = true;
    const view = await render(<PastHangoutsScreen />);

    await fireEvent.press(view.getByTestId("past-hangouts-retry"));

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

    await fireEvent.press(view.getByTestId("past-hangout-42"));

    expect(mockRouterPush).toHaveBeenCalledWith("/event-details/member/42");
  });

  it("returns from the history screen with its back button", async () => {
    const view = await render(<PastHangoutsScreen />);

    await fireEvent.press(view.getByTestId("past-hangouts-back"));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });
});
