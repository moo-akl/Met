import { describe, expect, it, vi } from "vitest";
import {
  buildOpenStreetMapAttractionQuery,
  CURATED_OSM_ATTRACTIONS,
  discoverOpenStreetMapAttractions,
  fetchOpenStreetMapAttractions,
  OPENSTREETMAP_OVERPASS_URL,
  parseOpenStreetMapAttractions,
} from "./openStreetMapAttractions.js";

describe("OpenStreetMap attraction import", () => {
  it("builds country-scoped queries from the supported ISO-code allowlist", () => {
    expect(buildOpenStreetMapAttractionQuery("VN")).toContain('ISO3166-1"="VN"');
    expect(buildOpenStreetMapAttractionQuery("MY")).toContain('ISO3166-1"="MY"');
    expect(buildOpenStreetMapAttractionQuery("LA")).toContain('ISO3166-1"="LA"');
    expect(buildOpenStreetMapAttractionQuery("KH")).toContain('ISO3166-1"="KH"');
    expect(buildOpenStreetMapAttractionQuery("VN")).toContain('["tourism"');
    expect(buildOpenStreetMapAttractionQuery("VN")).toContain('["wikidata"]');
    expect(buildOpenStreetMapAttractionQuery("VN")).toContain("out center tags 1000;");
  });

  it("maps notable tourist features into stable Met IDs and removes duplicate locations", () => {
    const attractions = parseOpenStreetMapAttractions({
      elements: [
        {
          type: "node",
          id: 123,
          lat: 10.1234,
          lon: 106.1234,
          tags: { name: "Old Temple", "name:en": "Old Temple", tourism: "attraction", wikidata: "Q1" },
        },
        {
          type: "way",
          id: 456,
          center: { lat: 10.12341, lon: 106.12341 },
          tags: { "name:en": "Old Temple", historic: "temple", wikipedia: "en:Old_Temple" },
        },
        {
          type: "relation",
          id: 789,
          center: { lat: 10.5, lon: 106.5 },
          tags: { name: "National Park", boundary: "national_park", wikidata: "Q2" },
        },
        {
          type: "node",
          id: 999,
          lat: 10.4,
          lon: 106.4,
          tags: { name: "Shop", shop: "gift", wikidata: "Q3" },
        },
        {
          type: "node",
          id: 1000,
          lat: 91,
          lon: 106,
          tags: { name: "Bad coordinates", tourism: "attraction", wikidata: "Q4" },
        },
      ],
    });

    expect(attractions).toHaveLength(2);
    expect(attractions[0]).toMatchObject({
      placeId: "osm-relation-789",
      placeName: "National Park",
      category: "National park or nature reserve",
      sourceUrl: "https://www.openstreetmap.org/relation/789",
    });
    expect(attractions[1]).toMatchObject({
      placeId: "osm-node-123",
      placeName: "Old Temple",
      lat: 10.1234,
      lng: 106.1234,
    });
  });

  it("uses the public Overpass endpoint with a country-limited query and attribution-friendly user agent", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        elements: [{
          type: "node",
          id: 123,
          lat: 10.1,
          lon: 106.1,
          tags: { name: "Example landmark", tourism: "attraction", wikidata: "Q123" },
        }],
      }), { status: 200 }),
    );

    const attractions = await fetchOpenStreetMapAttractions("VN", fetcher);
    const [url, init] = fetcher.mock.calls[0]!;
    const headers = new Headers(init?.headers);

    expect(url).toBe(OPENSTREETMAP_OVERPASS_URL);
    expect(headers.get("user-agent")).toContain("Met Venue Admin");
    expect(new URLSearchParams(String(init?.body)).get("data")).toContain('ISO3166-1"="VN"');
    expect(attractions[0]?.placeId).toBe("osm-node-123");
  });

  it("fails explicitly when Overpass is unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("busy", { status: 429 }),
    );

    await expect(fetchOpenStreetMapAttractions("KH", fetcher))
      .rejects.toThrow("OpenStreetMap Overpass returned HTTP 429");
  });

  it("returns the curated shortlist when Overpass is unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("busy", { status: 429 }));

    const result = await discoverOpenStreetMapAttractions("VN", fetcher);

    expect(result.source).toBe("curated_fallback");
    expect(result.attractions).toEqual(CURATED_OSM_ATTRACTIONS.VN);
    expect(result.attractions).toHaveLength(5);
  });

  it("returns live results when Overpass is available", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        elements: [{
          type: "node",
          id: 321,
          lat: 10.1,
          lon: 106.1,
          tags: { name: "Live landmark", tourism: "attraction", wikidata: "Q321" },
        }],
      }), { status: 200 }),
    );

    const result = await discoverOpenStreetMapAttractions("VN", fetcher);

    expect(result.source).toBe("overpass");
    expect(result.attractions[0]?.placeName).toBe("Live landmark");
  });

  it("keeps every curated entry linked to a valid OpenStreetMap feature", () => {
    for (const attractions of Object.values(CURATED_OSM_ATTRACTIONS)) {
      expect(attractions).toHaveLength(5);
      for (const attraction of attractions) {
        expect(attraction.placeId).toMatch(/^osm-(node|way|relation)-\d+$/);
        expect(attraction.sourceUrl).toMatch(/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/);
        expect(Number.isFinite(attraction.lat)).toBe(true);
        expect(Number.isFinite(attraction.lng)).toBe(true);
      }
    }
  });
});
