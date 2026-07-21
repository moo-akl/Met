#!/usr/bin/env node
/* eslint-disable no-console */
//
// EAS Build post-install hook.
// =============================================================================
//
// PURPOSE
// -------
// 1. TYPECHECK GATE
//    Runs `pnpm run typecheck:libs && pnpm --filter @workspace/met run typecheck`
//    so that TypeScript errors in the Expo app abort the build early — before
//    the expensive Xcode/Gradle native compile steps begin. Exits non-zero on
//    failure so EAS treats the build as failed.
//
// 2. BINARY SYMLINK (belt-and-suspenders)
//    Even though the pre-install hook already ensures `expo` is a workspace-root
//    devDep (so its binary lands at <workspace>/node_modules/.bin/expo after
//    install), if anything has gone wrong with that injection, this hook hunts
//    for the `expo` binary anywhere in the install tree and symlinks it to the
//    workspace root.
//
// We also log loudly (with a sentinel banner) so we can confirm in EAS
// build output whether the hook actually ran.
//
// LOCAL SAFETY
// ------------
// Gated on `EAS_BUILD` / `CI`. Local invocation is a no-op.
// =============================================================================

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const TARGET_BINARIES = ["expo", "eas", "react-native"];

function run(cmd, cwd) {
  console.log(`[eas-post-install] $ ${cmd}  (cwd=${cwd})`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

function findWorkspaceRoot(start) {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `[eas-post-install] Could not locate pnpm-workspace.yaml walking up from ${start}`,
  );
}

// Walk a directory tree (capped depth) looking for a file named `name`
// inside any `node_modules/.bin/` directory. Returns array of absolute paths.
function findBinaryPaths(rootDir, name, maxDepth = 6) {
  const results = [];
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === ".bin") {
          const candidate = path.join(full, name);
          if (fs.existsSync(candidate)) results.push(candidate);
        } else {
          walk(full, depth + 1);
        }
      }
    }
  }
  walk(rootDir, 0);
  return results;
}

function ensureSymlink(src, dest) {
  if (!fs.existsSync(src)) return false;
  try {
    fs.lstatSync(dest);
    console.log(`[eas-post-install] already present: ${dest}`);
    return false;
  } catch {
    /* doesn't exist - proceed */
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const relSrc = path.relative(path.dirname(dest), src);
  fs.symlinkSync(relSrc, dest);
  console.log(`[eas-post-install] linked: ${dest} -> ${relSrc}`);
  return true;
}

function main() {
  console.log("[eas-post-install] ========================================");
  console.log("[eas-post-install] HOOK FIRED");
  console.log("[eas-post-install] ========================================");

  const root = findWorkspaceRoot(__dirname);
  const isEas = !!process.env.EAS_BUILD || process.env.CI === "true";
  console.log(
    `[eas-post-install] Workspace root: ${root}  EAS_BUILD=${
      process.env.EAS_BUILD ?? "(unset)"
    }  CI=${process.env.CI ?? "(unset)"}`,
  );

  if (!isEas) {
    console.log(
      "[eas-post-install] Not running on EAS/CI. Skipping typecheck and symlink work.",
    );
    return;
  }

  // 1. Run TypeScript typecheck so type errors abort the build before the
  //    expensive EAS queue step begins. Build composite libs first so the
  //    Expo app's workspace-lib imports resolve correctly.
  console.log("[eas-post-install] Running typecheck...");
  run("pnpm run typecheck:libs", root);
  run("pnpm --filter @workspace/met run typecheck", root);
  console.log("[eas-post-install] Typecheck passed.");

  const rootBin = path.join(root, "node_modules", ".bin");
  console.log(
    `[eas-post-install] Inspecting workspace root .bin: ${rootBin}  exists=${fs.existsSync(rootBin)}`,
  );

  for (const bin of TARGET_BINARIES) {
    const rootBinPath = path.join(rootBin, bin);
    if (fs.existsSync(rootBinPath)) {
      console.log(
        `[eas-post-install] OK: ${bin} already at workspace root .bin`,
      );
      continue;
    }
    console.log(`[eas-post-install] Hunting for ${bin}...`);
    const found = findBinaryPaths(path.join(root, "node_modules"), bin);
    found.push(...findBinaryPaths(path.join(root, "artifacts"), bin));
    if (found.length === 0) {
      console.warn(`[eas-post-install] WARN: no ${bin} binary found anywhere`);
      continue;
    }
    console.log(
      `[eas-post-install] Found ${found.length} candidates for ${bin}: ${found.join(", ")}`,
    );
    ensureSymlink(found[0], rootBinPath);
  }

  // 3. Apply iOS 26 TurboModule fix directly (patch-package is unreliable in CI,
  //    and pnpm patchedDependencies creates paths with '=' that break Android's
  //    Prefab CLI. We apply the fix by editing the file directly after install.)
  // We walk node_modules/.pnpm/ ourselves - glob is not always available.
  const targets = [];
  const pnpmStore = path.join(root, "node_modules/.pnpm");
  try {
    const entries = fs.readdirSync(pnpmStore);
    for (const entry of entries) {
      if (entry.startsWith("react-native@0.81.5_") && !entry.includes("patch_hash")) {
        const candidate = path.join(
          pnpmStore, entry,
          "node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/ReactCommon/RCTTurboModule.mm"
        );
        if (fs.existsSync(candidate)) {
          targets.push(candidate);
        }
      }
    }
  } catch {
    /* store may not exist in all environments */
  }

  const oldBlock = `    } @catch (NSException *exception) {
      throw convertNSExceptionToJSError(runtime, exception, std::string{moduleName}, methodNameStr);
    } @finally {`;
  const newBlock = `    } @catch (NSException *exception) {
      // PATCH: Do NOT rethrow NSExceptions from void async methods.
      // Void methods return nothing to JS, so rethrowing here causes an
      // uncatchable C++ exception on background queues -> SIGABRT on iOS 26.
      // See: https://github.com/facebook/react-native/issues/54859
      // See: https://github.com/reactwg/react-native-new-architecture/discussions/276
      RCTLogError(@"[TurboModule] Exception in void method %s::%s - %@",
                  moduleName, methodNameStr.c_str(), exception);
    } @finally {`;

  for (const target of targets) {
    let fileContent = fs.readFileSync(target, "utf8");
    if (fileContent.includes(oldBlock)) {
      const i = fileContent.indexOf(oldBlock);
      fileContent = fileContent.slice(0, i) + newBlock + fileContent.slice(i + oldBlock.length);
      fs.writeFileSync(target, fileContent);
      console.log(`[eas-post-install] Applied iOS 26 TurboModule fix to ${target}`);
    } else if (fileContent.includes(newBlock)) {
      console.log(`[eas-post-install] TurboModule fix already applied in ${target}`);
    } else {
      console.warn(`[eas-post-install] Could not find target code block in ${target}`);
    }
  }

  if (targets.length === 0) {
    console.warn("[eas-post-install] RCTTurboModule.mm not found in any pnpm store entry");
  }
  console.log("[eas-post-install] Done.");
}

main();
