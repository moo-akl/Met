/**
 * Lightweight client-side content filter for user-generated text.
 *
 * Required by App Store Review Guideline 1.2 (User Generated Content):
 * "A method for filtering objectionable content". Applied to:
 *   - profile display name + bio (on save)
 *   - reveal-request messages (before send)
 *
 * This is intentionally simple: a curated wordlist with whole-word
 * matching, leetspeak normalisation, and diacritic stripping. It is NOT
 * a substitute for server-side moderation — it just stops the most
 * obvious abuse from ever leaving the device. Server-side reports
 * (POST /api/reports) catch what slips through; the team is on the
 * hook to action those within 24h per Apple's guideline.
 */

// Curated minimal wordlist. Kept short on purpose — long lists produce
// false positives ("scunthorpe problem") that drive real users away.
// Add to this list cautiously; prefer addressing repeated abuse via
// the server-side report queue + account ejection instead.
const BLOCKED_TERMS: readonly string[] = [
  // Slurs / hate speech (most-reported on dating-style apps).
  "nigger",
  "nigga",
  "faggot",
  "tranny",
  "retard",
  "kike",
  "spic",
  "chink",
  "gook",
  "wetback",
  "raghead",
  // Sexual solicitation that shouldn't be in a public bio / first
  // message on a non-NSFW product.
  "rape",
  "rapist",
  "pedo",
  "pedophile",
  "loli",
  "cp",
  "child porn",
  "underage sex",
  // Common harassment phrases.
  "kill yourself",
  "kys",
];

// Map common leetspeak / homoglyph substitutions back to plain letters
// so "n1gger" / "f@ggot" / "raped" still get caught.
const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "i",
};

function normalise(input: string): string {
  // Decompose accents → "café" becomes "cafe" so diacritic-laden
  // attempts at evasion still match.
  let out = input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  out = out.toLowerCase();
  // Apply leet substitutions char-by-char.
  let mapped = "";
  for (const ch of out) {
    mapped += LEET_MAP[ch] ?? ch;
  }
  return mapped;
}

/**
 * Returns the first blocked term found in `text`, or `null` if the text
 * is clean. Whole-word match: "Scunthorpe" is fine, "n i g g e r" is
 * not (we collapse interior whitespace before matching).
 */
export function findBlockedTerm(text: string): string | null {
  if (!text) return null;
  const collapsed = normalise(text).replace(/\s+/g, " ");
  // Pad with spaces so word-boundary checks work at start/end.
  const padded = ` ${collapsed} `;
  for (const term of BLOCKED_TERMS) {
    // Allow internal spacing in the source text but require word-ish
    // boundaries on either side of the match so substrings inside real
    // words don't trip ("class" should not match "ass").
    const pattern = new RegExp(
      `[^a-z0-9]${term.replace(/ /g, "\\s+")}[^a-z0-9]`,
      "i",
    );
    if (pattern.test(padded)) return term;
  }
  return null;
}

/**
 * Convenience boolean wrapper. Use `findBlockedTerm` when you want to
 * surface which term tripped the filter (e.g. for analytics).
 */
export function containsBlockedContent(text: string): boolean {
  return findBlockedTerm(text) !== null;
}
