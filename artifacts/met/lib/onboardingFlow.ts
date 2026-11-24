export type OnboardingAuthOrigin =
  | "language"
  | "valueTour"
  | "intro"
  | "router";

export type OnboardingAuthBackTarget =
  | "language"
  | "valueTour"
  | "intro"
  | "router";

export function shouldDeferLanguagePicker(
  isLanguagePhase: boolean,
  isCheckingSession: boolean,
): boolean {
  return isLanguagePhase && isCheckingSession;
}

export function isValidAuthEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email.trim());
}

export function getOnboardingAuthBackTarget(
  origin: OnboardingAuthOrigin,
  isQrEntry: boolean,
): OnboardingAuthBackTarget {
  return isQrEntry ? "router" : origin;
}
