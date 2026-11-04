import { describe, expect, it } from "vitest";
import {
  normalizeVenueDraftName,
  isExpectedVenueRegistrationDraftPdf,
  venueDraftNameMatchesBusinessName,
  venueNameFromDraftPdf,
  VENUE_REGISTRATION_DRAFT_TARGETS,
} from "./venueRegistrationDraftTargets.js";

describe("venue registration draft target files", () => {
  it("contains exactly the 12 approved venue introduction PDFs, excluding Times Square", () => {
    expect(VENUE_REGISTRATION_DRAFT_TARGETS).toHaveLength(12);
    expect(VENUE_REGISTRATION_DRAFT_TARGETS.some((name) => /times.square/i.test(name))).toBe(false);
    expect(new Set(VENUE_REGISTRATION_DRAFT_TARGETS).size).toBe(12);
  });

  it("matches punctuation differences without changing the selected venue", () => {
    const oldVietsPdf = "Met - Old-Viet-s-Restaurant - Venue Introduction.pdf";
    const sunsetPdf = "Met - Sunset-Beach-Bar-Restaurant - Venue Introduction.pdf";

    expect(normalizeVenueDraftName(venueNameFromDraftPdf(oldVietsPdf)))
      .toBe(normalizeVenueDraftName("Old Viet's Restaurant"));
    expect(normalizeVenueDraftName(venueNameFromDraftPdf(sunsetPdf)))
      .toBe(normalizeVenueDraftName("Sunset Beach Bar & Restaurant"));
  });

  it("matches all 12 approved business names to their exact PDFs", () => {
    const approvedPairs = [
      ["Met - Bestiari - Venue Introduction.pdf", "Bestiari"],
      ["Met - Chequers-British-Pub - Venue Introduction.pdf", "Chequers British Pub"],
      ["Met - Coffee-By-Chance - Venue Introduction.pdf", "Coffee By Chance"],
      ["Met - Do-You-Ever-Social-Club - Venue Introduction.pdf", "Do You Ever Social Club"],
      ["Met - Garnish-Samui - Venue Introduction.pdf", "Garnish.Samui"],
      ["Met - Hanoi-Coffee-Station - Venue Introduction.pdf", "Hanoi Coffee Station & Restaurant"],
      ["Met - Hub-Social-Barcelona - Venue Introduction.pdf", "Hub Social Barcelona"],
      ["Met - Le-Maquis-Club - Venue Introduction.pdf", "Le Maquis Club | Speakeasy Bar"],
      ["Met - Lot-TwentyTwo - Venue Introduction.pdf", "Lot.TwentyTwo"],
      ["Met - Old-Viet-s-Restaurant - Venue Introduction.pdf", "Old Viet's Restaurant"],
      ["Met - Roselle - Venue Introduction.pdf", "Roselle"],
      ["Met - Sunset-Beach-Bar-Restaurant - Venue Introduction.pdf", "Sunset Beach Bar & Restaurant"],
    ] as const;

    for (const [filename, businessName] of approvedPairs) {
      expect(VENUE_REGISTRATION_DRAFT_TARGETS).toContain(filename);
      expect(venueDraftNameMatchesBusinessName(filename, businessName)).toBe(true);
    }

    expect(venueDraftNameMatchesBusinessName(
      "Met - Hanoi-Coffee-Station - Venue Introduction.pdf",
      "Hanoi Train Street",
    )).toBe(false);
  });

  it("rejects a PDF whose bytes do not match the approved venue attachment", () => {
    expect(isExpectedVenueRegistrationDraftPdf(
      "Met - Bestiari - Venue Introduction.pdf",
      Buffer.from("%PDF-1.7\nwrong venue"),
    )).toBe(false);
  });
});
