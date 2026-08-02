/**
 * Dashboard lifecycle guard — failure-path safety.
 *
 * The dashboard's guard decision is made by resolveLifecycleRedirect. A
 * transient venue-status fetch failure leaves the hook with
 * `application: null` and `error` set — that must NOT be treated as
 * "no application" (which would misroute the user to setup).
 */
import {
  isVenueOwnerPathAllowed,
  resolveLifecycleRedirect,
} from "@/lib/venueOwnerLifecycle";

const base = {
  authedUid: "uid-1",
  currentDestination: "/venue-owner/dashboard" as const,
};

describe("dashboard lifecycle guard (resolveLifecycleRedirect)", () => {
  it("does NOT redirect to setup when the status fetch failed", () => {
    expect(
      resolveLifecycleRedirect({
        ...base,
        isLoading: false,
        error: "network error",
        application: null,
      }),
    ).toBeNull();
  });

  it("does not redirect while the status is still loading", () => {
    expect(
      resolveLifecycleRedirect({
        ...base,
        isLoading: true,
        error: null,
        application: null,
      }),
    ).toBeNull();
  });

  it("redirects to setup only when the load succeeded with no application", () => {
    expect(
      resolveLifecycleRedirect({
        ...base,
        isLoading: false,
        error: null,
        application: null,
      }),
    ).toBe("/venue-owner/setup");
  });

  it("stays on the dashboard for approved owners", () => {
    expect(
      resolveLifecycleRedirect({
        ...base,
        isLoading: false,
        error: null,
        application: { applicationStatus: "approved", isApproved: true },
      }),
    ).toBeNull();
  });

  it("routes signed-out users to onboarding once loading settles", () => {
    expect(
      resolveLifecycleRedirect({
        ...base,
        authedUid: null,
        isLoading: false,
        error: null,
        application: null,
      }),
    ).toBe("/onboarding?venueOwner=1");
  });

  it("routes rejected applicants to the rejection screen", () => {
    expect(
      resolveLifecycleRedirect({
        ...base,
        isLoading: false,
        error: null,
        application: { applicationStatus: "rejected", isApproved: false },
      }),
    ).toBe("/venue-owner/rejected");
  });

  it("routes pending applicants to the pending screen", () => {
    expect(
      resolveLifecycleRedirect({
        ...base,
        isLoading: false,
        error: null,
        application: { applicationStatus: "under_review", isApproved: false },
      }),
    ).toBe("/venue-owner/pending");
  });

  it("keeps approved owners in the portal handoff only", () => {
    expect(
      isVenueOwnerPathAllowed(
        "/venue-owner/events",
        "/venue-owner/dashboard",
      ),
    ).toBe(false);
    expect(
      isVenueOwnerPathAllowed(
        "/venue-owner/rewards/new",
        "/venue-owner/dashboard",
      ),
    ).toBe(false);
    expect(
      isVenueOwnerPathAllowed(
        "/venue-owner/announcements/new",
        "/venue-owner/dashboard",
      ),
    ).toBe(false);
  });

  it("does not allow applicants to open approved business tools", () => {
    expect(
      isVenueOwnerPathAllowed(
        "/venue-owner/events",
        "/venue-owner/pending",
      ),
    ).toBe(false);
  });

  it("only allows rejected applicants to edit from the explicit reapply route", () => {
    expect(
      isVenueOwnerPathAllowed(
        "/venue-owner/setup",
        "/venue-owner/rejected",
        "true",
      ),
    ).toBe(true);
    expect(
      isVenueOwnerPathAllowed(
        "/venue-owner/setup",
        "/venue-owner/rejected",
      ),
    ).toBe(false);
  });
});
