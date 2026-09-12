import fs from "node:fs";
import path from "node:path";

const onboardingSource = fs.readFileSync(
  path.join(__dirname, "..", "onboarding.tsx"),
  "utf8",
);

const appleButtonMatch = onboardingSource.match(
  /<AppleAuthenticationButton\b([\s\S]*?)\/>/,
);

describe("iOS onboarding Apple sign-in button", () => {
  it("uses the official Apple button with Apple-defined configuration", () => {
    expect(onboardingSource).toMatch(
      /import\s*\{[\s\S]*AppleAuthenticationButton[\s\S]*AppleAuthenticationButtonStyle[\s\S]*AppleAuthenticationButtonType[\s\S]*\}\s*from\s*"expo-apple-authentication"/,
    );
    expect(onboardingSource).toMatch(
      /Platform\.OS\s*===\s*"ios"\s*\?\s*\([\s\S]*<AppleAuthenticationButton\b/,
    );
    expect(appleButtonMatch).not.toBeNull();

    const appleButtonProps = appleButtonMatch?.[1] ?? "";
    expect(appleButtonProps).toContain(
      "buttonType={AppleAuthenticationButtonType.SIGN_IN}",
    );
    expect(appleButtonProps).toContain(
      "buttonStyle={AppleAuthenticationButtonStyle.BLACK}",
    );
  });

  it("keeps the native button wired to the existing Apple auth handler", () => {
    expect(onboardingSource).toMatch(
      /const handleApple = async \(\) => \{[\s\S]*await signInWithApple\(\)/,
    );

    const appleButtonProps = appleButtonMatch?.[1] ?? "";
    expect(appleButtonProps).toContain("onPress={handleApple}");
  });

  it("does not replace Apple sign-in with a generic Pressable", () => {
    expect(onboardingSource).not.toMatch(
      /<Pressable\b[\s\S]{0,500}onPress=\{handleApple\}/,
    );
  });
});