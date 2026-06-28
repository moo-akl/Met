/**
 * Tests for ChatMessageBanner
 *
 * Covers:
 *  1. Tap path — pressing the banner clears state (onDismiss) BEFORE navigating
 *  2. Auto-dismiss timer path — banner disappears on its own after 4 s
 */

import React from "react";
import { Animated } from "react-native";
import { fireEvent, render, screen, act } from "@testing-library/react-native";

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Feather: View };
});

jest.mock("@/components/Avatar", () => {
  const { View } = require("react-native");
  return { Avatar: View };
});

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    card: "#ffffff",
    border: "#e0e0e0",
    radius: 12,
    primary: "#000000",
    primaryForeground: "#ffffff",
    foreground: "#000000",
    mutedForeground: "#666666",
  }),
}));

import { ChatBannerPayload, ChatMessageBanner } from "../ChatMessageBanner";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BANNER_DURATION_MS = 4000;

const mockPayload: ChatBannerPayload = {
  chatPeerUid: "peer-uid-123",
  senderName: "Alice",
  messagePreview: "Hey, are you coming?",
  avatarUrl: null,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ChatMessageBanner", () => {
  let timingSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    // Make Animated.timing fire its completion callback synchronously so the
    // auto-dismiss path (onDismiss called inside the slide-out animation
    // callback) is testable without real animation frames.
    timingSpy = jest
      .spyOn(Animated, "timing")
      .mockImplementation((_value, _config) => ({
        start: (cb?: (result: { finished: boolean }) => void) => {
          if (cb) cb({ finished: true });
        },
        stop: jest.fn(),
        reset: jest.fn(),
      }));
  });

  afterEach(() => {
    timingSpy.mockRestore();
    jest.useRealTimers();
  });

  // ── Rendering ───────────────────────────────────────────────────────────────

  it("renders sender name and message preview when payload is provided", async () => {
    await render(
      <ChatMessageBanner
        payload={mockPayload}
        onNavigate={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Hey, are you coming?")).toBeTruthy();
  });

  it("renders nothing when payload is null", async () => {
    const { toJSON } = await render(
      <ChatMessageBanner
        payload={null}
        onNavigate={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(toJSON()).toBeNull();
  });

  // ── Tap path ─────────────────────────────────────────────────────────────────

  describe("tap path", () => {
    it("calls onDismiss when the banner is pressed", async () => {
      const onDismiss = jest.fn();
      await render(
        <ChatMessageBanner
          payload={mockPayload}
          onNavigate={jest.fn()}
          onDismiss={onDismiss}
        />,
      );

      fireEvent.press(screen.getByText("Alice"));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("calls onNavigate with the chatPeerUid when the banner is pressed", async () => {
      const onNavigate = jest.fn();
      await render(
        <ChatMessageBanner
          payload={mockPayload}
          onNavigate={onNavigate}
          onDismiss={jest.fn()}
        />,
      );

      fireEvent.press(screen.getByText("Alice"));

      expect(onNavigate).toHaveBeenCalledWith("peer-uid-123");
    });

    it("calls onDismiss BEFORE onNavigate so the banner cannot reappear on the destination screen", async () => {
      const callOrder: string[] = [];
      const onDismiss = jest.fn(() => callOrder.push("dismiss"));
      const onNavigate = jest.fn(() => callOrder.push("navigate"));

      await render(
        <ChatMessageBanner
          payload={mockPayload}
          onNavigate={onNavigate}
          onDismiss={onDismiss}
        />,
      );

      fireEvent.press(screen.getByText("Alice"));

      expect(callOrder).toEqual(["dismiss", "navigate"]);
    });

    it("cancels the auto-dismiss timer when the banner is tapped", async () => {
      const onDismiss = jest.fn();
      await render(
        <ChatMessageBanner
          payload={mockPayload}
          onNavigate={jest.fn()}
          onDismiss={onDismiss}
        />,
      );

      fireEvent.press(screen.getByText("Alice"));
      expect(onDismiss).toHaveBeenCalledTimes(1);

      // Advancing past the original 4 s timeout should NOT trigger a second call
      act(() => {
        jest.advanceTimersByTime(BANNER_DURATION_MS + 500);
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  // ── Auto-dismiss timer path ──────────────────────────────────────────────────

  describe("auto-dismiss timer path", () => {
    it("does not call onDismiss before the timeout elapses", async () => {
      const onDismiss = jest.fn();
      await render(
        <ChatMessageBanner
          payload={mockPayload}
          onNavigate={jest.fn()}
          onDismiss={onDismiss}
        />,
      );

      jest.advanceTimersByTime(BANNER_DURATION_MS - 1);

      expect(onDismiss).not.toHaveBeenCalled();
    });

    it("calls onDismiss after 4 s without any user interaction", async () => {
      const onDismiss = jest.fn();
      await render(
        <ChatMessageBanner
          payload={mockPayload}
          onNavigate={jest.fn()}
          onDismiss={onDismiss}
        />,
      );

      act(() => {
        jest.advanceTimersByTime(BANNER_DURATION_MS);
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("does not call onNavigate during auto-dismiss", async () => {
      const onNavigate = jest.fn();
      await render(
        <ChatMessageBanner
          payload={mockPayload}
          onNavigate={onNavigate}
          onDismiss={jest.fn()}
        />,
      );

      act(() => {
        jest.advanceTimersByTime(BANNER_DURATION_MS + 500);
      });

      expect(onNavigate).not.toHaveBeenCalled();
    });
  });
});
