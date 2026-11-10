import { describe, expect, it } from "vitest";
import {
  buildVerifiedExplorerStatus,
  VERIFIED_EXPLORER_REQUIREMENTS,
} from "./verifiedExplorer";

describe("Verified Explorer eligibility", () => {
  it("unlocks only when every visible requirement is met", () => {
    expect(buildVerifiedExplorerStatus({
      distinctVenues: VERIFIED_EXPLORER_REQUIREMENTS.distinctVenues,
      positiveMeetingReviews: VERIFIED_EXPLORER_REQUIREMENTS.positiveMeetingReviews,
    }).isVerifiedExplorer).toBe(true);
  });

  it.each([
    { distinctVenues: 4, positiveMeetingReviews: 10 },
    { distinctVenues: 5, positiveMeetingReviews: 9 },
  ])("keeps the tier locked when a requirement is short: %o", (counts) => {
    expect(buildVerifiedExplorerStatus(counts).isVerifiedExplorer).toBe(false);
  });
});
