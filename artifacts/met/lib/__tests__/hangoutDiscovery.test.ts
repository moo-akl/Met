import {
  discoverHangouts,
  getLocalDateKey,
  parseHangoutDateFilter,
  type HangoutTimePeriod,
} from "../hangoutDiscovery";
import type { EventFeedItem } from "@workspace/api-client-react";

function makeHangout(
  id: number,
  startsAt: Date,
  latitude: number,
  longitude: number,
  overrides: Record<string, unknown> = {},
): EventFeedItem {
  return {
    eventType: "member",
    id,
    title: `Hangout ${id}`,
    description: null,
    imageUrl: null,
    contactPhone: null,
    websiteUrl: null,
    publicEmail: null,
    startsAt: startsAt.toISOString(),
    endsAt: null,
    location: "Riverside Park",
    locationPlaceId: `place-${id}`,
    placeId: null,
    venueName: null,
    creatorName: "Host",
    latitude,
    longitude,
    visibility: "public",
    rsvpCount: 0,
    myRsvp: null,
    isInvited: false,
    joinApprovalRequired: true,
    myJoinRequestStatus: null,
    ...overrides,
  } as EventFeedItem;
}

const options = (
  overrides: Partial<{
    userLocation: { latitude: number; longitude: number } | null;
    locationQuery: string;
    dateFilter: string | null;
    timePeriod: HangoutTimePeriod;
    sortMode: "nearest" | "soonest";
  }> = {},
) => ({
  userLocation: { latitude: 13.75, longitude: 100.5 },
  locationQuery: "",
  dateFilter: null,
  timePeriod: "any" as const,
  sortMode: "nearest" as const,
  ...overrides,
});

describe("hangout discovery", () => {
  it("orders by distance, then by start time", () => {
    const base = new Date(2030, 2, 1, 18);
    const farSoon = makeHangout(1, new Date(base.getTime() + 60 * 60_000), 13.8, 100.5);
    const nearLate = makeHangout(2, new Date(base.getTime() + 2 * 60 * 60_000), 13.751, 100.5);
    const nearSoon = makeHangout(3, base, 13.751, 100.5);

    expect(discoverHangouts([farSoon, nearLate, nearSoon], options()).map((event) => event.id))
      .toEqual([3, 2, 1]);
  });

  it("supports soonest-first sorting with distance as the tie-breaker", () => {
    const base = new Date(2030, 2, 1, 18);
    const farSoon = makeHangout(1, base, 13.8, 100.5);
    const nearLate = makeHangout(2, new Date(base.getTime() + 60 * 60_000), 13.751, 100.5);
    const nearSoon = makeHangout(3, base, 13.751, 100.5);

    expect(
      discoverHangouts(
        [nearLate, farSoon, nearSoon],
        options({ sortMode: "soonest" }),
      ).map((event) => event.id),
    ).toEqual([3, 1, 2]);
  });

  it("filters public hangouts by location, local date, and time of day", () => {
    const matchingTime = new Date(2030, 2, 1, 18, 30);
    const otherTime = new Date(2030, 2, 1, 10, 30);
    const inPlace = makeHangout(1, matchingTime, 13.751, 100.5);
    const wrongTime = makeHangout(2, otherTime, 13.751, 100.5);
    const wrongPlace = makeHangout(3, matchingTime, 13.751, 100.5, {
      location: "City Museum",
    });

    expect(
      discoverHangouts(
        [wrongPlace, wrongTime, inPlace],
        options({
          locationQuery: "riverside",
          dateFilter: getLocalDateKey(matchingTime.toISOString()),
          timePeriod: "evening",
        }),
      ).map((event) => event.id),
    ).toEqual([1]);
  });

  it("excludes private plans and ordinary events", () => {
    const date = new Date(2030, 2, 1, 18);
    const privateHangout = makeHangout(1, date, 13.751, 100.5, {
      visibility: "invite_only",
    });
    const ordinaryEvent = makeHangout(2, date, 13.751, 100.5, {
      joinApprovalRequired: false,
    });

    expect(discoverHangouts([privateHangout, ordinaryEvent], options())).toEqual([]);
  });

  it("accepts only real calendar dates in the date filter", () => {
    expect(parseHangoutDateFilter("2030-02-28")).toBe("2030-02-28");
    expect(parseHangoutDateFilter("2030-02-30")).toBeNull();
    expect(parseHangoutDateFilter("2030-2-3")).toBeNull();
  });
});
