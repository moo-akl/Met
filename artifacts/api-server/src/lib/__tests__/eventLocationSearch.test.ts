import { describe, expect, it } from "vitest";
import { parsePhotonLocations } from "../eventLocationSearch";

describe("parsePhotonLocations", () => {
  it("formats real place results with stable OSM IDs and coordinates", () => {
    const locations = parsePhotonLocations({
      features: [
        {
          properties: {
            osm_type: "N",
            osm_id: 12345,
            name: "Example Cafe",
            housenumber: "12",
            street: "Main Street",
            city: "Bangkok",
            country: "Thailand",
          },
          geometry: { coordinates: [100.5018, 13.7563] },
        },
      ],
    });

    expect(locations).toEqual([
      {
        placeId: "n:12345",
        label: "Example Cafe, 12 Main Street, Bangkok, Thailand",
        name: "Example Cafe",
        latitude: 13.7563,
        longitude: 100.5018,
      },
    ]);
  });

  it("drops malformed, duplicate, and out-of-range results", () => {
    const locations = parsePhotonLocations({
      features: [
        {
          properties: { osm_type: "W", osm_id: 7, name: "First" },
          geometry: { coordinates: [10, 20] },
        },
        {
          properties: { osm_type: "W", osm_id: 7, name: "Duplicate" },
          geometry: { coordinates: [11, 21] },
        },
        {
          properties: { osm_type: "N", osm_id: 8, name: "Invalid" },
          geometry: { coordinates: [190, 20] },
        },
      ],
    });

    expect(locations).toHaveLength(1);
    expect(locations[0]?.name).toBe("First");
  });
});
