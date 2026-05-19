import { describe, it, expect } from "vitest";
import { interestLocales, type InterestKey } from "./index.js";

/**
 * Compile-time exhaustiveness guard.
 *
 * `satisfies readonly InterestKey[]` — every element must be a valid InterestKey
 *   (no extras / typos).
 * `[InterestKey] extends [typeof EXPECTED_KEYS[number]]` — every member of the
 *   InterestKey union must appear in the array (no missing keys).
 *
 * If a new key is added to the InterestKey union but omitted here, TypeScript
 * will fail to compile this file and the CI typecheck will catch it before tests
 * even run.
 */
const EXPECTED_KEYS = [
  "sport", "music", "art", "travel", "food", "gaming", "tech",
  "fitness", "photography", "reading", "film", "nature", "cooking",
  "fashion", "hiking", "yoga", "dancing", "coffee", "dogs", "cats",
  "movies", "cycling", "wine", "volunteering", "podcasts", "wellness",
  "running", "board games",
] as const satisfies readonly InterestKey[];

type _AllKeysPresent = [InterestKey] extends [typeof EXPECTED_KEYS[number]] ? true : never;
const _exhaust: _AllKeysPresent = true;
void _exhaust;

describe("interestLocales completeness", () => {
  const locales = Object.keys(interestLocales);

  it("has at least one locale defined", () => {
    expect(locales.length).toBeGreaterThan(0);
  });

  for (const locale of locales) {
    describe(`locale "${locale}"`, () => {
      const labels = interestLocales[locale];
      const actualKeys = Object.keys(labels) as InterestKey[];

      it("has no missing keys", () => {
        const missing = EXPECTED_KEYS.filter((k) => !(k in labels));
        expect(missing, `Missing keys in "${locale}": ${missing.join(", ")}`).toHaveLength(0);
      });

      it("has no extra keys", () => {
        const extra = actualKeys.filter((k) => !EXPECTED_KEYS.includes(k));
        expect(extra, `Extra keys in "${locale}": ${extra.join(", ")}`).toHaveLength(0);
      });

      it("has no empty translation strings", () => {
        const empty = actualKeys.filter((k) => labels[k].trim() === "");
        expect(empty, `Empty translations in "${locale}": ${empty.join(", ")}`).toHaveLength(0);
      });
    });
  }
});
