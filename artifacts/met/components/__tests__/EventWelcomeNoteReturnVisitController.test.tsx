import React from "react";
import renderer, { act } from "react-test-renderer";
import { Modal, StyleSheet } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react-native";
import type { PendingCommunityEventWelcomeNote } from "@workspace/api-client-react";

const mockGetPendingNotes = jest.fn();
const mockAcknowledge = jest.fn();
let mockReady = true;
let mockUid: string | null = "returning-guest";
let mockPath = "/(tabs)/events";

jest.mock("@workspace/api-client-react", () => ({
  getGetMyPendingCommunityEventWelcomeNotesQueryKey: () => [
    "/api/community-events/my-welcome-notes",
  ],
  getGetMyPendingCommunityEventWelcomeNotesQueryOptions: () => ({
    queryKey: ["/api/community-events/my-welcome-notes"],
    queryFn: () => mockGetPendingNotes(),
  }),
  useAcknowledgeEventWelcomeNote: () => ({
    mutateAsync: (input: unknown) => mockAcknowledge(input),
  }),
}));
jest.mock("@/contexts/AppContext", () => ({
  useApp: () => ({ ready: mockReady, authedUid: mockUid }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock("expo-router", () => ({
  usePathname: () => mockPath,
}));
jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#fff",
    border: "#ddd",
    card: "#fafafa",
    foreground: "#111",
    mutedForeground: "#666",
    primary: "#30a83c",
    primaryForeground: "#fff",
    primarySoft: "#e5f4e5",
    secondaryForeground: "#276238",
    text: "#111",
  }),
}));
jest.mock("@/lib/i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}));
jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

import { EventWelcomeNoteReturnVisitController } from "../EventWelcomeNoteReturnVisitController";

const pendingNotes: PendingCommunityEventWelcomeNote[] = [
  {
    eventId: 41,
    eventTitle: "Picnic in the park",
    welcomeNote: "The guestbook is by the entrance.",
    welcomeNoteStyle: {
      font: "handwritten",
      color: "ink",
      card: "guestbook",
    },
    createdAt: "2026-11-20T08:00:00.000Z",
  },
  {
    eventId: 52,
    eventTitle: "Coffee after work",
    welcomeNote: "The garden gate is open.",
    welcomeNoteStyle: {
      font: "serif",
      color: "forest",
      card: "postcard",
    },
    createdAt: "2026-11-20T08:01:00.000Z",
  },
];

function createRenderer() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  let root!: renderer.ReactTestRenderer;
  act(() => {
    root = renderer.create(
      <QueryClientProvider client={queryClient}>
        <EventWelcomeNoteReturnVisitController />
      </QueryClientProvider>,
    );
  });
  return { root, queryClient };
}

describe("EventWelcomeNoteReturnVisitController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReady = true;
    mockUid = "returning-guest";
    mockPath = "/(tabs)/events";
    mockGetPendingNotes.mockResolvedValue({ welcomeNotes: pendingNotes });
    mockAcknowledge.mockResolvedValue({ success: true });
  });

  it("shows saved notes after session restoration, one at a time, and acknowledges them", async () => {
    const { root, queryClient } = createRenderer();
    await waitFor(() => {
      expect(
        root.root.findByProps({ testID: "return-visit-welcome-note-body" })
          .props.children,
      ).toBe("The guestbook is by the entrance.");
    });

    expect(mockGetPendingNotes).toHaveBeenCalledTimes(1);
    expect(root.root.findByType(Modal).props.visible).toBe(true);
    expect(
      StyleSheet.flatten(
        root.root.findByProps({ testID: "return-visit-welcome-note-body" })
          .props.style,
      ),
    ).toMatchObject({
      fontFamily: "Caveat_500Medium",
      fontSize: 21,
      lineHeight: 27,
    });
    expect(
      root.root.findByProps({ testID: "return-visit-welcome-note-card-rules" }),
    ).toBeTruthy();

    await act(async () => {
      root.root.findByType(Modal).props.onShow();
      await Promise.resolve();
    });
    expect(mockAcknowledge).toHaveBeenCalledWith({
      eventType: "member",
      eventId: 41,
    });

    await act(async () => {
      root.root.findByProps({ testID: "return-visit-welcome-note-dismiss" })
        .props.onPress();
    });
    expect(
      root.root.findByProps({ testID: "return-visit-welcome-note-body" })
        .props.children,
    ).toBe("The garden gate is open.");

    await act(async () => {
      root.root.findByType(Modal).props.onShow();
      await Promise.resolve();
    });
    expect(mockAcknowledge).toHaveBeenCalledWith({
      eventType: "member",
      eventId: 52,
    });
    await act(async () => {
      root.root.findByProps({ testID: "return-visit-welcome-note-dismiss" })
        .props.onPress();
    });
    expect(root.root.findByType(Modal).props.visible).toBe(false);

    act(() => root.unmount());
    queryClient.clear();
  });

  it("waits for an authenticated app session and skips event-detail presentation", async () => {
    mockUid = null;
    mockReady = false;
    const { root, queryClient } = createRenderer();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockGetPendingNotes).not.toHaveBeenCalled();
    expect(root.root.findByType(Modal).props.visible).toBe(false);

    mockUid = "returning-guest";
    mockReady = true;
    mockPath = "/event-details/member/41";
    await act(async () => {
      root.update(
        <QueryClientProvider client={queryClient}>
          <EventWelcomeNoteReturnVisitController />
        </QueryClientProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockGetPendingNotes).not.toHaveBeenCalled();
    expect(root.root.findByType(Modal).props.visible).toBe(false);

    act(() => root.unmount());
    queryClient.clear();
  });
});
