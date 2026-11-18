import fs from "node:fs";
import path from "node:path";

const appDir = path.join(__dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(appDir, relativePath), "utf8");

describe("Events recovery and navigation", () => {
  const tabsLayout = read("(tabs)/_layout.tsx");
  const eventsSource = read("(tabs)/events.tsx");
  const eventDetails = read("event-details/[eventType]/[id].tsx");

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
});
