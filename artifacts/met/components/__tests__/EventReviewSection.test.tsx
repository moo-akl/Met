import React from "react";
import { Text } from "react-native";
import renderer, { act } from "react-test-renderer";

let mockReviewData: Record<string, unknown>;
const mockCreateReview = jest.fn();
const mockQueryClient = { invalidateQueries: jest.fn().mockResolvedValue(undefined) };

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { Feather: () => React.createElement(View) };
});

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mockQueryClient,
}));

jest.mock("@workspace/api-client-react", () => ({
  getGetEventReviewsQueryKey: (eventType: string, eventId: number) => [
    "event-reviews",
    eventType,
    eventId,
  ],
  useCreateEventReview: () => ({
    mutateAsync: mockCreateReview,
    isPending: false,
    error: null,
  }),
  useGetEventReviews: () => ({
    data: mockReviewData,
    isLoading: false,
    isError: false,
  }),
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#fff",
    border: "#ddd",
    card: "#fafafa",
    destructive: "#c00",
    mutedForeground: "#666",
    primary: "#16834b",
    primaryForeground: "#fff",
    primarySoft: "#e5f3ea",
    text: "#111",
  }),
}));

jest.mock("@/lib/i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}));

jest.mock("react-native-keyboard-controller", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    KeyboardAvoidingView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

import { EventReviewSection } from "../EventReviewSection";

describe("EventReviewSection", () => {
  it("shows the reviewer's name and submitted written review", () => {
    mockReviewData = {
      reviews: [
        {
          rating: 5,
          reviewText: "The evening was welcoming and well organized.",
          reviewerName: "Jamie Lee",
          reviewerPhotoUrl: null,
          createdAt: "2026-11-12T18:00:00.000Z",
        },
      ],
      myReview: null,
      averageRating: 5,
      reviewCount: 1,
    };

    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <EventReviewSection
          eventType="member"
          eventId={42}
          uid="reviewer-uid"
          canReview={false}
        />,
      );
    });

    const renderedText = root.root
      .findAllByType(Text)
      .flatMap((node) => {
        const children = node.props.children;
        return Array.isArray(children) ? children : [children];
      })
      .filter((child): child is string => typeof child === "string");

    expect(renderedText).toContain("Jamie Lee");
    expect(renderedText).toContain("The evening was welcoming and well organized.");

    act(() => root.unmount());
  });
});
