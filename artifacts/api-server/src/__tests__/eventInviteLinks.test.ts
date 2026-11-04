import { beforeAll, describe, expect, it } from "vitest";

import {
  createEventInviteLinkFields,
  decryptEventInviteToken,
  hashEventInviteToken,
  verifyEventInvitePasscode,
} from "../lib/eventInviteLinks";

beforeAll(() => {
  process.env["SESSION_SECRET"] ??= "test-event-invite-session-secret";
});

describe("event invite link credentials", () => {
  it("stores only a token digest and authenticated ciphertext", () => {
    const fields = createEventInviteLinkFields();
    const token = decryptEventInviteToken(fields.inviteTokenEncrypted);

    expect(token).toMatch(/^[A-Za-z0-9_-]{32,64}$/);
    expect(fields.inviteTokenHash).toBe(hashEventInviteToken(token));
    expect(fields.inviteTokenEncrypted).not.toContain(token);
    expect(fields.invitePasscodeSalt).toBeNull();
    expect(fields.invitePasscodeHash).toBeNull();
  });

  it("hashes optional passcodes and checks them without storing plaintext", () => {
    const fields = createEventInviteLinkFields("secret7");

    expect(fields.invitePasscodeHash).toBeTruthy();
    expect(fields.invitePasscodeHash).not.toBe("secret7");
    expect(
      verifyEventInvitePasscode(
        "secret7",
        fields.invitePasscodeSalt,
        fields.invitePasscodeHash,
      ),
    ).toBe(true);
    expect(
      verifyEventInvitePasscode(
        "incorrect",
        fields.invitePasscodeSalt,
        fields.invitePasscodeHash,
      ),
    ).toBe(false);
  });
});
