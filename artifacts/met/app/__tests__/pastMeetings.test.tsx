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
var mockPastMeetings: any;

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
  }),
}));

jest.mock("@/lib/i18n", () => ({
  useT: () => ({ t: (key: string) => key, lang: "en" }),
}));

jest.mock("@workspace/api-client-react", () => ({
  getGetMyPastMeetingsQueryKey: () => ["my-past-meetings"],
  useGetMyPastMeetings: () => mockPastMeetings,
}));

import PastMeetingsScreen from "../past-meetings";

const allMeetings = [
  {
    id: 101,
    eventType: "member",
    type: "hangout",
    title: "Rooftop Hangout",
    startsAt: "2026-10-01T18:00:00.000Z",
    isHost: false,
    myRating: null,
  },
  {
    id: 202,
    eventType: "member",
    type: "plan",
    title: "Dinner Plan",
    startsAt: "2026-10-02T18:00:00.000Z",
    isHost: true,
    myRating: null,
  },
  {
    id: 303,
    eventType: "venue",
    type: "event",
    title: "Gallery Opening",
    startsAt: "2026-10-03T18:00:00.000Z",
    isHost: false,
    myRating: null,
  },
];

beforeEach(() => {
  mockRouterPush.mockReset();
  mockRouterBack.mockReset();
  mockPastMeetings = {
    data: { meetings: allMeetings },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  };
});

afterEach(() => {
  cleanup();
});

describe("Past Meetings filters", () => {
  it("shows every type by default and exposes the filters as a radio group", async () => {
    const view = await render(<PastMeetingsScreen />);

    expect(view.getByTestId("past-meeting-member-101")).toBeTruthy();
    expect(view.getByTestId("past-meeting-member-202")).toBeTruthy();
    expect(view.getByTestId("past-meeting-venue-303")).toBeTruthy();
    expect(
      view.getByTestId("past-meetings-filter-all").props.accessibilityState,
    ).toEqual({ checked: true });

    const group = view.getByTestId("past-meetings-filters");
    expect(group.props.accessibilityRole).toBe("radiogroup");
    expect(group.props.accessibilityLabel).toBe(
      "tabs.events.pastMeetingsFilterLabel",
    );
    expect(
      view.getByTestId("past-meetings-filter-event").props.accessibilityRole,
    ).toBe("radio");
  });

  it.each([
    {
      filter: "hangout",
      visible: "past-meeting-member-101",
      hidden: ["past-meeting-member-202", "past-meeting-venue-303"],
    },
    {
      filter: "plan",
      visible: "past-meeting-member-202",
      hidden: ["past-meeting-member-101", "past-meeting-venue-303"],
    },
    {
      filter: "event",
      visible: "past-meeting-venue-303",
      hidden: ["past-meeting-member-101", "past-meeting-member-202"],
    },
  ])("shows only $filter meetings when that filter is selected", async ({ filter, visible, hidden }) => {
    const view = await render(<PastMeetingsScreen />);

    await fireEvent.press(view.getByTestId(`past-meetings-filter-${filter}`));

    expect(view.getByTestId(visible)).toBeTruthy();
    hidden.forEach((testID) => {
      expect(view.queryByTestId(testID)).toBeNull();
    });
    expect(
      view.getByTestId(`past-meetings-filter-${filter}`).props.accessibilityState,
    ).toEqual({ checked: true });
  });

  it("shows the localized empty message when a filter has no matches", async () => {
    mockPastMeetings.data = { meetings: [allMeetings[0]] };
    const view = await render(<PastMeetingsScreen />);

    await fireEvent.press(view.getByTestId("past-meetings-filter-event"));

    expect(
      view.getByText("tabs.events.pastMeetingsFilterEmpty"),
    ).toBeTruthy();
  });

  it("restores all meetings when All is selected again", async () => {
    const view = await render(<PastMeetingsScreen />);

    await fireEvent.press(view.getByTestId("past-meetings-filter-event"));
    await fireEvent.press(view.getByTestId("past-meetings-filter-all"));

    expect(view.getByTestId("past-meeting-member-101")).toBeTruthy();
    expect(view.getByTestId("past-meeting-member-202")).toBeTruthy();
    expect(view.getByTestId("past-meeting-venue-303")).toBeTruthy();
  });
});
