import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  within,
} from "@testing-library/react-native";
import { StyleSheet } from "react-native";

// eslint-disable-next-line no-var
var mockRouterPush = jest.fn();
// eslint-disable-next-line no-var
var mockRouterBack = jest.fn();
// eslint-disable-next-line no-var
var mockPastMeetings: any;
// eslint-disable-next-line no-var
var mockTranslate: (key: string) => string;

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
  useT: () => ({ t: (key: string) => mockTranslate(key), lang: "en" }),
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
  mockTranslate = (key) => key;
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
  it("shows host or attendee labels and limits rating prompts to member attendees", async () => {
    const view = await render(<PastMeetingsScreen />);
    const attendedMemberMeeting = view.getByTestId("past-meeting-member-101");
    const hostedMemberMeeting = view.getByTestId("past-meeting-member-202");
    const attendedVenueMeeting = view.getByTestId("past-meeting-venue-303");

    expect(
      within(attendedMemberMeeting).getByText(
        "tabs.events.pastMeetingsAttended",
      ),
    ).toBeTruthy();
    expect(
      within(attendedMemberMeeting).getByText("plans.rateHost"),
    ).toBeTruthy();

    expect(
      within(hostedMemberMeeting).getByText(
        "tabs.events.pastMeetingsHosted",
      ),
    ).toBeTruthy();
    expect(
      within(hostedMemberMeeting).queryByText("plans.rateHost"),
    ).toBeNull();

    expect(
      within(attendedVenueMeeting).getByText(
        "tabs.events.pastMeetingsAttended",
      ),
    ).toBeTruthy();
    expect(
      within(attendedVenueMeeting).queryByText("plans.rateHost"),
    ).toBeNull();
    expect(attendedVenueMeeting.props.accessibilityLabel).toContain(
      "tabs.events.pastMeetingsAttended",
    );
  });

  it("shows every type by default and exposes the filters as a radio group", async () => {
    const view = await render(<PastMeetingsScreen />);

    expect(view.getByTestId("past-meeting-member-101")).toBeTruthy();
    expect(view.getByTestId("past-meeting-member-202")).toBeTruthy();
    expect(view.getByTestId("past-meeting-venue-303")).toBeTruthy();
    expect(
      view.getByTestId("past-meetings-filter-all").props.accessibilityState,
    ).toEqual({ checked: true });
    expect(view.getByTestId("past-meetings-filter-label-all").props.children)
      .toBe("tabs.events.pastMeetingsAll (3)");
    expect(view.getByTestId("past-meetings-filter-label-event").props.children)
      .toBe("tabs.events.title (1)");
    expect(view.getByTestId("past-meetings-filter-label-plan").props.children)
      .toBe("plans.screenTitle (1)");
    expect(view.getByTestId("past-meetings-filter-label-hangout").props.children)
      .toBe("tabs.events.nearbyTab (1)");
    for (const [filter, label, count] of [
      ["all", "tabs.events.pastMeetingsAll", 3],
      ["event", "tabs.events.title", 1],
      ["plan", "plans.screenTitle", 1],
      ["hangout", "tabs.events.nearbyTab", 1],
    ] as const) {
      expect(
        view.getByTestId(`past-meetings-filter-${filter}`).props.accessibilityLabel,
      ).toBe(`${label}, ${count}`);
    }

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
    expect(
      view.getByTestId(`past-meetings-filter-${filter}`).props.accessibilityLabel,
    ).toContain(", 1");
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

  it("recalculates counts when the history data changes", async () => {
    const view = await render(<PastMeetingsScreen />);
    expect(view.getByTestId("past-meetings-filter-label-all").props.children)
      .toBe("tabs.events.pastMeetingsAll (3)");

    mockPastMeetings.data = { meetings: [allMeetings[0]] };
    await view.rerender(<PastMeetingsScreen />);

    expect(view.getByTestId("past-meetings-filter-label-all").props.children)
      .toBe("tabs.events.pastMeetingsAll (1)");
    expect(view.getByTestId("past-meetings-filter-label-event").props.children)
      .toBe("tabs.events.title (0)");
    expect(view.getByTestId("past-meetings-filter-label-plan").props.children)
      .toBe("plans.screenTitle (0)");
    expect(view.getByTestId("past-meetings-filter-label-hangout").props.children)
      .toBe("tabs.events.nearbyTab (1)");
  });

  it("lets long translated filter names wrap within the available width", async () => {
    const longLabel = "An event type with a much longer translated name";
    mockTranslate = (key) =>
      key === "tabs.events.title" ? longLabel : key;
    const view = await render(<PastMeetingsScreen />);

    const chip = view.getByTestId("past-meetings-filter-event");
    const label = view.getByTestId("past-meetings-filter-label-event");
    expect(label.props.children).toBe(`${longLabel} (1)`);
    expect(chip.props.accessibilityLabel).toBe(`${longLabel}, 1`);
    expect(StyleSheet.flatten(chip.props.style).maxWidth).toBe("100%");
    expect(StyleSheet.flatten(label.props.style).flexShrink).toBe(1);
  });
});
