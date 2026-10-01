import { readFileSync } from "node:fs";
import path from "node:path";
import { I18n } from "i18n-js";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { ar } from "../i18n/locales/ar";
import { zh } from "../i18n/locales/zh";
import { ru } from "../i18n/locales/ru";
import { fr } from "../i18n/locales/fr";
import { vi } from "../i18n/locales/vi";
import { pt } from "../i18n/locales/pt";
import { nl } from "../i18n/locales/nl";

const locales = { en, es, ar, zh, ru, fr, vi, pt, nl };
const keys = new Set(
  ["branches", "dashboard", "setup"].flatMap((screen) => {
    const source = readFileSync(
      path.resolve(__dirname, `../../app/venue-owner/${screen}.tsx`), "utf8",
    );
    return Array.from(source.matchAll(/"((?:settings\.)?venueBranch[^"]+)"/g), (match) => match[1]);
  }),
);

test("branch screens use the settings translation namespace", () => {
  expect(keys.has("settings.venueBranchesTitle")).toBe(true);
  expect(keys.has("settings.venueBranchesAdd")).toBe(true);
  expect(keys.has("settings.venueBranchApplyTitle")).toBe(true);
  for (const key of keys) expect(key.startsWith("settings.")).toBe(true);
});

test.each(Object.keys(locales))("branch labels resolve in %s without raw keys", (locale) => {
  const translations = new I18n(locales, { locale, defaultLocale: "en", enableFallback: true });
  for (const key of keys) {
    const value = translations.t(key, { defaultValue: key, count: 2, applications: 1 });
    expect(value).not.toBe(key);
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
    expect(value).not.toMatch(/\{\{/);
  }
});