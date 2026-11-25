import fs from "node:fs";
import path from "node:path";

const appDir = path.join(__dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(appDir, relativePath), "utf8");

describe("Events recovery and navigation", () => {
  const tabsLayout = read("(tabs)/_layout.tsx");
  const eventsSource = read("(tabs)/events.tsx");
  const eventDetails = read("event-details/[eventType]/[id].tsx");
  const plansSource = read("plans.tsx");
  const hangoutsSource = read("../components/HangoutsNearbyPanel.tsx");
  const followThroughSource = read("../components/EventFollowThroughActions.tsx");
  const colorsSource = read("../constants/colors.ts");

  it("does not reset the selected Events view when the tab is pressed", () => {
    expect(tabsLayout).not.toMatch(
      /tabPress:\s*\(\)\s*=>\s*navigation\.setParams\(\{\s*view:\s*["']hangouts["']\s*\}\)/,
    );
    expect(eventsSource).toMatch(/router\.setParams\(\{\s*view\s*\}\)/);
  });

  it("keeps an explicit retry action for feed failures", () => {
    expect(eventsSource).toMatch(/testID="events-feed-retry"/);
    expect(eventsSource).toMatch(/onPress=\{\(\) => void feed\.refetch\(\)\}/);
    expect(eventsSource).toMatch(/t\("common\.retry"\)/);
  });

  it("uses localized RSVP failure copy instead of exposing server errors", () => {
    const saveRsvpHandler =
      eventDetails.match(/const saveRsvp[\s\S]*?const updateFriendPlanInvitation/)?.[0] ??
      "";
    expect(eventsSource).toMatch(
      /catch\s*\([^)]*\)\s*\{\s*setActionError\(t\("tabs\.events\.eventActionError"\)\)/,
    );
    expect(saveRsvpHandler).toMatch(
      /catch\s*\([^)]*\)\s*\{\s*setActionError\(t\("tabs\.events\.eventActionError"\)\)/,
    );
    expect(eventsSource).not.toMatch(/setActionError\([^)]*\.message/);
    expect(saveRsvpHandler).not.toMatch(/setActionError\([^)]*\.message/);
  });

  it("lets event card copy and RSVP labels grow with system text", () => {
    const styleFor = (name: string) =>
      eventsSource.match(new RegExp(`${name}:\\s*\\{([^}]*)\\}`))?.[1] ?? "";

    for (const styleName of [
      "title",
      "subtitle",
      "eventDateHeading",
      "eventTitle",
      "eventMeta",
      "recurrenceMetaText",
      "description",
      "rsvpCount",
      "rsvpButtonText",
    ]) {
      expect(styleFor(styleName)).not.toMatch(/\blineHeight\b/);
    }

    expect(styleFor("eventCard")).not.toMatch(/\b(?:height|maxHeight)\b/);
    expect(styleFor("rsvpButtonText")).toMatch(/\bflexShrink:\s*1\b/);
    expect(styleFor("rsvpButtonText")).toMatch(/\bminWidth:\s*0\b/);
    expect(eventsSource).toMatch(/<Text allowFontScaling style=\{\[styles\.eventTitle/);
    expect(eventsSource).toMatch(/<Text allowFontScaling style=\{\[styles\.eventMeta/);
    expect(eventsSource).toMatch(/<Text allowFontScaling style=\{\[styles\.description/);
    expect(eventsSource).toMatch(/<Text allowFontScaling style=\{\[styles\.rsvpCount/);
    expect(eventsSource).toMatch(/<Text\s+allowFontScaling\s+style=\{\[\s*styles\.rsvpButtonText/);
    expect(eventsSource).not.toMatch(/numberOfLines=/);
  });

  it("matches the approved warm palette, card shapes, and pill actions", () => {
    expect(colorsSource).toContain('background: "#F7F5EF"');
    expect(colorsSource).toContain('card: "#FFFDF8"');
    expect(colorsSource).toContain('brandPanel: "#245A35"');

    expect(eventsSource).toMatch(/eventCard:\s*\{[^}]*borderRadius:\s*17/);
    expect(eventsSource).toMatch(/cover:\s*\{[^}]*height:\s*128/);
    expect(eventsSource).toMatch(/rsvpButton:\s*\{[^}]*borderRadius:\s*22/);
    expect(hangoutsSource).toMatch(/hangoutCard:\s*\{[^}]*borderRadius:\s*17/);
    expect(hangoutsSource).toMatch(/featuredBanner:\s*\{[^}]*minHeight:\s*128/);
    expect(hangoutsSource).toMatch(/requestButton:\s*\{[^}]*borderRadius:\s*22/);
    expect(plansSource).toMatch(
      /dateBadge:\s*\{[^}]*borderTopLeftRadius:\s*13[^}]*borderBottomLeftRadius:\s*4/,
    );
    expect(eventDetails).toMatch(/detailMetaGrid:\s*\{/);
    expect(eventDetails).toMatch(/dateTime\.when/);
    expect(eventDetails).toMatch(/dateTime\.where/);
    expect(eventDetails).toMatch(/hangoutActionButton:\s*\{[^}]*borderRadius:\s*24/);
    expect(followThroughSource).toMatch(/actionButton:\s*\{[^}]*borderRadius:\s*22/);
  });
});
