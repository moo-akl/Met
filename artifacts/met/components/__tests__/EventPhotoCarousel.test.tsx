import React from "react";
import renderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({ mutedForeground: "#666" }),
}));

import {
  EventPhotoCarousel,
  getEventPhotoIndexAfterScroll,
} from "../EventPhotoCarousel";

function renderCarousel(photos: string[]) {
  let root!: renderer.ReactTestRenderer;
  act(() => {
    root = renderer.create(
      <EventPhotoCarousel
        photos={photos}
        imageStyle={{ width: 200, height: 120 }}
        testID="event-photos"
        accessibilityLabel="Event photos"
      />,
    );
  });
  return root;
}

describe("EventPhotoCarousel", () => {
  it("renders every photo in a native horizontal scroller", () => {
    const photos = [
      "https://example.test/event-1.jpg",
      "https://example.test/event-2.jpg",
      "https://example.test/event-3.jpg",
      "https://example.test/event-4.jpg",
    ];
    const root = renderCarousel(photos);
    const carousel = root.root.findByProps({ testID: "event-photos" });
    const scroll = carousel.findByProps({ testID: "event-photos-scroll" });

    expect(
      carousel.findByProps({ testID: "event-photos-image" }).props.source.uri,
    ).toBe(photos[0]);
    expect(scroll.props.horizontal).toBe(true);
    expect(scroll.props.nestedScrollEnabled).toBe(true);
    photos.forEach((photo, index) => {
      const imageTestId =
        index === 0 ? "event-photos-image" : `event-photos-image-${index}`;
      expect(
        carousel.findByProps({ testID: imageTestId }).props.source.uri,
      ).toBe(photo);
    });

    act(() => {
      scroll.props.onMomentumScrollEnd({
        nativeEvent: { contentOffset: { x: 400 } },
      });
    });

    expect(
      carousel.findByProps({ testID: "event-photos-image-2" }).props.source.uri,
    ).toBe(photos[2]);
    expect(
      carousel.findByProps({ testID: "event-photos-indicator" }).findByType(require("react-native").Text).props.children.join(""),
    ).toBe("3 / 4");
    act(() => root.unmount());
  });

  it("keeps a single photo visible without a page indicator or swipe capture", () => {
    const root = renderCarousel(["https://example.test/only-photo.jpg"]);
    const carousel = root.root.findByProps({ testID: "event-photos" });

    expect(
      carousel.findByProps({ testID: "event-photos-image" }).props.source.uri,
    ).toBe("https://example.test/only-photo.jpg");
    expect(carousel.findAllByProps({ testID: "event-photos-indicator" })).toHaveLength(0);
    expect(getEventPhotoIndexAfterScroll(80, 200, 0, 1)).toBe(0);
    act(() => root.unmount());
  });

  it("measures full-width pages so swipe indicators stay in sync", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <EventPhotoCarousel
          photos={["https://example.test/first.jpg", "https://example.test/second.jpg"]}
          imageStyle={{ width: "100%", height: 120 }}
          testID="responsive-event-photos"
          accessibilityLabel="Event photos"
          indicatorPlacement="overlay"
        />,
      );
    });
    const carousel = root.root.find(
      (instance) =>
        instance.props.testID === "responsive-event-photos" &&
        typeof instance.props.onLayout === "function",
    );
    act(() => {
      carousel.props.onLayout({
        nativeEvent: { layout: { width: 320, height: 120, x: 0, y: 0 } },
      });
    });
    const scroll = root.root.findByProps({ testID: "responsive-event-photos-scroll" });
    expect(scroll.props.snapToInterval).toBe(320);
    expect(
      StyleSheet.flatten(
        root.root.findByProps({ testID: "responsive-event-photos-image" }).props.style,
      ).width,
    ).toBe(320);
    act(() => {
      scroll.props.onMomentumScrollEnd({
        nativeEvent: { contentOffset: { x: 320 } },
      });
    });
    expect(
      root.root
        .findByProps({ testID: "responsive-event-photos-indicator" })
        .findByType(require("react-native").Text)
        .props.children.join(""),
    ).toBe("2 / 2");
    act(() => root.unmount());
  });

  it("renders nothing when there are no photos", () => {
    const root = renderCarousel([]);
    expect(root.toJSON()).toBeNull();
    act(() => root.unmount());
  });
});
