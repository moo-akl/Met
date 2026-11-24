import fs from "node:fs";
import path from "node:path";

const onboardingSource = fs.readFileSync(
  path.join(__dirname, "..", "onboarding.tsx"),
  "utf8",
);

describe("onboarding saved-session resume", () => {
  it("holds the initial language picker until saved-session checks finish", () => {
    expect(onboardingSource).toMatch(
      /shouldDeferLanguagePicker\(phase === "language", sessionResumeChecking\)/,
    );
    expect(onboardingSource).toMatch(
      /finally\s*\{[\s\S]*?setSessionResumeChecking\(false\)/,
    );
  });
});
