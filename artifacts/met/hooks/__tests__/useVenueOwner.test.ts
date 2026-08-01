import {
  getVenueOwnerDestination,
} from "../../lib/venueOwnerLifecycle";
import type { VenueOwnerProfile } from "@/lib/api/client";

const application = (
  status: VenueOwnerProfile["applicationStatus"],
  isApproved = false,
): VenueOwnerProfile =>
  ({
    applicationStatus: status,
    isApproved,
  }) as VenueOwnerProfile;

describe("getVenueOwnerDestination", () => {
  it("sends a new applicant to setup", () => {
    expect(getVenueOwnerDestination(null)).toBe("/venue-owner/setup");
  });

  it.each([
    ["draft", "/venue-owner/setup"],
    ["withdrawn", "/venue-owner/setup"],
    ["expired", "/venue-owner/setup"],
    ["submitted", "/venue-owner/pending"],
    ["under_review", "/venue-owner/pending"],
    ["resubmitted", "/venue-owner/pending"],
    ["rejected", "/venue-owner/rejected"],
    ["changes_requested", "/venue-owner/rejected"],
    ["approved", "/venue-owner/dashboard"],
  ] as const)("routes %s applications safely", (status, destination) => {
    expect(getVenueOwnerDestination(application(status))).toBe(destination);
  });

  it("honours the approved flag for legacy application records", () => {
    expect(getVenueOwnerDestination(application("under_review", true))).toBe(
      "/venue-owner/dashboard",
    );
  });
});