import { describe, expect, it } from "vitest";
import { normalizeVenuePlaceSearchResult } from "../lib/venuePlaceSearch";

describe("normalizeVenuePlaceSearchResult", () => {
  it("maps the API placeName field to the application form's name field", () => {
    expect(normalizeVenuePlaceSearchResult({
      placeId: "ChIJ123",
      placeName: "Teacher Cafe",
      address: "Beirut",
      lat: 33.8938,
      lng: 35.5018,
    })).toEqual({
      placeId: "ChIJ123",
      name: "Teacher Cafe",
      address: "Beirut",
      lat: 33.8938,
      lng: 35.5018,
    });
  });

  it("normalizes a missing address to an empty string", () => {
    expect(normalizeVenuePlaceSearchResult({
      placeId: "ChIJ123",
      placeName: "Teacher Cafe",
      address: null,
      lat: 33.8938,
      lng: 35.5018,
    }).address).toBe("");
  });
});