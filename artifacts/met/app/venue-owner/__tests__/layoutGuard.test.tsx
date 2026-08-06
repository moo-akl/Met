/**
 * Venue Owner layout guard — management-screen protection.
 *
 * The _layout.tsx guard calls resolveLifecycleRedirect with
 * currentDestination: "/venue-owner/dashboard" for every management path.
 * These tests verify the redirect decisions for each non-approved state so
 * that regressions are caught before they reach the App Store.
 */
import {
  resolveLifecycleRedirect,
  isVenueOwnerApplicationStatus,
} from "@/lib/venueOwnerLifecycle";
import type { VenueOwnerProfile } from "@/lib/api/client";

/** Simulates what the layout does for any management path. */
function layoutRedirect(args: {
  isLoading: boolean;
  error: unknown;
  authedUid: string | null | undefined;
  application: Pick<VenueOwnerProfile, "applicationStatus" | "isApproved"> | null;
}) {
  return resolveLifecycleRedirect({
    ...args,
    currentDestination: "/venue-owner/dashboard",
  });
}

/** Convenience: build a typed application fixture. */
function app(
  applicationStatus: string,
  isApproved: boolean,
): Pick<VenueOwnerProfile, "applicationStatus" | "isApproved"> {
  if (!isVenueOwnerApplicationStatus(applicationStatus)) {
    throw new Error(`Unknown applicationStatus: ${applicationStatus}`);
  }
  return { applicationStatus, isApproved };
}

describe("venue-owner layout guard (management screens)", () => {
  it("does not redirect approved owners on management screens", () => {
    expect(
      layoutRedirect({
        isLoading: false,
        error: null,
        authedUid: "uid-1",
        application: app("approved", true),
      }),
    ).toBeNull();
  });

  it("redirects revoked (rejected) owners away from management screens", () => {
    expect(
      layoutRedirect({
        isLoading: false,
        error: null,
        authedUid: "uid-1",
        application: app("rejected", false),
      }),
    ).toBe("/venue-owner/rejected");
  });

  it("redirects owners with changes_requested away from management screens", () => {
    expect(
      layoutRedirect({
        isLoading: false,
        error: null,
        authedUid: "uid-1",
        application: app("changes_requested", false),
      }),
    ).toBe("/venue-owner/rejected");
  });

  it("redirects pending owners (under_review) away from management screens", () => {
    expect(
      layoutRedirect({
        isLoading: false,
        error: null,
        authedUid: "uid-1",
        application: app("under_review", false),
      }),
    ).toBe("/venue-owner/pending");
  });

  it("redirects submitted owners away from management screens", () => {
    expect(
      layoutRedirect({
        isLoading: false,
        error: null,
        authedUid: "uid-1",
        application: app("submitted", false),
      }),
    ).toBe("/venue-owner/pending");
  });

  it("redirects owners with no application to setup", () => {
    expect(
      layoutRedirect({
        isLoading: false,
        error: null,
        authedUid: "uid-1",
        application: null,
      }),
    ).toBe("/venue-owner/setup");
  });

  it("redirects signed-out users to onboarding", () => {
    expect(
      layoutRedirect({
        isLoading: false,
        error: null,
        authedUid: null,
        application: null,
      }),
    ).toBe("/onboarding?venueOwner=1");
  });

  it("does NOT redirect while status is loading (prevents flash redirect)", () => {
    expect(
      layoutRedirect({
        isLoading: true,
        error: null,
        authedUid: "uid-1",
        application: null,
      }),
    ).toBeNull();
  });

  it("does NOT redirect on a status fetch error (failed load ≠ no application)", () => {
    expect(
      layoutRedirect({
        isLoading: false,
        error: "network error",
        authedUid: "uid-1",
        application: null,
      }),
    ).toBeNull();
  });
});
