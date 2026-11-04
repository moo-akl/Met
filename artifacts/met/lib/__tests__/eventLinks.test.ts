import { buildEventDetailsUrl } from "../eventLinks";

describe("buildEventDetailsUrl", () => {
  it("creates a versioned canonical event-details link for a venue event", () => {
    expect(buildEventDetailsUrl("venue", 123, 1700000000000)).toBe(
      "https://met-app.org/event-details/venue/123?preview=1700000000000",
    );
  });

  it("adds a new cache key to each share by default", () => {
    expect(buildEventDetailsUrl("venue", 123)).toMatch(
      /^https:\/\/met-app\.org\/event-details\/venue\/123\?preview=\d+$/,
    );
  });

  it("rejects invalid event IDs", () => {
    expect(() => buildEventDetailsUrl("venue", 0)).toThrow(
      "A valid event ID is required to share this event.",
    );
    expect(() => buildEventDetailsUrl("venue", -2)).toThrow();
    expect(() => buildEventDetailsUrl("venue", Number.NaN)).toThrow();
  });

  it("rejects invalid preview versions", () => {
    expect(() => buildEventDetailsUrl("venue", 123, 0)).toThrow(
      "A valid preview version is required to share this event.",
    );
    expect(() => buildEventDetailsUrl("venue", 123, Number.NaN)).toThrow();
  });
});
