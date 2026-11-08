import { isPlanEvent } from "../eventFeedClassification";

describe("isPlanEvent", () => {
  it("classifies invite-only member gatherings as plans", () => {
    expect(isPlanEvent({
      eventType: "member",
      visibility: "invite_only",
      joinApprovalRequired: false,
    })).toBe(true);
  });

  it("keeps public member events in the Events feed", () => {
    expect(isPlanEvent({
      eventType: "member",
      visibility: "public",
      joinApprovalRequired: false,
    })).toBe(false);
  });

  it("classifies public member hangouts that require approval as plans", () => {
    expect(isPlanEvent({
      eventType: "member",
      visibility: "public",
      joinApprovalRequired: true,
    })).toBe(true);
  });

  it("keeps venue events out of personal plans", () => {
    expect(isPlanEvent({
      eventType: "venue",
      visibility: "invite_only",
      joinApprovalRequired: false,
    })).toBe(false);
  });
});
