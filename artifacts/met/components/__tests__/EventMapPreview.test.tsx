import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import {
  EventMapMarker,
  EventMapPreview,
} from "../EventMapMarker";
import type { EventMapPin } from "@/lib/eventMapPins";

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Marker: (props: any) =>
      React.createElement(View, props, props.children),
  };
});

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#f5f9f0",
    border: "#d3e0ce",
    card: "#ffffff",
    mutedForeground: "#526c50",
    primary: "#25824a",
    text: "#183c2f",
  }),
}));

jest.mock("@/lib/i18n", () => ({
  useT: () => ({
    lang: "en",
    rtl: false,
    t: (key: string) =>
      ({
        "common.close": "Close",
        "tabs.events.detailsView": "View event details",
        "tabs.events.title": "Events",
        "tabs.events.nearbyTab": "Hangouts",
      } as Record<string, string>)[key] ?? key,
  }),
}));

jest.mock("expo-font", () => ({ useFonts: () => [true] }));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Feather = (props: { name: string }) =>
    React.createElement(Text, null, props.name);
  return { Feather: Object.assign(Feather, { font: {} }) };
});

const event: EventMapPin = {
  eventType: "member",
  id: 42,
  title: "Riverside evening hangout",
  location: "Chao Phraya Park",
  venueName: null,
  startsAt: "2026-11-09T14:00:00.000Z",
  endsAt: "2026-11-09T16:00:00.000Z",
  latitude: 13.7563,
  longitude: 100.5018,
  visibility: "public",
  joinApprovalRequired: true,
};

describe("EventMapPreview", () => {
  it("opens the preview when the event pin is tapped", async () => {
    const onPress = jest.fn();
    const screen = await render(
      <EventMapMarker event={event} onPress={onPress} />,
    );

    fireEvent.press(screen.getByLabelText(event.title));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows the event title, time, and location without navigating automatically", async () => {
    const onClose = jest.fn();
    const onOpenDetails = jest.fn();
    const screen = await render(
      <EventMapPreview
        event={event}
        onClose={onClose}
        onOpenDetails={onOpenDetails}
      />,
    );

    expect(screen.getByText(event.title)).toBeTruthy();
    expect(screen.getByTestId("event-map-preview-time").props.children).toBeTruthy();
    expect(screen.getByText(event.location!)).toBeTruthy();
    expect(onOpenDetails).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("event-map-open-details"));
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it("lets the user dismiss the preview and falls back to coordinates", async () => {
    const onClose = jest.fn();
    const screen = await render(
      <EventMapPreview
        event={{ ...event, location: null }}
        onClose={onClose}
        onOpenDetails={jest.fn()}
      />,
    );

    expect(screen.getByTestId("event-map-preview-location").props.children).toContain(
      "13.7563, 100.5018",
    );
    fireEvent.press(screen.getByTestId("event-map-preview-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

