import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { I18n, type TranslateOptions } from "i18n-js";
import { useSyncExternalStore } from "react";
import { I18nManager, Platform } from "react-native";

import { ar } from "./locales/ar";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { nl } from "./locales/nl";
import { pt } from "./locales/pt";
import { ru } from "./locales/ru";
import { vi } from "./locales/vi";
import { zh } from "./locales/zh";

export type LangCode =
  | "en"
  | "es"
  | "ar"
  | "zh"
  | "ru"
  | "fr"
  | "vi"
  | "pt"
  | "nl";

export const SUPPORTED_LANGUAGES: { code: LangCode; label: string; native: string; rtl: boolean }[] =
  [
    { code: "en", label: "English", native: "English", rtl: false },
    { code: "es", label: "Spanish", native: "Español", rtl: false },
    { code: "ar", label: "Arabic", native: "العربية", rtl: true },
    { code: "zh", label: "Chinese", native: "中文", rtl: false },
    { code: "ru", label: "Russian", native: "Русский", rtl: false },
    { code: "fr", label: "French", native: "Français", rtl: false },
    { code: "vi", label: "Vietnamese", native: "Tiếng Việt", rtl: false },
    { code: "pt", label: "Portuguese", native: "Português", rtl: false },
    { code: "nl", label: "Dutch", native: "Nederlands", rtl: false },
  ];

const LANG_KEY = "met:lang:v1";

// We treat `en` as the source of truth shape; the other locales are loaded
// loosely so they can omit keys they don't translate yet — i18n-js falls
// back to the `en` value at runtime via `enableFallback`.
type Locale = typeof en;
export const i18n = new I18n(
  {
    en,
    es: es as unknown as Locale,
    ar: ar as unknown as Locale,
    zh: zh as unknown as Locale,
    ru: ru as unknown as Locale,
    fr: fr as unknown as Locale,
    vi: vi as unknown as Locale,
    pt: pt as unknown as Locale,
    nl: nl as unknown as Locale,
  },
  { defaultLocale: "en", enableFallback: true, locale: "en" },
);

// Detect device locale → return one of our supported codes (fallback: en).
function detectDeviceLang(): LangCode {
  try {
    const locales = Localization.getLocales?.() ?? [];
    for (const l of locales) {
      const code = (l.languageCode ?? "").toLowerCase();
      const match = SUPPORTED_LANGUAGES.find((s) => s.code === code);
      if (match) return match.code;
    }
  } catch {}
  return "en";
}

// Tiny external store so any component can subscribe to language changes
// and re-render. We can't use React Context here because i18n is set up
// before any provider mounts, and we want the t() function to be usable
// from non-React modules too.
const subscribers = new Set<() => void>();
function notify() {
  for (const s of subscribers) s();
}
function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}
let currentLang: LangCode = "en";
function getSnapshot(): LangCode {
  return currentLang;
}

let initialized = false;

export async function initI18n(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    const stored = (await AsyncStorage.getItem(LANG_KEY)) as LangCode | null;
    const lang =
      stored && SUPPORTED_LANGUAGES.some((s) => s.code === stored)
        ? stored
        : detectDeviceLang();
    setLanguageInternal(lang);
  } catch {
    setLanguageInternal("en");
  }
}

function setLanguageInternal(lang: LangCode) {
  currentLang = lang;
  i18n.locale = lang;
  const def = SUPPORTED_LANGUAGES.find((s) => s.code === lang);
  const wantRTL = !!def?.rtl;
  // On native, RTL flip needs a JS reload to fully take effect — we still
  // call it so layouts initialised after this point pick it up. On web,
  // applying dir to the document keeps things in sync without reload.
  try {
    if (I18nManager.isRTL !== wantRTL) {
      I18nManager.allowRTL(wantRTL);
      I18nManager.forceRTL(wantRTL);
    }
  } catch {}
  if (Platform.OS === "web" && typeof document !== "undefined") {
    try {
      document.documentElement.setAttribute("dir", wantRTL ? "rtl" : "ltr");
      document.documentElement.setAttribute("lang", lang);
    } catch {}
  }
  notify();
}

// Public setter — persists choice and reports whether the writing direction
// flipped (RTL ↔ LTR). On native this implies a JS reload is recommended for
// layout to fully take effect; on web the `dir` attribute change is enough,
// but the UI still wants to show a "layout has flipped" notice either way.
export async function setLanguage(
  lang: LangCode,
): Promise<{ rtlChanged: boolean }> {
  const prevRTL =
    SUPPORTED_LANGUAGES.find((s) => s.code === currentLang)?.rtl ?? false;
  const nextRTL =
    SUPPORTED_LANGUAGES.find((s) => s.code === lang)?.rtl ?? false;
  await AsyncStorage.setItem(LANG_KEY, lang);
  setLanguageInternal(lang);
  return { rtlChanged: prevRTL !== nextRTL };
}

export function getLanguage(): LangCode {
  return currentLang;
}

export function isRTL(): boolean {
  return SUPPORTED_LANGUAGES.find((s) => s.code === currentLang)?.rtl ?? false;
}

// Plain string interpolation helper. Pass through to i18n-js with sensible
// defaults; missing key returns the key itself in dev so we can spot gaps.
export function t(key: string, options?: TranslateOptions): string {
  const out = i18n.t(key, { defaultValue: key, ...options });
  return typeof out === "string" ? out : String(out);
}

// React hook — re-renders when language changes.
export function useT(): {
  t: typeof t;
  lang: LangCode;
  rtl: boolean;
} {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    t,
    lang,
    rtl: SUPPORTED_LANGUAGES.find((s) => s.code === lang)?.rtl ?? false,
  };
}
