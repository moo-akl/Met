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
  return Object.assign((props: any) => React.createElement(Text, { style: { color: props.color } }, props.name), { font: {} });
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
  it.each(["other", "future-category", null, undefined])("uses a gold star for the fallback type %s", async (venueType) => {
    const onPress = jest.fn();
    const screen = await render(<VenueOwnerMarker venue={{ ...venue, venueType }} onPress={onPress} />);
    const stars = screen.getAllByText("star");
    expect(stars).toHaveLength(2);
    expect(stars[1].props.style.color).toBe("#C99418");
    expect(screen.queryByText("map-marker")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Corner Café, Other venue"));
    expect(onPress).toHaveBeenCalledWith("cafe-id");
  });
  it.each([["bar", "glass-cocktail"], ["shopping", "shopping"], ["outdoors", "tree"]])("keeps the %s category icon", async (venueType, icon) => {
    const screen = await render(<VenueOwnerMarker venue={{ ...venue, venueType }} />);
    expect(screen.getByText(icon)).toBeTruthy();
    expect(screen.queryByText("star")).toBeNull();
  });
  it("keeps activity badges visible on gold stars", async () => {
    const screen = await render(<VenueOwnerMarker venue={{ ...venue, hasActiveReward: true }} />);
    expect(screen.getAllByText("star")).toHaveLength(2);
    expect(screen.getByText("🎁")).toBeTruthy();
  });
  it("keeps reward and event badges separate from category icons", async () => {
    const screen = await render(<VenueOwnerMarker venue={{ ...venue, venueType: "restaurant", hasActiveReward: true }} />);
    expect(screen.getByText("silverware-fork-knife")).toBeTruthy();
    expect(screen.getByText("🎁")).toBeTruthy();
    await screen.rerender(<VenueOwnerMarker venue={{ ...venue, venueType: "restaurant", hasUpcomingEvent: true }} />);
    expect(screen.getByText("📅")).toBeTruthy();
  });
});
