import { distanceBetweenMeters } from "../hangoutDiscovery";

describe("hangout distance", () => {
  it("measures the distance between the user's location and a hangout", () => {
    const distance = distanceBetweenMeters(
      { latitude: 13.7563, longitude: 100.5018 },
      { latitude: 13.7653, longitude: 100.5018 },
    );

    expect(distance).toBeGreaterThan(990);
    expect(distance).toBeLessThan(1_020);
  });

  it("returns zero for matching coordinates", () => {
    const coordinates = { latitude: 13.7563, longitude: 100.5018 };

    expect(distanceBetweenMeters(coordinates, coordinates)).toBe(0);
  });
});
