export const SUPPORTED_LOCALE_CODES = [
  "en",
  "es",
  "ar",
  "zh",
  "ru",
  "fr",
  "vi",
  "pt",
  "nl",
] as const;

export type SupportedLocaleCode = (typeof SUPPORTED_LOCALE_CODES)[number];
