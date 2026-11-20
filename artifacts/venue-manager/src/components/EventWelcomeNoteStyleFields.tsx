import { MessageCircle } from "lucide-react";
import type { EventWelcomeNoteStyle } from "@workspace/api-client-react";

export const DEFAULT_EVENT_WELCOME_NOTE_STYLE: EventWelcomeNoteStyle = {
  font: "classic",
  color: "ink",
  card: "paper",
};

type Props = {
  note: string;
  style: EventWelcomeNoteStyle;
  onChange: (style: EventWelcomeNoteStyle) => void;
};

const fontFamilies: Record<EventWelcomeNoteStyle["font"], string> = {
  classic: "Inter, sans-serif",
  handwritten: "Caveat, cursive",
  serif: '"Playfair Display", serif',
};

export function EventWelcomeNoteStyleFields({ note, style, onChange }: Props) {
  const update = <K extends keyof EventWelcomeNoteStyle>(
    key: K,
    value: EventWelcomeNoteStyle[K],
  ) => onChange({ ...style, [key]: value });

  const cardSurface = style.card === "garden"
    ? { backgroundColor: "#E8F5E5", borderColor: "#E8F5E5", borderRadius: 24, borderWidth: 1, iconBackground: "#FFFFFF" }
    : style.card === "postcard"
      ? { backgroundColor: "#FFFFFF", borderColor: "#166534", borderRadius: 8, borderWidth: 2, iconBackground: "#E8F5E5" }
      : { backgroundColor: "#FFFFFF", borderColor: "#E2EAE0", borderRadius: 18, borderWidth: 1, iconBackground: "#E8F5E5" };
  const textColor = style.color === "forest"
    ? "#166534"
    : style.color === "soft"
      ? "#68776C"
      : "#19351F";

  return (
    <fieldset className="vm-note-style full">
      <legend>Welcome note style</legend>
      <div className="vm-note-style-fields">
        <label htmlFor="event-welcome-note-font">
          Font
          <select
            id="event-welcome-note-font"
            data-testid="event-welcome-note-font"
            value={style.font}
            onChange={(event) => update("font", event.target.value as EventWelcomeNoteStyle["font"])}
          >
            <option value="classic">Classic</option>
            <option value="handwritten">Handwritten</option>
            <option value="serif">Serif</option>
          </select>
        </label>
        <label htmlFor="event-welcome-note-color">
          Text color
          <select
            id="event-welcome-note-color"
            data-testid="event-welcome-note-color"
            value={style.color}
            onChange={(event) => update("color", event.target.value as EventWelcomeNoteStyle["color"])}
          >
            <option value="ink">Ink</option>
            <option value="forest">Forest</option>
            <option value="soft">Soft</option>
          </select>
        </label>
        <label htmlFor="event-welcome-note-card">
          Card
          <select
            id="event-welcome-note-card"
            data-testid="event-welcome-note-card"
            value={style.card}
            onChange={(event) => update("card", event.target.value as EventWelcomeNoteStyle["card"])}
          >
            <option value="paper">Paper</option>
            <option value="garden">Garden</option>
            <option value="postcard">Postcard</option>
          </select>
        </label>
      </div>
      <div
        aria-label="Guest preview"
        className="vm-welcome-note-preview"
        data-testid="preview-event-welcome-note"
        role="group"
        style={{
          backgroundColor: cardSurface.backgroundColor,
          borderColor: cardSurface.borderColor,
          borderRadius: cardSurface.borderRadius,
          borderWidth: cardSurface.borderWidth,
        }}
      >
        <div className="vm-welcome-note-heading">
          <span
            aria-hidden="true"
            className="vm-welcome-note-icon"
            style={{ backgroundColor: cardSurface.iconBackground }}
          >
            <MessageCircle size={18} color="#3DCC44" />
          </span>
          <strong>A note from the host</strong>
        </div>
        <p
          data-testid="preview-event-welcome-note-body"
          style={{
            color: textColor,
            fontFamily: fontFamilies[style.font],
            fontSize: style.font === "handwritten" ? 21 : 15,
            lineHeight: style.font === "handwritten" ? "27px" : "23px",
          }}
        >
          {note.trim() || "Your welcome note will appear here."}
        </p>
      </div>
    </fieldset>
  );
}
