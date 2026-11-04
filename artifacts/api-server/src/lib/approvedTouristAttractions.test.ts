import { describe, expect, it } from "vitest";
import { APPROVED_TOURIST_ATTRACTIONS } from "./approvedTouristAttractions.js";
import { ADDITIONAL_WORLD_TOURIST_ATTRACTIONS } from "./additionalWorldTouristAttractions.js";
import { WORLD_TOURIST_ATTRACTIONS } from "./worldTouristAttractions.js";

describe("approved tourist attraction import data", () => {
  it("contains the approved 20 distinct OpenStreetMap places", () => {
    expect(APPROVED_TOURIST_ATTRACTIONS).toHaveLength(20);
    expect(new Set(APPROVED_TOURIST_ATTRACTIONS.map((item) => item.placeId)).size).toBe(20);
    expect(APPROVED_TOURIST_ATTRACTIONS.map((item) => item.placeId)).toEqual(
      expect.arrayContaining([
        "osm-node-2707025319",
        "osm-node-4611306993",
        "osm-relation-7039289",
        "osm-node-1388480068",
        "osm-way-1362978856",
        "osm-way-279944536",
        "osm-way-1362025121",
        "osm-relation-18435780",
        "osm-way-429428102",
        "osm-way-112477895",
        "osm-node-116056557",
        "osm-way-1347235970",
        "osm-relation-273288",
        "osm-way-1564547716",
        "osm-way-272647001",
        "osm-way-1113380295",
        "osm-way-1221842998",
        "osm-relation-6987298",
        "osm-way-370804236",
        "osm-way-227968458",
      ]),
    );
  });

  it("has researched descriptions and an attributed reuse-licensed photo for each place", () => {
    for (const attraction of APPROVED_TOURIST_ATTRACTIONS) {
      expect(attraction.description.trim().length).toBeGreaterThan(40);
      expect(attraction.tagline.length).toBeLessThanOrEqual(160);
      expect(attraction.informationSourceUrl).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);
      expect(attraction.photo.imageUrl).toMatch(/^https:\/\/(?:thumb|upload)\.wikimedia\.org\//);
      expect(attraction.photo.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(attraction.photo.artist.trim().length).toBeGreaterThan(0);
      expect(attraction.photo.license).toMatch(/^(?:CC BY(?:-SA)? \d(?:\.\d+)?|Public domain)$/);
      if (attraction.photo.license !== "Public domain") {
        expect(attraction.photo.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\/licenses\//);
      }
    }
  });

  it("contains 40 distinct worldwide attractions with source-free public descriptions", () => {
    expect(WORLD_TOURIST_ATTRACTIONS).toHaveLength(40);
    expect(new Set(WORLD_TOURIST_ATTRACTIONS.map((item) => item.placeId)).size).toBe(40);
    expect(new Set(WORLD_TOURIST_ATTRACTIONS.map((item) => item.photo.imageUrl)).size).toBe(40);

    for (const attraction of WORLD_TOURIST_ATTRACTIONS) {
      expect(attraction.placeId).toMatch(/^world-Q\d+$/);
      expect(attraction.lat).toBeGreaterThanOrEqual(-90);
      expect(attraction.lat).toBeLessThanOrEqual(90);
      expect(attraction.lng).toBeGreaterThanOrEqual(-180);
      expect(attraction.lng).toBeLessThanOrEqual(180);
      expect(attraction.websiteUrl == null || attraction.websiteUrl.startsWith("https://")).toBe(true);
      expect(attraction.includeAttributionInDescription).toBe(false);
      expect(attraction.description).not.toMatch(/https?:\/\/|source:|wikimedia|commons|openstreetmap/i);
      expect(attraction.description.trim().length).toBeGreaterThan(35);
      expect(attraction.tagline.length).toBeLessThanOrEqual(160);
      expect(attraction.photo.imageUrl).toMatch(/^https:\/\/thumb\.wikimedia\.org\/wikipedia\/commons\/thumb\//);
      expect(attraction.photo.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(attraction.photo.artist.trim().length).toBeGreaterThan(0);
      expect(attraction.photo.license).toMatch(/^CC BY(?:-SA)? \d(?:\.\d+)?$/);
      expect(attraction.photo.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\/licenses\/(?:by|by-sa)\/\d(?:\.\d+)?\/$/);
    }
  });

  it("contains a separate 40-place worldwide set with reuse-licensed photos", () => {
    expect(ADDITIONAL_WORLD_TOURIST_ATTRACTIONS).toHaveLength(40);
    expect(new Set(ADDITIONAL_WORLD_TOURIST_ATTRACTIONS.map((item) => item.placeId)).size).toBe(40);
    expect(new Set(ADDITIONAL_WORLD_TOURIST_ATTRACTIONS.map((item) => item.photo.imageUrl)).size).toBe(40);
    expect(new Set([
      ...WORLD_TOURIST_ATTRACTIONS.map((item) => item.placeName),
      ...ADDITIONAL_WORLD_TOURIST_ATTRACTIONS.map((item) => item.placeName),
    ]).size).toBe(80);

    for (const attraction of ADDITIONAL_WORLD_TOURIST_ATTRACTIONS) {
      expect(attraction.placeId).toMatch(/^world2-Q\d+$/);
      expect(attraction.lat).toBeGreaterThanOrEqual(-90);
      expect(attraction.lat).toBeLessThanOrEqual(90);
      expect(attraction.lng).toBeGreaterThanOrEqual(-180);
      expect(attraction.lng).toBeLessThanOrEqual(180);
      expect(attraction.websiteUrl == null || attraction.websiteUrl.startsWith("https://")).toBe(true);
      expect(attraction.includeAttributionInDescription).toBe(false);
      expect(attraction.description).not.toMatch(/https?:\/\/|source:|wikimedia|commons|openstreetmap/i);
      expect(attraction.description.trim().length).toBeGreaterThan(35);
      expect(attraction.tagline.length).toBeLessThanOrEqual(160);
      expect(attraction.photo.imageUrl).toMatch(/^https:\/\/(?:thumb|upload)\.wikimedia\.org\//);
      expect(attraction.photo.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(attraction.photo.artist.trim().length).toBeGreaterThan(0);
      expect(attraction.photo.license).toMatch(/^(?:CC BY(?:-SA)? \d(?:\.\d+)?|Public domain)$/);
      if (attraction.photo.license === "Public domain") {
        expect(attraction.photo.licenseUrl).toBeNull();
      } else {
        expect(attraction.photo.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\/licenses\/(?:by|by-sa)\/\d(?:\.\d+)?\/$/);
      }
    }
  });
});
