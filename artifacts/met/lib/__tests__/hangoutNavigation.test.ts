import { getHangoutOpenPath } from "../hangoutNavigation";

describe("getHangoutOpenPath", () => {
  it("opens the host's Hangout chat", () => {
    expect(getHangoutOpenPath(42, "host-uid", "host-uid", null))
      .toBe("/event-chat/42");
  });

  it("opens the chat for an accepted member", () => {
    expect(getHangoutOpenPath(42, "host-uid", "guest-uid", "accepted"))
      .toBe("/event-chat/42");
  });

  it.each(["pending", "declined", "withdrawn", null])(
    "keeps a %s request on Hangout Details",
    (status) => {
      expect(getHangoutOpenPath(42, "host-uid", "guest-uid", status))
        .toBe("/event-details/member/42");
    },
  );

  it("passes only a rounded approximate distance to Hangout Details", () => {
    expect(getHangoutOpenPath(42, "host-uid", "guest-uid", null, 1_247))
      .toBe("/event-details/member/42?approxDistance=1200");
  });

  it("omits the distance when it is unavailable", () => {
    expect(getHangoutOpenPath(42, "host-uid", "guest-uid", null, null))
      .toBe("/event-details/member/42");
  });
});
