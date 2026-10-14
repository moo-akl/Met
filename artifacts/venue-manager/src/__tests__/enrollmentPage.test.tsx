import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  enroll: vi.fn(), signIn: vi.fn(), reset: vi.fn(), verify: vi.fn(), sendVerification: vi.fn(),
}));
vi.mock("../lib/firebaseAuth", () => ({
  metPasswordEnroll: mocks.enroll, metPasswordSignIn: mocks.signIn,
  metResetPassword: mocks.reset, metRefreshVerification: mocks.verify,
  metSendVerification: mocks.sendVerification,
  metAuthError: (error: unknown) => (error as Error).message,
  metChangePassword: vi.fn(), metPasswordCreate: vi.fn(), metSignOut: vi.fn(), metSocialSignIn: vi.fn(),
}));
import { EnrollmentPage } from "../App";
describe("returning venue manager enrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/venue-manager/register?token=new-venue-code");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ authenticated: true }) }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  function fill() {
    fireEvent.change(screen.getByTestId("input-enrollment-email"), { target: { value: "returning@example.com" } });
    fireEvent.change(screen.getByTestId("input-enrollment-name"), { target: { value: "Returning Owner" } });
    fireEvent.change(screen.getByTestId("input-enrollment-password"), { target: { value: "CorrectPassword123" } });
    fireEvent.click(screen.getByTestId("input-owner-terms-acceptance"));
  }
  it("completes fresh venue enrollment with an existing verified login and the new code", async () => {
    mocks.enroll.mockResolvedValue({
      created: false, user: { email: "returning@example.com", emailVerified: true, getIdToken: async () => "verified-test-token" },
    });
    render(<EnrollmentPage invitation={false} />); fill();
    fireEvent.click(screen.getByTestId("button-enroll-email"));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith("/api/venue-manager/register/firebase", expect.objectContaining({
      body: JSON.stringify({ token: "new-venue-code", displayName: "Returning Owner", acceptedTermsVersion: "venue-2026-09", idToken: "verified-test-token" }),
    }));
    expect(mocks.sendVerification).not.toHaveBeenCalled();
  });
  it("keeps the new code and entered details, switches to existing sign-in, and offers password reset", async () => {
    mocks.enroll.mockRejectedValue(Object.assign(new Error("Use your existing Met password or reset it to register this venue."), { code: "auth/existing-account-password-required" }));
    mocks.reset.mockResolvedValue(undefined);
    render(<EnrollmentPage invitation={false} />); fill();
    fireEvent.click(screen.getByTestId("button-enroll-email"));
    await screen.findByTestId("button-enrollment-reset-password");
    expect(screen.getByTestId("input-enrollment-token")).toHaveValue("new-venue-code");
    expect(screen.getByTestId("input-enrollment-email")).toHaveValue("returning@example.com");
    expect(screen.getByTestId("input-enrollment-name")).toHaveValue("Returning Owner");
    expect(screen.getByTestId("input-enrollment-password")).toHaveValue("");
    expect(screen.getByTestId("button-enroll-email")).toHaveTextContent("Continue with Met account");
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("button-enrollment-reset-password"));
    await waitFor(() => expect(mocks.reset).toHaveBeenCalledWith("returning@example.com"));
    expect(await screen.findByText(/a reset link is on its way/)).toBeInTheDocument();
  });
});
