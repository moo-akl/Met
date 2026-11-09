import {
  DEFAULT_EVENT_MAP_DURATION_MS,
  getCurrentEventMapPins,
  type EventMapPinCandidate,
} from "../eventMapPins";

const now = Date.UTC(2026, 10, 9, 12);

function makeEvent(
  id: number,
  overrides: Partial<EventMapPinCandidate> = {},
): EventMapPinCandidate {
  return {
    eventType: "member",
    id,
    title: `Event ${id}`,
    location: "Bangkok park",
    venueName: null,
    startsAt: new Date(now + 60 * 60_000).toISOString(),
    endsAt: new Date(now + 2 * 60 * 60_000).toISOString(),
    latitude: 13.7563,
    longitude: 100.5018,
    visibility: "public",
    joinApprovalRequired: false,
    ...overrides,
  };
}

describe("getCurrentEventMapPins", () => {
  it("keeps future and in-progress events until their end time", () => {
    const events = [
      makeEvent(1),
      makeEvent(2, {
        startsAt: new Date(now - 60 * 60_000).toISOString(),
        endsAt: new Date(now + 60 * 60_000).toISOString(),
      }),
      makeEvent(3, {
        startsAt: new Date(now - 2 * 60 * 60_000).toISOString(),
        endsAt: new Date(now - 1).toISOString(),
      }),
    ];

    expect(getCurrentEventMapPins(events, now).map((event) => event.id)).toEqual([1, 2]);
  });

  it("uses the four-hour default when no end time is provided", () => {
    const active = makeEvent(4, {
      startsAt: new Date(now - 3 * 60 * 60_000).toISOString(),
      endsAt: null,
    });
    const expired = makeEvent(5, {
      startsAt: new Date(now - 5 * 60 * 60_000).toISOString(),
      endsAt: null,
    });

    expect(DEFAULT_EVENT_MAP_DURATION_MS).toBe(4 * 60 * 60 * 1000);
    expect(getCurrentEventMapPins([active, expired], now).map((event) => event.id)).toEqual([4]);
  });

  it("skips events without usable coordinates or dates", () => {
    const missingCoordinates = makeEvent(6, { latitude: null });
    const invalidDate = makeEvent(7, { endsAt: "not-a-date" });

    expect(getCurrentEventMapPins([missingCoordinates, invalidDate], now)).toEqual([]);
  });

  it("keeps event and hangout pins together for the heat map", () => {
    const pins = getCurrentEventMapPins(
      [makeEvent(8, { eventType: "venue" }), makeEvent(9, { joinApprovalRequired: true })],
      now,
    );

    expect(pins.map((event) => event.id)).toEqual([8, 9]);
  });
});
