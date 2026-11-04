import { nearestEventLocations } from "../nearestEventLocations";

describe("nearestEventLocations", () => {
  const origin = { latitude: 13.75, longitude: 100.5 };
  const places = [
    { name: "far", latitude: 14.75, longitude: 100.5 },
    { name: "near", latitude: 13.751, longitude: 100.5 },
    { name: "middle", latitude: 13.76, longitude: 100.5 },
  ];

  it("puts the closest suggestion first and preserves provider data", () => {
    expect(nearestEventLocations(places, origin).map(({ name }) => name)).toEqual([
      "near",
      "middle",
      "far",
    ]);
    expect(places.map(({ name }) => name)).toEqual(["far", "near", "middle"]);
  });

  it("retains the provider order when device location is unavailable", () => {
    expect(nearestEventLocations(places, null)).toEqual(places);
  });

  it("keeps stable order for tied and invalid coordinates", () => {
    const tied = [
      { name: "first", latitude: 0, longitude: 0 },
      { name: "second", latitude: 0, longitude: 0 },
      { name: "invalid", latitude: Number.NaN, longitude: 0 },
    ];
    expect(nearestEventLocations(tied, { latitude: 0, longitude: 0 }).map(({ name }) => name))
      .toEqual(["first", "second", "invalid"]);
  });
});
