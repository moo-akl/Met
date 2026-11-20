import type { EventWelcomeNoteStyle } from "@workspace/api-client-react";

export const DEFAULT_EVENT_WELCOME_NOTE_STYLE: EventWelcomeNoteStyle = {
  font: "classic",
  color: "ink",
  card: "paper",
};

export const WELCOME_NOTE_FONTS = [
  { value: "classic", labelKey: "tabs.events.welcomeFontClassic" },
  { value: "handwritten", labelKey: "tabs.events.welcomeFontHandwritten" },
  { value: "serif", labelKey: "tabs.events.welcomeFontSerif" },
] as const satisfies ReadonlyArray<{
  value: EventWelcomeNoteStyle["font"];
  labelKey: string;
}>;

export const WELCOME_NOTE_COLORS = [
  { value: "ink", labelKey: "tabs.events.welcomeColorInk" },
  { value: "forest", labelKey: "tabs.events.welcomeColorForest" },
  { value: "soft", labelKey: "tabs.events.welcomeColorSoft" },
] as const satisfies ReadonlyArray<{
  value: EventWelcomeNoteStyle["color"];
  labelKey: string;
}>;

export const WELCOME_NOTE_CARDS = [
  { value: "paper", labelKey: "tabs.events.welcomeCardPaper" },
  { value: "garden", labelKey: "tabs.events.welcomeCardGarden" },
  { value: "postcard", labelKey: "tabs.events.welcomeCardPostcard" },
] as const satisfies ReadonlyArray<{
  value: EventWelcomeNoteStyle["card"];
  labelKey: string;
}>;

export function resolveEventWelcomeNoteStyle(
  style?: EventWelcomeNoteStyle | null,
): EventWelcomeNoteStyle {
  return style ?? DEFAULT_EVENT_WELCOME_NOTE_STYLE;
}
