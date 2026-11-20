import React from "react";
import {
  ArrowLeft, ArrowUpRight, CalendarDays, Check, ChevronRight, Clock3, Edit2,
  MapPin, MessageCircle, Plus, RefreshCw, Sun, Users, UserRound, X,
} from "lucide-react";

type Style = Record<string, unknown> | null | undefined;
type StyleInput = Style | Style[] | false;

export const StyleSheet = {
  hairlineWidth: 1,
  absoluteFillObject: { position: "absolute", inset: 0 },
  create: <T extends Record<string, Style>>(styles: T) => styles,
};

function flattenStyle(style: StyleInput): React.CSSProperties {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.map((part) => flattenStyle(part)));
  const result: Record<string, unknown> = { ...style };
  if (result.display === undefined) result.display = "flex";
  if (typeof result.lineHeight === "number") result.lineHeight = `${result.lineHeight}px`;
  if (typeof result.fontFamily === "string" && result.fontFamily.startsWith("Inter_")) {
    result.fontFamily = "Inter, sans-serif";
  }
  if (typeof result.fontWeight === "string" && result.fontWeight === "700") result.fontWeight = 700;
  if (typeof result.fontWeight === "string" && result.fontWeight === "600") result.fontWeight = 600;
  return result as React.CSSProperties;
}

function flexStyle(style: StyleInput): React.CSSProperties {
  const result = flattenStyle(style) as Record<string, unknown>;
  result.display = "flex";
  if (result.flexDirection === undefined) result.flexDirection = "column";
  return result as React.CSSProperties;
}

type CommonProps = React.PropsWithChildren<Record<string, any>>;

function mapDomProps(props: Record<string, any>) {
  const {
    accessibilityRole,
    accessibilityLabel,
    accessibilityHint,
    accessibilityState,
    testID,
    showsVerticalScrollIndicator: _showsVerticalScrollIndicator,
    keyboardShouldPersistTaps: _keyboardShouldPersistTaps,
    ...domProps
  } = props;
  const result: Record<string, any> = { ...domProps };
  if (accessibilityRole) result.role = accessibilityRole;
  if (accessibilityLabel) result["aria-label"] = accessibilityLabel;
  if (accessibilityHint) result["aria-description"] = accessibilityHint;
  if (testID) result["data-testid"] = testID;
  if (accessibilityState) {
    if (accessibilityState.expanded !== undefined) {
      result["aria-expanded"] = accessibilityState.expanded;
    }
    if (accessibilityState.selected !== undefined) {
      result["aria-pressed"] = accessibilityState.selected;
    }
    if (accessibilityState.checked !== undefined) {
      result["aria-checked"] = accessibilityState.checked;
    }
    if (accessibilityState.disabled !== undefined) {
      result["aria-disabled"] = accessibilityState.disabled;
    }
  }
  return result;
}

export function View({ children, style, ...props }: CommonProps) {
  return <div {...mapDomProps(props)} style={flexStyle(style)}>{children}</div>;
}

export function Text({ children, style, numberOfLines, ...props }: CommonProps) {
  return <div {...mapDomProps(props)} style={{ ...flattenStyle(style), display: numberOfLines ? "-webkit-box" : "block", minWidth: 0, maxWidth: "100%", ...(numberOfLines ? { WebkitLineClamp: numberOfLines, WebkitBoxOrient: "vertical", overflow: "hidden" } : {}) }}>{children}</div>;
}

export function Pressable({ children, style, onPress, disabled, ...props }: CommonProps) {
  const resolved = typeof style === "function" ? style({ pressed: false }) : style;
  return <button type="button" {...mapDomProps(props)} disabled={disabled} onClick={onPress} style={{ border: "0", cursor: disabled ? "default" : "pointer", padding: 0, textAlign: "inherit", background: "transparent", ...flexStyle(resolved) }}>{children}</button>;
}

export function ScrollView({ children, contentContainerStyle, style, ...props }: CommonProps) {
  return <div {...mapDomProps(props)} style={{ ...flexStyle(style), overflow: "auto", minHeight: 0, minWidth: 0 }}><div style={flexStyle(contentContainerStyle)}>{children}</div></div>;
}

export function Image({ source, style, ...props }: CommonProps) {
  return <img {...props} src={source?.uri} style={{ ...flattenStyle(style), objectFit: props.resizeMode === "contain" ? "contain" : "cover" }} />;
}

export function ActivityIndicator({ color }: { color?: string; size?: string }) {
  return <span aria-label="Loading" style={{ width: 18, height: 18, border: `2px solid ${color ?? "currentColor"}`, borderRightColor: "transparent", borderRadius: "50%", display: "inline-block" }} />;
}

export function Modal({ visible, children }: CommonProps) {
  return visible ? <div style={{ position: "fixed", inset: 0, zIndex: 20 }}>{children}</div> : null;
}

export const Platform = { OS: "ios" as const };
export function useSafeAreaInsets() { return { top: 0, bottom: 0, left: 0, right: 0 }; }

const icons: Record<string, React.ComponentType<any>> = {
  "arrow-left": ArrowLeft, "arrow-up-right": ArrowUpRight, calendar: CalendarDays,
  "chevron-right": ChevronRight, "chevron-down": ChevronRight, clock: Clock3, "edit-2": Edit2, "map-pin": MapPin,
  "message-circle": MessageCircle, plus: Plus, "refresh-cw": RefreshCw, sun: Sun,
  users: Users, user: UserRound, "check-circle": Check, x: X,
};
export function Feather({ name, size = 18, color = "currentColor" }: { name: string; size?: number; color?: string }) {
  const Icon = icons[name] ?? CalendarDays;
  return <Icon size={size} color={color} strokeWidth={2} aria-hidden="true" />;
}

export function useColors() {
  return {
    text: "var(--met-text)", background: "var(--met-background)", card: "var(--met-card)",
    primary: "var(--met-primary)", primaryForeground: "var(--met-primary-foreground)",
    primarySoft: "var(--met-primary-soft)", mutedForeground: "var(--met-muted-foreground)",
    border: "var(--met-border)", destructive: "var(--met-destructive)",
  };
}

const translations: Record<string, string> = {
  "common.back": "Back", "plans.screenKicker": "YOUR PEOPLE, YOUR PLANS", "plans.screenTitle": "Plans",
  "plans.createA11y": "Create a plan", "plans.screenIntro": "Browse public hangouts and plans you host, joined, or requested to join.",
  "plans.loading": "Loading your plans…", "plans.screenLoadError": "Plans didn’t load",
  "plans.retry": "Tap to try again.", "plans.screenEmptyTitle": "Nothing on the calendar yet.",
  "plans.screenEmptyBody": "Start with a simple idea and invite your connections.",
  "plans.make": "Make a plan", "plans.hosting": "You’re hosting",
  "tabs.events.detailsView": "View event details", "tabs.events.joinRequestPending": "Your request is waiting for the host.",
  "tabs.events.requestAgain": "Request again", "tabs.events.going": "Going",
  "tabs.events.interested": "Interested", "tabs.events.notGoing": "Not going",
  "tabs.events.requestToJoin": "Request to join", "tabs.events.invited": "Invited",
  "plans.openChatTitleA11y": "Open chat for {title}",
  "tabs.events.title": "Events", "tabs.events.nearbyTab": "Hangouts", "tabs.events.nearbySubtitle": "Public hangouts anyone can request to join.",
  "tabs.events.subtitle": "Upcoming plans from venues and Met members", "tabs.events.enableNearby": "Show nearby events first",
  "tabs.events.create": "Create event", "tabs.events.quickPlan": "Hangout", "tabs.events.networks": "Networks",
  "tabs.events.venueEvent": "Venue event", "tabs.events.memberEvent": "Member event", "tabs.events.inviteOnly": "Invite-only",
  "tabs.events.sortBy": "Sort by", "tabs.events.sortNearest": "Nearest", "tabs.events.sortSoonest": "Soonest",
  "tabs.events.distanceAway": "{distance} away", "tabs.events.noHangouts": "No hangouts match those filters.",
  "tabs.events.nearestUsesTimeUntilLocation": "Showing by start time until your location is available.",
  "tabs.events.empty": "No upcoming events", "tabs.events.emptyBody": "Create one or check back soon.",
  "tabs.events.loadError": "Events couldn’t load", "tabs.events.refreshHint": "Check your connection and pull to refresh.",
  "tabs.events.loadMoreHangouts": "Load more hangouts", "common.retry": "Retry",
  "verifiedExplorer.eventOnly": "Verified explorers", "dateTime.time": "Time", "common.cancel": "Cancel", "common.save": "Save",
};
export function useT() {
  return { t: (key: string, values?: Record<string, string>) => {
    let text = translations[key] ?? key;
    Object.entries(values ?? {}).forEach(([name, value]) => { text = text.replace(`{${name}}`, value); });
    return text;
  }, lang: "en", rtl: false };
}
