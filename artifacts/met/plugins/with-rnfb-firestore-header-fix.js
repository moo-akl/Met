const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Patches `@react-native-firebase/firestore@24.x` iOS headers so they compile
 * under `use_frameworks! :linkage => :static` + Expo SDK 54 New Architecture.
 *
 * Root cause:
 *   RNFBApp's umbrella (RNFBSharedUtils.h) imports `<React/RCTBridgeModule.h>`,
 *   so once RNFBApp is built as a static framework with a module map, the
 *   `RCTBridgeModule` symbol is owned by `RNFBApp.RNFBAppModule`. When the
 *   RNFBFirestore headers then `#import <React/RCTBridgeModule.h>` directly,
 *   Clang emits:
 *
 *     declaration of 'RCTBridgeModule' must be imported from module
 *     'RNFBApp.RNFBAppModule' before it is required
 *
 *   and downstream `expected a type` failures on `RCTPromiseRejectBlock`.
 *
 * Fix:
 *   Rewrite every `#import <React/RCTBridgeModule.h>` (and `<React/RCTConvert.h>`)
 *   in `ios/RNFBFirestore/*.h` to `#import <RNFBApp/RNFBSharedUtils.h>`. That
 *   header re-exports the same symbols via the RNFBApp module path, satisfying
 *   the modular-headers requirement.
 *
 *   Idempotent — safe to run multiple times. Logs each file it touches.
 */

const HEADER_PATCHES = [
  {
    from: /^#import <React\/RCTBridgeModule\.h>\s*$/m,
    to: "#import <RNFBApp/RNFBSharedUtils.h>",
  },
  {
    from: /^#import <React\/RCTConvert\.h>\s*$/m,
    to: "#import <RNFBApp/RNFBSharedUtils.h>",
  },
];

function findFirestoreIosDir(projectRoot) {
  // Walk up from artifacts/met to find a node_modules that resolves
  // @react-native-firebase/firestore. We can't rely on `require.resolve`
  // because EAS prebuild runs in an isolated CWD.
  const candidates = [];
  let dir = projectRoot;
  for (let i = 0; i < 6; i++) {
    candidates.push(path.join(dir, "node_modules"));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  for (const nm of candidates) {
    if (!fs.existsSync(nm)) continue;
    // Direct symlink layout (pnpm hoists the leaf into <pkg>/node_modules/<name>).
    const direct = path.join(
      nm,
      "@react-native-firebase",
      "firestore",
      "ios",
      "RNFBFirestore",
    );
    if (fs.existsSync(direct)) return direct;

    // pnpm store layout — find the firestore@24.x.y directory.
    const pnpmDir = path.join(nm, ".pnpm");
    if (fs.existsSync(pnpmDir)) {
      const entries = fs.readdirSync(pnpmDir);
      for (const e of entries) {
        if (!e.startsWith("@react-native-firebase+firestore@")) continue;
        const inner = path.join(
          pnpmDir,
          e,
          "node_modules",
          "@react-native-firebase",
          "firestore",
          "ios",
          "RNFBFirestore",
        );
        if (fs.existsSync(inner)) return inner;
      }
    }
  }
  return null;
}

function patchHeader(absPath) {
  const original = fs.readFileSync(absPath, "utf8");
  let next = original;
  for (const { from, to } of HEADER_PATCHES) {
    next = next.replace(from, to);
  }
  // Collapse the case where a file used to have BOTH the React import and
  // the RNFBSharedUtils import — after rewriting the React line, we'd have
  // the RNFBSharedUtils import twice in a row. Dedupe consecutive identical
  // import lines.
  next = next.replace(
    /(#import <RNFBApp\/RNFBSharedUtils\.h>\s*\n)(\s*#import <RNFBApp\/RNFBSharedUtils\.h>\s*\n)+/g,
    "$1",
  );
  if (next !== original) {
    fs.writeFileSync(absPath, next);
    return true;
  }
  return false;
}

const withRnfbFirestoreHeaderFix = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const dir = findFirestoreIosDir(projectRoot);
      if (!dir) {
        console.warn(
          "[with-rnfb-firestore-header-fix] could not locate RNFBFirestore ios/ directory; skipping (build may fail with module-map errors).",
        );
        return cfg;
      }

      const headers = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".h"))
        .map((f) => path.join(dir, f));

      let touched = 0;
      for (const h of headers) {
        if (patchHeader(h)) touched += 1;
      }
      console.log(
        `[with-rnfb-firestore-header-fix] patched ${touched}/${headers.length} headers in ${dir}`,
      );
      return cfg;
    },
  ]);
};

module.exports = withRnfbFirestoreHeaderFix;
