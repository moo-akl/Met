import {
  getOnboardingAuthBackTarget,
  isValidAuthEmail,
  shouldDeferLanguagePicker,
} from "../onboardingFlow";

describe("onboarding auth flow", () => {
  it.each([
    ["language", "language"],
    ["valueTour", "valueTour"],
    ["intro", "intro"],
  ] as const)("returns to the actual %s entry route", (origin, expected) => {
    expect(getOnboardingAuthBackTarget(origin, false)).toBe(expected);
  });

  it("returns to navigation history for a QR-first auth entry", () => {
    expect(getOnboardingAuthBackTarget("router", false)).toBe("router");
    expect(getOnboardingAuthBackTarget("language", true)).toBe("router");
  });

  it("defers the language picker only while checking a returning session", () => {
    expect(shouldDeferLanguagePicker(true, true)).toBe(true);
    expect(shouldDeferLanguagePicker(true, false)).toBe(false);
    expect(shouldDeferLanguagePicker(false, true)).toBe(false);
  });

  it.each([
    ["person@example.com", true],
    [" person@example.co ", true],
    ["person@", false],
    ["@example.com", false],
    ["", false],
  ])("validates email input %j", (email, expected) => {
    expect(isValidAuthEmail(email)).toBe(expected);
  });
});

