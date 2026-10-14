import { describe, expect, it } from "vitest";
import { hasSocialProfile, needsSocialProfile } from "./socialEligibility";

describe("private visitor social access", () => {
  it.each([undefined, null, {}, { displayName: "Visitor" }, { displayName: " ", photoUrl: "https://photo" }, { displayName: "Visitor", photoUrl: "" }])(
    "does not allow incomplete profile %j", (profile) => {
      expect(hasSocialProfile(profile)).toBe(false);
    },
  );
  it("allows completed profiles even when hidden", () => {
    expect(hasSocialProfile({ displayName: "Visitor", photoUrl: "https://photo" })).toBe(true);
  });
  it.each([
    ["POST", "/reveals"], ["POST", "/api/reveals/accept"],
    ["POST", "/chats/notify"], ["GET", "/encounters"],
    ["POST", "/networks/3/join"], ["POST", "/hubs/checkin"],
    ["POST", "/hubs/place/review"], ["POST", "/venue-events/3/rsvp"],
  ])("requires completion for %s %s", (method, path) => {
    expect(needsSocialProfile(method, path)).toBe(true);
  });
  it.each([
    ["POST", "/hubs/qr-verify"], ["GET", "/profiles/me"],
    ["PUT", "/profiles/me"], ["POST", "/profiles/me/photo"],
    ["DELETE", "/profiles/me"], ["POST", "/reports"],
    ["POST", "/connections/remove"], ["POST", "/reveals/decline"],
    ["POST", "/reveals/cancel"], ["DELETE", "/networks/3/members/me"],
    ["GET", "/hubs/place/reviews"], ["GET", "/venue-owner/public/place"],
  ])("preserves private check-in, browsing and safety: %s %s", (method, path) => {
    expect(needsSocialProfile(method, path)).toBe(false);
  });
});
