import { runGoogleSignIn } from "@/lib/onboardingGoogleAuth";

describe("onboarding Google sign-in outcomes", () => {
  it("silently restores the sign-in controls when the Google sheet is cancelled", async () => {
    const setBusy = jest.fn();
    const onSuccess = jest.fn().mockResolvedValue(undefined);
    const onError = jest.fn();

    await runGoogleSignIn({
      signIn: jest.fn().mockResolvedValue(null),
      setBusy,
      onSuccess,
      onError,
    });

    expect(setBusy.mock.calls).toEqual([[true], [false]]);
    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows the existing error state and restores controls after authentication fails", async () => {
    const setBusy = jest.fn();
    const onSuccess = jest.fn().mockResolvedValue(undefined);
    const onError = jest.fn();

    await runGoogleSignIn({
      signIn: jest.fn().mockRejectedValue(new Error("Google auth failed")),
      setBusy,
      onSuccess,
      onError,
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(setBusy.mock.calls).toEqual([[true], [false]]);
    expect(onSuccess).not.toHaveBeenCalled();
  });
});