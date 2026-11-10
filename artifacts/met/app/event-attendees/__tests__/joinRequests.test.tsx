import React from "react";
import renderer, { act } from "react-test-renderer";

import EventAttendeesScreen from "../[eventType]/[id]";

const mockDecision = jest.fn().mockResolvedValue(undefined);
const mockQueryClient = { invalidateQueries: jest.fn().mockResolvedValue(undefined) };
const mockRouteParams = {
  eventType: "member",
  id: "42",
  title: "Community hangout",
  joinApprovalRequired: "true",
};
const mockAttendeesData = {
  attendees: [],
  joinRequests: [
    {
      id: 501,
      uid: "explorer-uid",
      displayName: "Explorer member",
      photoUrl: null,
      status: "pending",
      createdAt: "2030-04-12T09:00:00.000Z",
      isVerifiedExplorer: true,
    },
  ],
  rsvps: [],
  corrections: [],
  notificationRuns: [],
};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockRouteParams,
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: mockAttendeesData, isLoading: false, isError: false }),
  useQueryClient: () => mockQueryClient,
}));

jest.mock("@workspace/api-client-react", () => ({
  getGetEventAttendeesQueryOptions: () => ({ queryKey: ["event-attendees"] }),
  getGetEventDetailsQueryOptions: () => ({ queryKey: ["event-details-options"] }),
  getGetEventDetailsQueryKey: () => ["event-details"],
  getGetEventsFeedQueryKey: () => ["events-feed"],
  useDecideCommunityEventJoinRequest: () => ({ mutateAsync: mockDecision }),
  useGetEventCheckinQr: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Feather: (props: Record<string, unknown>) => React.createElement(View, props),
  };
});

jest.mock("@/components/KeyboardAwareScrollViewCompat", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    KeyboardAwareScrollViewCompat: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock("@/contexts/AppContext", () => ({
  useApp: () => ({ authedUid: "host-uid" }),
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#fff",
    border: "#ddd",
    card: "#fff",
    destructive: "#d33",
    muted: "#eee",
    mutedForeground: "#666",
    primary: "#16834b",
    primaryForeground: "#fff",
    primarySoft: "#e5f3ea",
    text: "#111",
  }),
}));

jest.mock("@/lib/i18n", () => ({
  useT: () => ({ t: (key: string) => key, lang: "en", rtl: false }),
}));

jest.mock("@/lib/api/client", () => ({
  api: { sendReveal: jest.fn() },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("react-native-qrcode-svg", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn() }));
jest.mock("react-native-view-shot", () => ({ captureRef: jest.fn() }));

describe("host join-request controls", () => {
  beforeEach(() => {
    mockDecision.mockClear();
    mockQueryClient.invalidateQueries.mockClear();
  });

  it("shows both decision controls for an Explorer and only acts after a host taps", async () => {
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<EventAttendeesScreen />);
      await Promise.resolve();
    });

    const acceptButton = root.root.findByProps({
      testID: "button-accept-join-request-501",
    });
    const declineButton = root.root.findByProps({
      testID: "button-decline-join-request-501",
    });

    expect(
      root.root.findByProps({ testID: "text-explorer-request-order-hint" }).props.children,
    ).toBe("tabs.events.explorerRequestOrderHint");
    expect(
      root.root.findAllByProps({ testID: "button-show-event-qr" }),
    ).toHaveLength(0);
    expect(
      root.root.findAllByProps({ testID: "button-refresh-event-attendees" }),
    ).toHaveLength(0);
    expect(
      root.root.find((node) =>
        node.props.accessibilityRole === "header" &&
        node.props.children === "tabs.events.hangoutDetailsTitle",
      ),
    ).toBeTruthy();
    expect(acceptButton).toBeTruthy();
    expect(declineButton).toBeTruthy();
    expect(mockDecision).not.toHaveBeenCalled();

    await act(async () => {
      acceptButton.props.onPress();
      await Promise.resolve();
    });
    expect(mockDecision).toHaveBeenNthCalledWith(1, {
      eventId: 42,
      requestId: 501,
      data: { status: "accepted" },
    });

    await act(async () => {
      root.root.findByProps({ testID: "button-decline-join-request-501" }).props.onPress();
      await Promise.resolve();
    });
    expect(mockDecision).toHaveBeenNthCalledWith(2, {
      eventId: 42,
      requestId: 501,
      data: { status: "declined" },
    });
    act(() => root.unmount());
  });
});
