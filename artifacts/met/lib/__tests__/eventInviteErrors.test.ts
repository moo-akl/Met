import { classifyEventInviteResolveError } from "../eventInviteErrors";

describe("classifyEventInviteResolveError", () => {
  it("treats a not-found response as an unavailable invitation", () => {
    expect(
      classifyEventInviteResolveError(
        Object.assign(new Error("Invitation not found."), { status: 404 }),
      ),
    ).toBe("unavailable");
  });

  it("keeps incorrect passcodes distinct from unavailable invitations", () => {
    expect(
      classifyEventInviteResolveError(
        Object.assign(new Error("That passcode does not match."), { status: 401 }),
      ),
    ).toBe("wrongPasscode");
  });

  it("keeps network and server failures as load errors", () => {
    expect(classifyEventInviteResolveError(new Error("Network request failed"))).toBe(
      "loadFailure",
    );
    expect(
      classifyEventInviteResolveError(
        Object.assign(new Error("Server error"), { status: 500 }),
      ),
    ).toBe("loadFailure");
  });
});
