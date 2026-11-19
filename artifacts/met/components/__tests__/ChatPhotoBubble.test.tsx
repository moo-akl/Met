import React from "react";
import { StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";
import {
  ChatPhotoBubble,
  ChatPhotoDraftPreview,
} from "../ChatPhotoBubble";

const colors = {
  card: "#FFFFFF",
  border: "#DDE4DE",
  foreground: "#19351F",
  muted: "#F3F4F6",
  mutedForeground: "#68776C",
  primary: "#3DCC44",
  destructive: "#EF4444",
};

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    card: "#FFFFFF",
    border: "#DDE4DE",
    foreground: "#19351F",
    muted: "#F3F4F6",
    mutedForeground: "#68776C",
    primary: "#3DCC44",
    destructive: "#EF4444",
  }),
}));
jest.mock("@/lib/i18n", () => ({
  useT: () => ({
    t: (key: string) =>
      ({
        "chat.photo": "Photo",
        "chat.removePhoto": "Remove photo",
        "chat.preparingPhoto": "Preparing photo…",
        "chat.uploadingPhoto": "Uploading photo…",
        "chat.readyToSendPhoto": "Ready to send",
        "chat.sendFailed": "Couldn't send. Tap to try again.",
        "common.sending": "Sending…",
      })[key] ?? key,
  }),
}));
jest.mock("expo-image", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) =>
      React.createElement(View, props),
  };
});
jest.mock("@expo/vector-icons", () => ({
  Feather: () => null,
}));

describe("chat photo rendering", () => {
  it("renders sent photo bubbles without a green fill", async () => {
    const screen = await render(
      <ChatPhotoBubble
        uri="file:///photo.jpg"
        onPress={jest.fn()}
        onLongPress={jest.fn()}
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId("chat-photo-message-bubble").props.style,
      ).backgroundColor,
    ).toBe("transparent");
    expect(screen.getByTestId("chat-photo-image").props.source)
      .toEqual({ uri: "file:///photo.jpg" });
  });

  it("uses the card surface for a photo caption, not the green message bubble", async () => {
    const screen = await render(
      <ChatPhotoBubble
        uri="file:///photo.jpg"
        caption="At the entrance"
        onPress={jest.fn()}
        onLongPress={jest.fn()}
      />,
    );

    expect(
      StyleSheet.flatten(screen.getByTestId("chat-photo-caption").props.style)
        .backgroundColor,
    ).toBe(colors.card);
  });

  it("shows the local photo and preparation state on a card surface", async () => {
    const screen = await render(
      <ChatPhotoDraftPreview
        uri="file:///local-photo.jpg"
        status="preparing"
        progress={null}
        onPress={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(
      StyleSheet.flatten(screen.getByTestId("chat-photo-preview").props.style)
        .backgroundColor,
    ).toBe(colors.card);
    expect(screen.getByTestId("chat-photo-preview-image").props.source)
      .toEqual({ uri: "file:///local-photo.jpg" });
    expect(screen.getByTestId("chat-image-upload-status-text").props.children)
      .toBe("Preparing photo…");
  });

  it("includes upload progress and send state in the live status", async () => {
    const screen = await render(
      <ChatPhotoDraftPreview
        uri="file:///local-photo.jpg"
        status="uploading"
        progress={0.42}
        onPress={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.getByTestId("chat-image-upload-status-text").props.children)
      .toBe("Uploading photo… 42%");
  });
});
