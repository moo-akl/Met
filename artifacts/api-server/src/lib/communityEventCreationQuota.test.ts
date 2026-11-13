import { describe, expect, it } from "vitest";
import {
  buildCommunityEventCreationUsage,
  getEffectiveMembershipTier,
  getUtcMonthWindow,
} from "./communityEventCreationQuota";

describe("community event creation quota", () => {
  it("uses UTC calendar months and resets at the next month boundary", () => {
    const now = new Date("2026-11-13T18:30:00.000Z");

    expect(getUtcMonthWindow(now)).toEqual({
      start: new Date("2026-11-01T00:00:00.000Z"),
      end: new Date("2026-12-01T00:00:00.000Z"),
    });
  });

  it("applies the Free and Plus monthly caps and leaves Pro unlimited", () => {
    expect(buildCommunityEventCreationUsage(
      "free",
      5,
      new Date("2026-11-13T00:00:00.000Z"),
    )).toMatchObject({ tier: "free", used: 5, limit: 5, remaining: 0 });

    expect(buildCommunityEventCreationUsage(
      "plus",
      8,
      new Date("2026-11-13T00:00:00.000Z"),
    )).toMatchObject({ tier: "plus", used: 8, limit: 20, remaining: 12 });

    expect(buildCommunityEventCreationUsage(
      "pro",
      120,
      new Date("2026-11-13T00:00:00.000Z"),
    )).toMatchObject({ tier: "pro", used: 120, limit: null, remaining: null });
  });

  it("treats inactive and expired subscriptions as Free", () => {
    const now = new Date("2026-11-13T00:00:00.000Z");

    expect(getEffectiveMembershipTier(
      { tier: "plus", status: "inactive", expiryDate: null },
      now,
    )).toBe("free");
    expect(getEffectiveMembershipTier(
      { tier: "pro", status: "active", expiryDate: new Date("2026-11-12T00:00:00.000Z") },
      now,
    )).toBe("free");
    expect(getEffectiveMembershipTier(
      { tier: "plus", status: "active", expiryDate: null },
      now,
    )).toBe("plus");
  });
});
