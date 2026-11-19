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
