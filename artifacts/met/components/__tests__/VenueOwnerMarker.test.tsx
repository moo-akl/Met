import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { VenueOwnerMarker } from "../VenueOwnerMarker";

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { Marker: React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ redraw: jest.fn() }));
    return React.createElement(View, props, props.children);
  }) };
});
jest.mock("expo-font", () => ({ useFonts: () => [true] }));
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return Object.assign((props: any) => React.createElement(Text, null, props.name), { font: {} });
});

const venue = {
  placeId: "cafe-id", placeName: "Corner Café", businessName: "Corner Café",
  lat: 1, lng: 2, hasActiveReward: false, hasUpcomingEvent: false,
};
describe("venue category markers", () => {
  it("uses the café icon and retains navigation to the same place", async () => {
    const onPress = jest.fn();
    const screen = await render(<VenueOwnerMarker venue={{ ...venue, venueType: "cafe" }} onPress={onPress} />);
    expect(screen.getByText("coffee")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Corner Café, Café"));
    expect(onPress).toHaveBeenCalledWith("cafe-id");
  });
  it("uses a generic pin for missing or unknown types", async () => {
    const screen = await render(<VenueOwnerMarker venue={{ ...venue, venueType: "future-category" }} />);
    expect(screen.getByText("map-marker")).toBeTruthy();
  });
  it("keeps reward and event badges separate from category icons", async () => {
    const screen = await render(<VenueOwnerMarker venue={{ ...venue, venueType: "restaurant", hasActiveReward: true }} />);
    expect(screen.getByText("silverware-fork-knife")).toBeTruthy();
    expect(screen.getByText("🎁")).toBeTruthy();
    await screen.rerender(<VenueOwnerMarker venue={{ ...venue, venueType: "restaurant", hasUpcomingEvent: true }} />);
    expect(screen.getByText("📅")).toBeTruthy();
  });
});
