import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({ mutedForeground: "#666" }),
}));

import {
  EventPhotoCarousel,
  getEventPhotoIndexAfterSwipe,
  shouldCaptureEventPhotoSwipe,
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
  it("lets guests swipe through all four photos", () => {
    const photos = [
      "https://example.test/event-1.jpg",
      "https://example.test/event-2.jpg",
      "https://example.test/event-3.jpg",
      "https://example.test/event-4.jpg",
    ];
    const root = renderCarousel(photos);
    const carousel = root.root.findByProps({ testID: "event-photos" });

    expect(
      carousel.findByProps({ testID: "event-photos-image" }).props.source.uri,
    ).toBe(photos[0]);
    expect(shouldCaptureEventPhotoSwipe(photos.length, -70, 4)).toBe(true);
    expect(shouldCaptureEventPhotoSwipe(photos.length, 4, -70)).toBe(false);

    let activeIndex = 0;
    for (let index = 1; index < photos.length; index += 1) {
      activeIndex = getEventPhotoIndexAfterSwipe(activeIndex, photos.length, -80);
      expect(photos[activeIndex]).toBe(photos[index]);
    }
    expect(getEventPhotoIndexAfterSwipe(activeIndex, photos.length, -80)).toBe(3);

    expect(
      carousel
        .findByProps({ testID: "event-photos-indicator" })
        .findByType(require("react-native").Text).props.children
        .join(""),
    ).toBe("1 / 4");
    act(() => root.unmount());
  });

  it("keeps a single photo visible without a page indicator or swipe capture", () => {
    const root = renderCarousel(["https://example.test/only-photo.jpg"]);
    const carousel = root.root.findByProps({ testID: "event-photos" });

    expect(
      carousel.findByProps({ testID: "event-photos-image" }).props.source.uri,
    ).toBe("https://example.test/only-photo.jpg");
    expect(carousel.findAllByProps({ testID: "event-photos-indicator" })).toHaveLength(0);
    expect(shouldCaptureEventPhotoSwipe(1, -80, 0)).toBe(false);
    expect(getEventPhotoIndexAfterSwipe(0, 1, -80)).toBe(0);
    act(() => root.unmount());
  });

  it("renders nothing when there are no photos", () => {
    const root = renderCarousel([]);
    expect(root.toJSON()).toBeNull();
    act(() => root.unmount());
  });
});
