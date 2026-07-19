/**
 * Unit tests for the gold-marker subscription gate in HeatmapMap.
 *
 * `resolveIsPartner` is the pure helper that drives the isVerifiedPartner prop
 * on PulsingMarker — it must return true ONLY when isActiveSubscription is
 * explicitly true.  These tests run without any native-module mocks because the
 * helper has no React Native dependencies.
 */

import { resolveIsPartner } from "@/lib/hubPartner";

describe("resolveIsPartner — gold-marker subscription gate", () => {
  it("returns true when isActiveSubscription is true", () => {
    expect(resolveIsPartner({ isActiveSubscription: true })).toBe(true);
  });

  it("returns false when isActiveSubscription is false (lapsed subscription — no gold marker)", () => {
    expect(resolveIsPartner({ isActiveSubscription: false })).toBe(false);
  });

  it("returns false when businessProfile is null (no profile attached)", () => {
    expect(resolveIsPartner(null)).toBe(false);
  });

  it("returns false when businessProfile is undefined", () => {
    expect(resolveIsPartner(undefined)).toBe(false);
  });
});
