import { afterAll, describe, expect, it, vi } from "vitest";

vi.stubEnv("VENUE_POSTER_FONT_PATH", "/missing/venue-poster-regular.ttf");
vi.stubEnv("VENUE_POSTER_BOLD_FONT_PATH", "/missing/venue-poster-bold.ttf");

const { createVenueManagerUpdatePosterPack } = await import("./venueManagerUpdatePosters.js");

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("createVenueManagerUpdatePosterPack", () => {
  it("creates both poster designs when optional system fonts are unavailable", async () => {
    const pdf = await createVenueManagerUpdatePosterPack([{
      placeName: "Fallback venue",
      qrUrl: "https://met-app.org/v/place-1?t=poster-test-token",
    }]);

    const contents = pdf.toString("latin1");
    expect(contents.startsWith("%PDF-")).toBe(true);
    expect(contents).toContain("%%EOF");
    expect(pdf.byteLength).toBeGreaterThan(5_000);
  });
});
