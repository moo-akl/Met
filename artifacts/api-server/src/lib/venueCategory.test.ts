import { describe, expect, it, vi, afterEach } from "vitest";
import { lookupGoogleVenueType, normalizeGoogleVenueType } from "./venueCategory";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("venue categories", () => {
  it.each([
    ["italian_restaurant", "restaurant"], ["coffee_shop", "cafe"],
    ["night_club", "bar"], ["shopping_mall", "shopping"], ["national_park", "outdoors"],
    ["art_gallery", "culture"], ["gym", "fitness"], ["library", "education"],
    ["train_station", "transit"], ["hotel", "lodging"], ["unknown_future_type", "other"],
    ["barber_shop", "other"], ["police_station", "other"],
  ])("maps %s to %s", (type, expected) => {
    expect(normalizeGoogleVenueType(type)).toBe(expected);
  });
  it("uses other for absent Google categories", () => expect(normalizeGoogleVenueType()).toBe("other"));
  it("deduplicates Google lookups and caches failed responses", async () => {
    vi.stubEnv("GOOGLE_API_KEY", "test-key");
    const fetch = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetch);
    expect(await Promise.all([lookupGoogleVenueType("test-failure"), lookupGoogleVenueType("test-failure")])).toEqual([null, null]);
    await lookupGoogleVenueType("test-failure");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
