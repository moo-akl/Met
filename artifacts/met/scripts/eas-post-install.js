#!/usr/bin/env node
/* eslint-disable no-console */
//
// EAS Build post-install hook.
// =============================================================================
//
// PURPOSE
// -------
// Belt-and-suspenders safety net: even though the pre-install hook
// already ensures `expo` is a workspace-root devDep (so its binary lands
// at <workspace>/node_modules/.bin/expo after install), if anything has
// gone wrong with that injection, this hook hunts for the `expo` binary
// anywhere in the install tree and symlinks it to the workspace root.
//
// We also log loudly (with a sentinel banner) so we can confirm in EAS
// build output whether the hook actually ran. The previous build's
// pipeline summary did NOT show a "Post-install hook" step, suggesting
// EAS didn't pick up our registration. Loud logs give us proof one way
// or the other.
//
// LOCAL SAFETY
// ------------
// Gated on `EAS_BUILD` / `CI`. Local invocation is a no-op.
// =============================================================================

const fs = require("node:fs");
const path = require("node:path");

const TARGET_BINARIES = ["expo", "eas", "react-native"];

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
      "[eas-post-install] Not running on EAS/CI. Skipping symlink work.",
    );
    return;
  }

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

  console.log("[eas-post-install] Done.");
}

main();
