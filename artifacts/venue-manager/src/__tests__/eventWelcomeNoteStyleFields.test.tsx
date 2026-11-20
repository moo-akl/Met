import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { EventWelcomeNoteStyle } from "@workspace/api-client-react";
import {
  DEFAULT_EVENT_WELCOME_NOTE_STYLE,
  EventWelcomeNoteStyleFields,
} from "../components/EventWelcomeNoteStyleFields";

function WelcomeNoteFields() {
  const [style, setStyle] = useState<EventWelcomeNoteStyle>(
    DEFAULT_EVENT_WELCOME_NOTE_STYLE,
  );
  return (
    <EventWelcomeNoteStyleFields
      note="Welcome to the event."
      style={style}
      onChange={setStyle}
    />
  );
}

describe("EventWelcomeNoteStyleFields", () => {
  it("offers labeled choices and updates the guest preview", () => {
    render(<WelcomeNoteFields />);

    const group = screen.getByRole("group", { name: "Welcome note style" });
    expect(group).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Font"), {
      target: { value: "handwritten" },
    });
    fireEvent.change(screen.getByLabelText("Text color"), {
      target: { value: "forest" },
    });
    fireEvent.change(screen.getByLabelText("Card"), {
      target: { value: "garden" },
    });

    expect(screen.getByTestId("event-welcome-note-font")).toHaveValue("handwritten");
    expect(screen.getByTestId("event-welcome-note-color")).toHaveValue("forest");
    expect(screen.getByTestId("event-welcome-note-card")).toHaveValue("garden");
    expect(screen.getByTestId("preview-event-welcome-note-body")).toHaveStyle({
      color: "#166534",
      fontFamily: "Caveat, cursive",
      fontSize: "21px",
    });
    expect(screen.getByTestId("preview-event-welcome-note")).toHaveStyle({
      backgroundColor: "#E8F5E5",
      borderRadius: "24px",
    });
  });
});
