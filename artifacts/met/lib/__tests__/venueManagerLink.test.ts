import { getVenueManagerUrl } from "../venueManagerLink";

describe("getVenueManagerUrl", () => {
  it("uses the published domain when no build domain is available", () => {
    expect(getVenueManagerUrl(undefined)).toBe("https://met-app.org/venue-manager/");
    expect(getVenueManagerUrl("  ")).toBe("https://met-app.org/venue-manager/");
  });

  it("opens the Venue Manager path on the injected app domain", () => {
    expect(getVenueManagerUrl("met.example.test")).toBe(
      "https://met.example.test/venue-manager/",
    );
    expect(getVenueManagerUrl("https://met.example.test/")).toBe(
      "https://met.example.test/venue-manager/",
    );
  });

});
