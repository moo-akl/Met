/**
 * Convention guard: no sheet component may render a bare <View> with a
 * "handle" style reference AND an inline backgroundColor — that is the
 * old pattern that <SheetHandle /> was introduced to replace.
 *
 * Covers two forms of the anti-pattern:
 *
 *   1. Inline style array on a View element:
 *        <View style={[styles.handle, { backgroundColor: someColor }]} />
 *
 *   2. backgroundColor baked into the handle key inside StyleSheet.create:
 *        const styles = StyleSheet.create({
 *          handle: { ..., backgroundColor: someColor },
 *        });
 *        <View style={styles.handle} />
 *
 * When adding a new bottom sheet, use:
 *   import { SheetHandle } from "@/components/SheetHandle";
 *   …
 *   <SheetHandle />                              // default spacing
 *   <SheetHandle style={{ marginBottom: 18 }} /> // custom margin only
 */

import * as fs from "fs";
import * as path from "path";

const COMPONENTS_DIR = path.resolve(__dirname, "../../components");

/**
 * Recursively collect every .ts / .tsx production file under `dir`,
 * skipping __tests__ directories and generated/node_modules trees.
 */
function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Skip test folders and anything that looks generated.
      if (entry.name === "__tests__" || entry.name === "node_modules") {
        continue;
      }
      results.push(...collectSourceFiles(path.join(dir, entry.name)));
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

/**
 * Collapse line-breaks + leading whitespace so multi-line JSX style arrays
 * become a single line, making pattern matching straightforward.
 */
function normalizeWhitespace(src: string): string {
  return src.replace(/\r?\n[ \t]*/g, " ");
}

/**
 * Extract the content of every `style={[...]}` array that belongs to a
 * `<View` opening tag.  Uses bracket-depth tracking so nested arrays
 * (e.g. inside a `transform` prop) don't confuse the boundary detection.
 *
 * Returns an array of strings, one per matched style array (brackets included).
 */
function extractViewStyleArrays(src: string): string[] {
  const results: string[] = [];

  // Match literal `<View` JSX open tags (not import identifiers like `View,`).
  // We limit to 250 chars between the tag open and style= to stay on the same
  // element; if no style= is found in that window we skip to the next tag.
  const tagPattern = /<View\b/g;
  let tagMatch: RegExpExecArray | null;

  while ((tagMatch = tagPattern.exec(src)) !== null) {
    const tagStart = tagMatch.index;
    const lookahead = src.slice(tagStart, tagStart + 250);

    const styleOffset = lookahead.search(/\bstyle=\{\[/);
    if (styleOffset === -1) continue;

    // Position of the `[` that opens the style array.
    const arrayOpen =
      tagStart + styleOffset + lookahead.slice(styleOffset).indexOf("[");

    // Walk from `[` tracking bracket depth to find the matching `]`.
    let depth = 0;
    let arrayClose = -1;
    for (let i = arrayOpen; i < src.length; i++) {
      if (src[i] === "[") depth++;
      else if (src[i] === "]") {
        depth--;
        if (depth === 0) {
          arrayClose = i;
          break;
        }
      }
    }
    if (arrayClose === -1) continue;

    results.push(src.slice(arrayOpen, arrayClose + 1));
  }

  return results;
}

// ---------------------------------------------------------------------------
// Anti-pattern 2: StyleSheet.create({ handle: { …, backgroundColor: … } })
//
// The heuristic: inside a StyleSheet.create block, a key literally named
// "handle" (with word boundaries) contains a backgroundColor property before
// the closing brace of that style object.
// ---------------------------------------------------------------------------
const STYLESHEET_HANDLE_WITH_BG = new RegExp(
  [
    String.raw`StyleSheet\.create\s*\(\s*\{`,
    String.raw`.{0,2000}?\bhandle\b\s*:\s*\{`,
    String.raw`[^}]{0,500}?backgroundColor`,
  ].join(""),
  "s"
);

/** Does the style-array content reference a "handle" style AND contain an
 *  inline backgroundColor value? */
function arrayHasBareHandle(arrayContent: string): boolean {
  return /\bhandle\b/.test(arrayContent) && /backgroundColor/.test(arrayContent);
}

describe("SheetHandle convention", () => {
  // Recursively enumerate all production source files under components/.
  const allFiles = collectSourceFiles(COMPONENTS_DIR);

  // SheetHandle.tsx is the reference implementation; it legitimately uses
  // backgroundColor inside a handle style, so we always skip it.
  const filesToCheck = allFiles.filter(
    (f) => path.basename(f) !== "SheetHandle.tsx"
  );

  test(
    "no component renders a bare <View> with a handle style reference " +
      "and an inline backgroundColor in the same style array",
    () => {
      const violations: string[] = [];

      for (const filePath of filesToCheck) {
        const src = normalizeWhitespace(fs.readFileSync(filePath, "utf-8"));
        const arrays = extractViewStyleArrays(src);

        if (arrays.some(arrayHasBareHandle)) {
          violations.push(path.relative(COMPONENTS_DIR, filePath));
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `These components render a bare <View style={[styles.handle, { backgroundColor: … }]}> ` +
            `instead of <SheetHandle />:\n` +
            violations.map((f) => `  • ${f}`).join("\n") +
            `\n\nFix: import { SheetHandle } from "@/components/SheetHandle" and replace the bare View.`
        );
      }
    }
  );

  test(
    "no component bakes backgroundColor into a 'handle' StyleSheet.create key",
    () => {
      const violations: string[] = [];

      for (const filePath of filesToCheck) {
        const src = normalizeWhitespace(fs.readFileSync(filePath, "utf-8"));

        if (STYLESHEET_HANDLE_WITH_BG.test(src)) {
          violations.push(path.relative(COMPONENTS_DIR, filePath));
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `These components define backgroundColor inside a StyleSheet "handle" key ` +
            `instead of delegating color to <SheetHandle />:\n` +
            violations.map((f) => `  • ${f}`).join("\n") +
            `\n\nFix: remove backgroundColor from the handle style and use <SheetHandle /> instead.`
        );
      }
    }
  );
});
