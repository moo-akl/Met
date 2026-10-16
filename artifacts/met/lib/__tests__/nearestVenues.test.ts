import { nearestVenues } from "../nearestVenues";

describe("nearestVenues", () => {
  const origin = { latitude: 13.75, longitude: 100.5 };
  const venues = [
    { id: "far", lat: 14.75, lng: 100.5 },
    { id: "near", lat: 13.751, lng: 100.5 },
    { id: "middle", lat: 13.76, lng: 100.5 },
  ];

  it("orders nearest first without changing the cached input", () => {
    expect(nearestVenues(venues, origin).map(v => v.id)).toEqual(["near", "middle", "far"]);
    expect(venues.map(v => v.id)).toEqual(["far", "near", "middle"]);
  });

  it("sorts the complete list before the Home limit is applied", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ lat: 14 - i * 0.01, lng: 100.5 }));
    expect(nearestVenues(many, origin).slice(0, 6)[0]).toBe(many[7]);
  });

  it("keeps existing order when permission or location is unavailable", () => {
    expect(nearestVenues(venues, null)).toEqual(venues);
    expect(nearestVenues([], origin)).toEqual([]);
  });

  it("sorts across the date line and puts invalid coordinates last", () => {
    const points = [
      { lat: 0, lng: 170 },
      { lat: 0, lng: -179.9 },
      { lat: NaN, lng: 180 },
    ];
    expect(nearestVenues(points, { latitude: 0, longitude: 179.9 })).toEqual([
      points[1], points[0], points[2],
    ]);
  });
});
