import {
  DEFAULT_EVENT_MAP_DURATION_MS,
  EVENT_MAP_START_WINDOW_MS,
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
    myRsvp: "going",
    joinApprovalRequired: false,
    ownerUid: "host-uid",
    myJoinRequestStatus: null,
    ...overrides,
  };
}

describe("getCurrentEventMapPins", () => {
  it("shows Going events beginning two hours before start and removes them at end", () => {
    const events = [
      makeEvent(1, {
        startsAt: new Date(now + EVENT_MAP_START_WINDOW_MS).toISOString(),
      }),
      makeEvent(2, {
        startsAt: new Date(now + EVENT_MAP_START_WINDOW_MS + 1).toISOString(),
      }),
      makeEvent(3, {
        startsAt: new Date(now - 60 * 60_000).toISOString(),
        endsAt: new Date(now + 60 * 60_000).toISOString(),
      }),
      makeEvent(4, { endsAt: new Date(now).toISOString() }),
    ];

    expect(getCurrentEventMapPins(events, now).map((event) => event.id)).toEqual([1, 3]);
  });

  it("shows only events with a Going RSVP", () => {
    const events = [
      makeEvent(1, { myRsvp: "going" }),
      makeEvent(2, { myRsvp: "maybe" }),
      makeEvent(3, { myRsvp: "not_going" }),
      makeEvent(4, { myRsvp: null }),
    ];

    expect(getCurrentEventMapPins(events, now).map((event) => event.id)).toEqual([1]);
  });

  it("treats the signed-in creator of a personal Plan as going", () => {
    const creatorPlan = makeEvent(1, {
      ownerUid: "viewer",
      myRsvp: null,
      visibility: "invite_only",
    });
    const creatorEvent = makeEvent(2, {
      ownerUid: "viewer",
      myRsvp: null,
      visibility: "public",
      joinApprovalRequired: false,
    });

    expect(getCurrentEventMapPins([creatorPlan, creatorEvent], now, "viewer").map((event) => event.id))
      .toEqual([1]);
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
      [
        makeEvent(8, { eventType: "venue" }),
        makeEvent(9, { joinApprovalRequired: true }),
        makeEvent(10, { visibility: "invite_only" }),
      ],
      now,
    );

    expect(pins.map((event) => event.id)).toEqual([8, 9, 10]);
  });
});
