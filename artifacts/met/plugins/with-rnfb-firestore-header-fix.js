const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Patches every `@react-native-firebase/<pod>@24.x` iOS header (excluding the
 * `app` pod itself) so they compile under `use_frameworks! :linkage => :static`
 * + Expo SDK 54 New Architecture.
 *
 * Despite the historical filename ("firestore-header-fix"), this plugin is
 * intentionally generic — it scans every installed RNFB pod EXCEPT `app`.
 * RNFBApp must be skipped because it is the *source* of the submodule headers
 * (`RNFBAppModule.h`, `RCTConvert+FIRApp.h`) we redirect through.
 *
 * The fix is additive, not destructive: for every header that imports
 * `<React/RCTBridgeModule.h>` or `<React/RCTConvert.h>` we PREPEND a matching
 * `<RNFBApp/...>` import on the line above. Clang sees the RNFBApp submodule
 * loaded first (which satisfies the "must be imported from module
 * 'RNFBApp.RNFBAppModule' before required" diagnostic) and the original React
 * import remains in place so the .m translation units still get the
 * `RCT_EXPORT_MODULE` / `RCT_EXTERN` / `RCT_EXPORT_METHOD` macros they need
 * to compile. An earlier iteration tried REPLACING the React import — that
 * broke compilation because `RNFBAppModule.h` only declares the
 * `<RCTBridgeModule>` protocol, not the macro family.
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

// Each patch prepends an `<RNFBApp/...>` import on the line ABOVE a matching
// `<React/...>` import. The original React import stays — only the new line
// is added. Each patch carries an `idempotencyMarker` so re-running the
// plugin does not stack duplicate prepended lines.
const HEADER_PATCHES = [
  {
    from: /^([ \t]*)#import <React\/RCTBridgeModule\.h>\s*$/m,
    insert: "#import <RNFBApp/RNFBAppModule.h>",
    // Sequence we look for to detect "already patched". The newline matters
    // because we only add the prepended import directly above the React one.
    idempotencyMarker:
      "#import <RNFBApp/RNFBAppModule.h>\n#import <React/RCTBridgeModule.h>",
  },
  {
    from: /^([ \t]*)#import <React\/RCTConvert\.h>\s*$/m,
    insert: "#import <RNFBApp/RCTConvert+FIRApp.h>",
    idempotencyMarker:
      "#import <RNFBApp/RCTConvert+FIRApp.h>\n#import <React/RCTConvert.h>",
  },
];

const TAG = "[with-rnfb-firestore-header-fix]";

// RNFB pods we MUST NOT rewrite. RNFBApp is the source whose submodule headers
// (`RNFBAppModule.h`, `RCTConvert+FIRApp.h`) every other pod will be redirected
// to import; rewriting it would create a circular import.
const SKIP_PACKAGES = new Set(["app"]);

function listRnfbIosDirs(rnfbRootDir) {
  // Given a path like ".../node_modules/@react-native-firebase",
  // return every "<pkg>/ios/<RNFB...>" directory containing .h files,
  // excluding SKIP_PACKAGES.
  const out = [];
  if (!fs.existsSync(rnfbRootDir)) return out;
  let pkgs = [];
  try {
    pkgs = fs.readdirSync(rnfbRootDir);
  } catch {
    return out;
  }
  for (const pkg of pkgs) {
    if (SKIP_PACKAGES.has(pkg)) continue;
    const iosRoot = path.join(rnfbRootDir, pkg, "ios");
    if (!fs.existsSync(iosRoot)) continue;
    let inner = [];
    try {
      inner = fs.readdirSync(iosRoot);
    } catch {
      continue;
    }
    for (const sub of inner) {
      const subDir = path.join(iosRoot, sub);
      // Only directories named like RNFB<Pod> — skip xcodeproj packages.
      if (sub.endsWith(".xcodeproj")) continue;
      if (!fs.statSync(subDir).isDirectory()) continue;
      // Confirm it has at least one .h file before considering it.
      const hasHeader = fs
        .readdirSync(subDir)
        .some((f) => f.endsWith(".h"));
      if (hasHeader) out.push(subDir);
    }
  }
  return out;
}

function findRnfbIosDirs(projectRoot) {
  // Walk up from artifacts/met to find every node_modules tree that
  // contains @react-native-firebase/<pkg>. We can't rely on
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

    // Direct symlink layout: <nm>/@react-native-firebase/<pkg>/...
    const directRoot = path.join(nm, "@react-native-firebase");
    for (const d of listRnfbIosDirs(directRoot)) {
      const real = fs.realpathSync(d);
      if (!found.has(real)) {
        found.add(real);
        console.log(`${TAG}   direct hit: ${d} -> realpath ${real}`);
      }
    }

    // pnpm store layout — scan every @react-native-firebase+<pkg>@<ver> entry.
    const pnpmDir = path.join(nm, ".pnpm");
    if (fs.existsSync(pnpmDir)) {
      let entries = [];
      try {
        entries = fs.readdirSync(pnpmDir);
      } catch (e) {
        console.log(`${TAG}   readdir failed for ${pnpmDir}: ${e.message}`);
        continue;
      }
      for (const e of entries) {
        if (!e.startsWith("@react-native-firebase+")) continue;
        // Skip the `app` package — it's the source we import FROM.
        // Entry names look like "@react-native-firebase+app@24.0.0_..."
        // so we extract the package name between "+" and "@".
        const after = e.substring("@react-native-firebase+".length);
        const at = after.indexOf("@");
        const pkgName = at >= 0 ? after.substring(0, at) : after;
        if (SKIP_PACKAGES.has(pkgName)) continue;

        const innerRoot = path.join(
          pnpmDir,
          e,
          "node_modules",
          "@react-native-firebase",
        );
        for (const d of listRnfbIosDirs(innerRoot)) {
          const real = fs.realpathSync(d);
          if (!found.has(real)) {
            found.add(real);
            console.log(
              `${TAG}   pnpm-store hit: ${d} -> realpath ${real}`,
            );
          }
        }
      }
    }
  }

  return Array.from(found);
}

function patchHeader(absPath) {
  const original = fs.readFileSync(absPath, "utf8");
  let next = original;
  for (const { from, insert, idempotencyMarker } of HEADER_PATCHES) {
    // Skip if this exact pair already exists — keeps the patch idempotent
    // across repeated prebuild invocations and EAS cache hits.
    if (next.includes(idempotencyMarker)) continue;
    next = next.replace(from, (_match, indent) => {
      return `${indent}${insert}\n${indent}${_match.trimStart()}`;
    });
  }
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
      const dirs = findRnfbIosDirs(projectRoot);

      if (dirs.length === 0) {
        // Fail LOUDLY rather than silently skipping. Otherwise EAS produces
        // the same opaque module-headers error as if the plugin never ran.
        throw new Error(
          `${TAG} could not locate any @react-native-firebase/<pod>/ios directory under projectRoot=${projectRoot}. The plugin requires the RNFB packages to be installed before prebuild runs. Check the candidates listed above to debug.`,
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
        const touchedFiles = [];
        for (const h of headers) {
          if (patchHeader(h)) {
            touched += 1;
            touchedFiles.push(path.basename(h));
          }
        }
        totalTouched += touched;
        console.log(
          `${TAG} patched ${touched}/${headers.length} headers in ${dir}` +
            (touched > 0 ? ` -> ${touchedFiles.join(", ")}` : ""),
        );
      }

      console.log(
        `${TAG} TOTAL patched ${totalTouched}/${totalHeaders} headers across ${dirs.length} dir(s)`,
      );
      return cfg;
    },
  ]);
};

module.exports = withRnfbFirestoreHeaderFix;
