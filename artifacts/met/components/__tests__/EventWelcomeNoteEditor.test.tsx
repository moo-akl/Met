import React from "react";
import { useState } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import type { useColors } from "@/hooks/useColors";
import type { EventWelcomeNoteStyle } from "@workspace/api-client-react";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
jest.mock("@/lib/i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}));

import { EventWelcomeNoteEditor } from "../EventWelcomeNoteEditor";

const style = {
  font: "classic",
  color: "ink",
  card: "paper",
} satisfies EventWelcomeNoteStyle;
const colors = {
  background: "#fff",
  border: "#ddd",
  card: "#fafafa",
  destructive: "#c00",
  foreground: "#111",
  muted: "#eee",
  mutedForeground: "#666",
  primary: "#30a83c",
  primaryForeground: "#fff",
  primarySoft: "#e5f4e5",
  secondaryForeground: "#276238",
  text: "#111",
};

describe("EventWelcomeNoteEditor", () => {
  it("offers accessible style choices and previews the shared guest card", async () => {
    const onStyleChange = jest.fn();
    const Harness = () => {
      const [currentStyle, setCurrentStyle] =
        useState<EventWelcomeNoteStyle>(style);
      return (
        <EventWelcomeNoteEditor
          value="See you at the picnic."
          onChangeText={jest.fn()}
          style={currentStyle}
          onStyleChange={(nextStyle) => {
            onStyleChange(nextStyle);
            setCurrentStyle(nextStyle);
          }}
          colors={colors as ReturnType<typeof useColors>}
          testIDPrefix="welcome-note"
        />
      );
    };
    const screen = await render(<Harness />);

    expect(screen.getByTestId("welcome-note-font-classic").props.accessibilityState)
      .toEqual({ checked: true });
    expect(screen.getByTestId("welcome-note-preview-body").props.children)
      .toBe("See you at the picnic.");
    expect(screen.getByTestId("welcome-note-preview-card")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("welcome-note-font-handwritten"));
    await fireEvent.press(screen.getByTestId("welcome-note-color-forest"));
    await fireEvent.press(screen.getByTestId("welcome-note-card-postcard"));

    expect(onStyleChange).toHaveBeenLastCalledWith({
      font: "handwritten",
      color: "forest",
      card: "postcard",
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId("welcome-note-preview-body").props.style,
      ),
    ).toMatchObject({
      color: "#276238",
      fontFamily: "Caveat_500Medium",
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId("welcome-note-preview-card").props.style,
      ),
    ).toMatchObject({
      borderColor: "#276238",
      borderRadius: 8,
      borderWidth: 2,
    });
    expect(onStyleChange).toHaveBeenNthCalledWith(1, {
      font: "handwritten",
      color: "ink",
      card: "paper",
    });
    expect(onStyleChange).toHaveBeenNthCalledWith(2, {
      font: "handwritten",
      color: "forest",
      card: "paper",
    });
  });

  it("applies a readable handwritten guestbook style to the live preview", async () => {
    const onStyleChange = jest.fn();
    const Harness = () => {
      const [currentStyle, setCurrentStyle] =
        useState<EventWelcomeNoteStyle>(style);
      return (
        <EventWelcomeNoteEditor
          value="Welcome. The garden gate is on your left."
          onChangeText={jest.fn()}
          style={currentStyle}
          onStyleChange={(nextStyle) => {
            onStyleChange(nextStyle);
            setCurrentStyle(nextStyle);
          }}
          colors={colors as ReturnType<typeof useColors>}
          testIDPrefix="welcome-note"
        />
      );
    };
    const screen = await render(<Harness />);

    await fireEvent.press(screen.getByTestId("welcome-note-card-guestbook"));

    expect(onStyleChange).toHaveBeenLastCalledWith({
      font: "handwritten",
      color: "ink",
      card: "guestbook",
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId("welcome-note-preview-body").props.style,
      ),
    ).toMatchObject({
      color: "#111",
      fontFamily: "Caveat_500Medium",
      fontSize: 21,
      lineHeight: 27,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId("welcome-note-preview-card").props.style,
      ),
    ).toMatchObject({
      borderColor: "#276238",
      borderRadius: 13,
      borderWidth: 1,
    });
    expect(screen.getByTestId("welcome-note-preview-card-rules")).toBeTruthy();
  });
});
