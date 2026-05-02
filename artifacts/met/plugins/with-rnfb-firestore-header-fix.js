const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Patches `@react-native-firebase/firestore@24.x` iOS headers so they compile
 * under `use_frameworks! :linkage => :static` + Expo SDK 54 New Architecture.
 *
 * Root cause:
 *   RNFBApp ships as a static framework with a module map that exposes its
 *   headers as Clang submodules (`RNFBApp.RNFBAppModule`,
 *   `RNFBApp.RCTConvert_FIRApp`, etc). RNFBApp's headers transitively include
 *   `<React/RCTBridgeModule.h>` and `<React/RCTConvert.h>`, so once RNFBApp's
 *   module is loaded, those React-Core symbols become "owned" by RNFBApp's
 *   submodules. When the RNFBFirestore headers then `#import` them directly
 *   from `<React/...>`, Clang emits:
 *
 *     declaration of 'RCTBridgeModule' must be imported from module
 *     'RNFBApp.RNFBAppModule' before it is required
 *
 *     declaration of 'RCTConvert' must be imported from module
 *     'RNFBApp.RCTConvert_FIRApp' before it is required
 *
 *   and downstream `expected a type` failures on `RCTPromiseRejectBlock`.
 *
 * Fix:
 *   Replace every `#import <React/...>` line in `ios/RNFBFirestore/*.h`
 *   with the corresponding RNFBApp submodule header that already wraps it:
 *
 *     `#import <React/RCTBridgeModule.h>` → `#import <RNFBApp/RNFBAppModule.h>`
 *     `#import <React/RCTConvert.h>`      → `#import <RNFBApp/RCTConvert+FIRApp.h>`
 *
 *   Those RNFBApp headers DO `#import` the React-Core headers, so we still
 *   get `RCTBridgeModule`, `RCTPromiseRejectBlock`, `RCTConvert`, etc — but
 *   now via the canonical submodule path Clang's modular-headers check
 *   demands (`RNFBApp.RNFBAppModule` and `RNFBApp.RCTConvert_FIRApp`).
 *
 *   Why not `@import RNFBApp;`? The top-level module import does not
 *   transitively re-export the non-modular React-Core symbols its
 *   submodule headers `#import`. Only loading the specific submodule
 *   header (which itself includes the React header) makes the typedefs
 *   visible to downstream translation units.
 *
 *   Idempotent — safe to run multiple times. Logs each file it touches.
 */

const HEADER_PATCHES = [
  {
    from: /^#import <React\/RCTBridgeModule\.h>\s*$/m,
    to: "#import <RNFBApp/RNFBAppModule.h>",
  },
  {
    from: /^#import <React\/RCTConvert\.h>\s*$/m,
    to: "#import <RNFBApp/RCTConvert+FIRApp.h>",
  },
];

const TAG = "[with-rnfb-firestore-header-fix]";

function findFirestoreIosDirs(projectRoot) {
  // Walk up from artifacts/met to find every node_modules tree that
  // contains @react-native-firebase/firestore. We can't rely on
  // `require.resolve` because EAS prebuild runs in an isolated CWD with a
  // pnpm store layout that confuses Node's resolver. We also collect
  // EVERY hit (not just the first) because pnpm + monorepo can install
  // the same package in multiple locations and we need to patch all of them.
  console.log(`${TAG} projectRoot = ${projectRoot}`);

  const nmCandidates = [];
  let dir = projectRoot;
  for (let i = 0; i < 8; i++) {
    nmCandidates.push(path.join(dir, "node_modules"));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  console.log(`${TAG} node_modules candidates checked:`);
  for (const c of nmCandidates) {
    console.log(`${TAG}   - ${c} (exists=${fs.existsSync(c)})`);
  }

  const found = new Set();
  for (const nm of nmCandidates) {
    if (!fs.existsSync(nm)) continue;
    // Direct symlink layout: <nm>/@react-native-firebase/firestore/...
    const direct = path.join(
      nm,
      "@react-native-firebase",
      "firestore",
      "ios",
      "RNFBFirestore",
    );
    if (fs.existsSync(direct)) {
      const real = fs.realpathSync(direct);
      found.add(real);
      console.log(`${TAG}   direct hit: ${direct} -> realpath ${real}`);
    }

    // pnpm store layout — scan every firestore@<version> entry.
    const pnpmDir = path.join(nm, ".pnpm");
    if (fs.existsSync(pnpmDir)) {
      let entries = [];
      try {
        entries = fs.readdirSync(pnpmDir);
      } catch (e) {
        console.log(`${TAG}   readdir failed for ${pnpmDir}: ${e.message}`);
      }
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
        if (fs.existsSync(inner)) {
          const real = fs.realpathSync(inner);
          found.add(real);
          console.log(`${TAG}   pnpm-store hit: ${inner} -> realpath ${real}`);
        }
      }
    }
  }

  return Array.from(found);
}

function patchHeader(absPath) {
  const original = fs.readFileSync(absPath, "utf8");
  let next = original;
  for (const { from, to } of HEADER_PATCHES) {
    next = next.replace(from, to);
  }
  // Collapse duplicate `#import <RNFBApp/RNFBAppModule.h>` lines that
  // appear when a header had multiple React imports rewritten side-by-side.
  // The header has its own `#ifndef`/`#pragma once` guard so duplicates are
  // harmless, but keeping the file tidy makes diff inspection easier on
  // the EAS server.
  next = next.replace(
    /(#import <RNFBApp\/RNFBAppModule\.h>\s*\n)(\s*#import <RNFBApp\/RNFBAppModule\.h>\s*\n)+/g,
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
      const dirs = findFirestoreIosDirs(projectRoot);

      if (dirs.length === 0) {
        // Fail LOUDLY rather than silently skipping. Otherwise EAS produces
        // the same opaque module-headers error as if the plugin never ran.
        throw new Error(
          `${TAG} could not locate any RNFBFirestore ios/ directory under projectRoot=${projectRoot}. The plugin requires @react-native-firebase/firestore to be installed before prebuild runs. Check the candidates listed above to debug.`,
        );
      }

      let totalTouched = 0;
      let totalHeaders = 0;
      for (const dir of dirs) {
        const headers = fs
          .readdirSync(dir)
          .filter((f) => f.endsWith(".h"))
          .map((f) => path.join(dir, f));
        totalHeaders += headers.length;

        let touched = 0;
        for (const h of headers) {
          if (patchHeader(h)) touched += 1;
        }
        totalTouched += touched;
        console.log(
          `${TAG} patched ${touched}/${headers.length} headers in ${dir}`,
        );

        // Print the FIRST line of the now-patched RNFBFirestoreCommon.h so
        // the EAS log proves the rewrite was applied (we will look for
        // "RNFBAppModule" in the import area).
        const sample = path.join(dir, "RNFBFirestoreCommon.h");
        if (fs.existsSync(sample)) {
          const lines = fs.readFileSync(sample, "utf8").split("\n").slice(0, 25);
          console.log(`${TAG} === ${sample} (lines 1-25) ===`);
          for (const l of lines) console.log(`${TAG} | ${l}`);
        }
      }

      console.log(
        `${TAG} TOTAL patched ${totalTouched}/${totalHeaders} headers across ${dirs.length} dir(s)`,
      );
      return cfg;
    },
  ]);
};

module.exports = withRnfbFirestoreHeaderFix;
