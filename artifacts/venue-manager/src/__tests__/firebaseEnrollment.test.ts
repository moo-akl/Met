import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(), signIn: vi.fn(),
}));
vi.mock("firebase/app", () => ({ getApps: () => [], initializeApp: () => ({}) }));
vi.mock("firebase/auth", () => ({
  getAuth: () => ({}),
  createUserWithEmailAndPassword: mocks.create,
  signInWithEmailAndPassword: mocks.signIn,
  EmailAuthProvider: {}, GoogleAuthProvider: class {}, OAuthProvider: class {},
  sendEmailVerification: vi.fn(), sendPasswordResetEmail: vi.fn(),
  signInWithPopup: vi.fn(), signOut: vi.fn(), reauthenticateWithCredential: vi.fn(), updatePassword: vi.fn(),
}));
import { metAuthError, metPasswordEnroll } from "../lib/firebaseAuth";

describe("venue re-enrollment with the same Met email", () => {
  const email = "returning-manager@example.com";
  const user = { uid: "shared-met-user", email, emailVerified: true };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ apiKey: "test", authDomain: "test.invalid", projectId: "test" }),
    }));
  });
  it("creates a new Met identity when the email is unused", async () => {
    mocks.create.mockResolvedValue({ user });
    expect(await metPasswordEnroll(email, "password")).toEqual({ user, created: true });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it("proves the existing password and reuses the shared identity after a venue is deleted", async () => {
    mocks.create.mockRejectedValue({ code: "auth/email-already-in-use" });
    mocks.signIn.mockResolvedValue({ user });
    expect(await metPasswordEnroll(email, "password")).toEqual({ user, created: false });
    expect(mocks.signIn).toHaveBeenCalledWith(expect.anything(), email, "password");
  });
  it("requests the existing password instead of blocking the email or granting access", async () => {
    mocks.create.mockRejectedValue({ code: "auth/email-already-in-use" });
    mocks.signIn.mockRejectedValue({ code: "auth/invalid-credential" });
    await expect(metPasswordEnroll(email, "different-password")).rejects.toMatchObject({
      code: "auth/existing-account-password-required",
    });
    expect(metAuthError({ code: "auth/existing-account-password-required" })).toContain("reset your password");
  });
  it("does not retry unrelated creation errors as sign-in", async () => {
    mocks.create.mockRejectedValue({ code: "auth/too-many-requests" });
    await expect(metPasswordEnroll(email, "password")).rejects.toMatchObject({ code: "auth/too-many-requests" });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it("preserves rate-limit failures during fallback sign-in", async () => {
    mocks.create.mockRejectedValue({ code: "auth/email-already-in-use" });
    mocks.signIn.mockRejectedValue({ code: "auth/too-many-requests" });
    await expect(metPasswordEnroll(email, "password")).rejects.toMatchObject({ code: "auth/too-many-requests" });
  });
});
