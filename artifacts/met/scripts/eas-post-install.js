#!/usr/bin/env node
/* eslint-disable no-console */
//
// EAS Build post-install hook.
// =============================================================================
//
// PURPOSE
// -------
// EAS Build runs `pnpm expo prebuild ...` after the install step. Depending
// on which directory EAS launches that command from (workspace root vs the
// artifact dir) and which node_modules layout pnpm chose (isolated vs
// hoisted), the `expo` binary may not be reachable via parent-dir lookup.
//
// This hook is a belt-and-suspenders safety net: it walks each artifact's
// `node_modules/.bin/` and symlinks every Expo-related binary it finds
// into the workspace root's `node_modules/.bin/`. After this runs, `pnpm
// expo prebuild` from the workspace root will always find `expo` at
// `<workspace>/node_modules/.bin/expo`.
//
// Idempotent. Safe to run multiple times. Skips if the source binary
// doesn't exist (e.g. wrong artifact, install failed) or if a symlink
// already exists at the target.
//
// LOCAL SAFETY
// ------------
// Gated on `EAS_BUILD` / `CI` env. Local invocation is a no-op so it
// can't accidentally modify your dev environment's symlinks.
//
// =============================================================================

const fs = require("node:fs");
const path = require("node:path");

// Binaries we want findable at the workspace root.
const EXPO_BINARIES = [
  "expo",
  "expo-cli",
  "expo-modules-autolinking",
  "eas",
  "react-native",
  "metro",
];

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

function listArtifactDirs(root) {
  const artifactsRoot = path.join(root, "artifacts");
  if (!fs.existsSync(artifactsRoot)) return [];
  return fs
    .readdirSync(artifactsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(artifactsRoot, d.name));
}

function ensureSymlink(src, dest) {
  // Skip if source doesn't exist.
  if (!fs.existsSync(src)) return false;

  // Skip if dest already exists (file or symlink — don't clobber).
  try {
    fs.lstatSync(dest);
    console.log(`[eas-post-install] skip (already present): ${dest}`);
    return false;
  } catch {
    // doesn't exist — proceed
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });

  // Use a relative symlink so it survives the moved EAS workdir.
  const relSrc = path.relative(path.dirname(dest), src);
  fs.symlinkSync(relSrc, dest);
  console.log(`[eas-post-install] linked: ${dest} -> ${relSrc}`);
  return true;
}

function main() {
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
  let linked = 0;

  for (const artifactDir of listArtifactDirs(root)) {
    const artifactBin = path.join(artifactDir, "node_modules", ".bin");
    if (!fs.existsSync(artifactBin)) continue;

    for (const bin of EXPO_BINARIES) {
      const src = path.join(artifactBin, bin);
      const dest = path.join(rootBin, bin);
      if (ensureSymlink(src, dest)) linked++;
    }
  }

  console.log(
    `[eas-post-install] Done. Created ${linked} new symlink(s) at ${rootBin}.`,
  );
}

main();
