import fs from "node:fs";
import path from "node:path";

const onboardingSource = fs.readFileSync(
  path.join(__dirname, "..", "onboarding.tsx"),
  "utf8",
);

describe("signup inline requirements", () => {
  it("shows localized email guidance beside the email field when invalid", () => {
    expect(onboardingSource).toMatch(
      /testID="onboarding-email-input"[\s\S]*?accessibilityHint=\{[\s\S]*?t\("onboarding\.invalidEmailBody"\)/,
    );
    expect(onboardingSource).toMatch(
      /testID="signup-email-requirement"[\s\S]*?t\("onboarding\.invalidEmailBody"\)/,
    );
    expect(onboardingSource).toMatch(
      /if \(!isValidAuthEmail\(email\)\) \{[\s\S]*?if \(authMode !== "signup"\)[\s\S]*?Alert\.alert/,
    );
  });

  it("keeps the localized minimum-password requirement visible during signup", () => {
    expect(onboardingSource).toMatch(
      /testID="signup-password-requirement"[\s\S]*?t\("onboarding\.passwordMinimum"\)/,
    );
    expect(onboardingSource).toMatch(
      /accessibilityHint=\{[\s\S]*?t\("onboarding\.passwordMinimum"\)/,
    );
  });
});
