import { describe, expect, it } from "vitest";
import {
  countVenueEventRsvps,
  filterVenueEventRsvps,
  type VenueEventRsvp,
} from "../lib/eventRsvpGroups";

const rsvps: VenueEventRsvp[] = [
  { uid: "guest-going", displayName: "Alex Going", photoUrl: null, status: "going" },
  { uid: "guest-maybe", displayName: "Sam Maybe", photoUrl: null, status: "maybe" },
  { uid: "guest-not-going", displayName: "Taylor Not Going", photoUrl: null, status: "not_going" },
];

describe("venue event RSVP groups", () => {
  it("counts every response status, including not going", () => {
    expect(countVenueEventRsvps(rsvps)).toEqual({
      all: 3,
      going: 1,
      maybe: 1,
      not_going: 1,
    });
  });

  it("filters each status group and keeps guest search case-insensitive", () => {
    expect(filterVenueEventRsvps(rsvps, "going", "")).toEqual([rsvps[0]]);
    expect(filterVenueEventRsvps(rsvps, "maybe", "SAM")).toEqual([rsvps[1]]);
    expect(filterVenueEventRsvps(rsvps, "not_going", "taylor")).toEqual([rsvps[2]]);
    expect(filterVenueEventRsvps(rsvps, "all", "going")).toEqual([
      rsvps[0],
      rsvps[2],
    ]);
  });
});
