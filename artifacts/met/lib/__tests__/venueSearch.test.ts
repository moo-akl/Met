/**
 * Regression coverage for malformed Google Places responses.
 *
 * The venue setup screen must receive an array even when an older API
 * deployment or an unexpected response omits `places`.
 */

jest.mock("@react-native-firebase/auth", () => ({
  __esModule: true,
  default: () => ({ currentUser: null }),
}));

describe("venue search API client", () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

  beforeEach(() => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.test";
  });

  afterAll(() => {
    if (originalApiUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    }
  });

  it("normalizes a missing places field to an empty array", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({}),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const { api } = require("../api/client") as typeof import("../api/client");
    await expect(api.searchVenuePlaces({ uid: "test-uid" }, "Blue Parrot")).resolves.toEqual({
      places: [],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/venue-owner/places/search?query=Blue+Parrot",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("preserves a valid places array", async () => {
    const places = [
      {
        placeId: "ChIJ-test",
        placeName: "The Blue Parrot",
        address: "1 Main Street",
        category: "Bar",
        googleMapsUri: null,
        lat: 51.5074,
        lng: -0.1278,
      },
    ];
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ places }),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const { api } = require("../api/client") as typeof import("../api/client");
    await expect(api.searchVenuePlaces({ uid: "test-uid" }, "Blue Parrot")).resolves.toEqual({
      places,
    });
  });
});