import {
  approximateDistanceMetersBetween,
  distanceBetweenMeters,
  formatApproximateDistance,
} from "../hangoutDiscovery";

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

  it("rounds a distance passed to Hangout Details to the nearest 100 meters", () => {
    expect(
      approximateDistanceMetersBetween(
        { latitude: 13.7563, longitude: 100.5018 },
        { latitude: 13.7653, longitude: 100.5018 },
      ),
    ).toBe(1_000);
  });

  it("formats a localized approximate distance in meters or kilometers", () => {
    expect(formatApproximateDistance(1_478, "en")).toBe("~1.5 km");
    expect(formatApproximateDistance(428, "en")).toBe("~400 m");
    expect(formatApproximateDistance(Number.NaN, "en")).toBeNull();
  });
});
