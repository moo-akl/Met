#!/usr/bin/env node
/* eslint-disable no-console */
//
// EAS Build pre-install hook.
// =============================================================================
//
// PROBLEMS THIS HOOK FIXES (in order, on the EAS Build worker only)
// -----------------------------------------------------------------
//
// 1) `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`
//    pnpm-workspace.yaml has a large `overrides:` block that tombstones
//    every non-Linux-x64 native binary (esbuild/rollup/lightningcss/oxide/
//    @expo/ngrok-bin) so Replit doesn't waste bandwidth/disk on darwin and
//    win32 binaries we never run. pnpm 10's frozen install hashes the
//    overrides block and compares it to a hash in the lockfile. Subtle
//    serialization differences between pnpm versions produce different
//    hashes, so the frozen check rejects an otherwise-valid lockfile.
//    FIX: strip the entire `overrides:` block on the EAS worker. EAS is
//    macOS and actually wants the darwin binaries, so the overrides are
//    pure deadweight there. With no overrides on either side, there's no
//    hash to mismatch.
//
// 2) `Command "expo" not found` during `pnpm expo prebuild`
//    EAS runs `pnpm expo prebuild --no-install --platform ios` from the
//    workspace root after install. pnpm searches `node_modules/.bin/` of
//    the cwd and parent dirs for `expo`. With pnpm's default isolated
//    layout, `expo` only lands in `artifacts/met/node_modules/.bin/expo`,
//    which is BELOW the cwd, not above it — so the lookup fails. We saw
//    `metro` get found (it's a transitive dep that pnpm hoisted higher),
//    but `expo` (a direct dep declared only in artifacts/met) did not.
//    FIX: inject `expo` into the workspace root package.json's
//    devDependencies on the EAS worker. Then pnpm's frozen install will
//    place `expo`'s binary directly at `<workspace>/node_modules/.bin/
//    expo`, which is exactly where EAS's prebuild step looks. We use the
//    same version specifier that artifacts/met already declares, so the
//    lockfile has only one resolved version and there's no duplication.
//
// LOCAL SAFETY
// ------------
// Every destructive step is gated on EAS-set env vars (`EAS_BUILD` /
// `CI`). A local invocation prints a message and exits cleanly; it never
// touches pnpm-workspace.yaml, the workspace package.json, or .npmrc.
//
// HOOK DISCOVERY
// --------------
// EAS's `eas-build-pre-install` hook lookup for pnpm workspaces is
// undocumented. We register the hook in BOTH the workspace root
// `package.json` AND `artifacts/met/package.json` (both pointing here),
// so it runs no matter which one EAS inspects.
//
// =============================================================================

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// Workspace-root binaries to ensure are present at install time. Keys are
// package names; values are read from artifacts/met/package.json so the
// versions stay in lockstep with what the artifact already declares.
const ENSURE_AT_ROOT = ["expo"];

function findWorkspaceRoot(start) {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `[eas-pre-install] Could not locate pnpm-workspace.yaml walking up from ${start}`,
  );
}

function run(cmd, cwd) {
  console.log(`[eas-pre-install] $ ${cmd}  (cwd=${cwd})`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

// Strip the `overrides:` block from pnpm-workspace.yaml. The block starts
// with a top-level `overrides:` line and continues until either a new
// non-indented top-level key or EOF.
function stripOverridesBlock(yamlText) {
  const lines = yamlText.split("\n");
  const out = [];
  let inOverrides = false;
  for (const line of lines) {
    if (!inOverrides) {
      if (/^overrides\s*:\s*$/.test(line)) {
        inOverrides = true;
        continue;
      }
      out.push(line);
    } else {
      if (line.length === 0 || /^\s/.test(line)) continue;
      inOverrides = false;
      out.push(line);
    }
  }
  return out.join("\n");
}

// Read a dep version from a package.json. Looks in dependencies and
// devDependencies. Returns the version string or null if not found.
function readDepVersion(pkgPath, depName) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  return (
    (pkg.dependencies && pkg.dependencies[depName]) ||
    (pkg.devDependencies && pkg.devDependencies[depName]) ||
    null
  );
}

function injectRootDevDependencies(rootPkgPath, additions) {
  const pkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8"));
  pkg.devDependencies = pkg.devDependencies || {};
  let changed = false;
  for (const [name, version] of Object.entries(additions)) {
    if (pkg.devDependencies[name] !== version) {
      pkg.devDependencies[name] = version;
      changed = true;
      console.log(
        `[eas-pre-install] root package.json: added devDep ${name}@${version}`,
      );
    }
  }
  if (changed) {
    fs.writeFileSync(rootPkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  }
}

function main() {
  const root = findWorkspaceRoot(__dirname);
  const isEas = !!process.env.EAS_BUILD || process.env.CI === "true";
  console.log(
    `[eas-pre-install] Workspace root: ${root}  EAS_BUILD=${
      process.env.EAS_BUILD ?? "(unset)"
    }  CI=${process.env.CI ?? "(unset)"}`,
  );

  if (!isEas) {
    console.log(
      "[eas-pre-install] Not running on EAS/CI. Skipping all destructive steps.",
    );
    return;
  }

  // 1. Strip overrides from pnpm-workspace.yaml.
  const wsPath = path.join(root, "pnpm-workspace.yaml");
  const original = fs.readFileSync(wsPath, "utf8");
  const stripped = stripOverridesBlock(original);
  if (stripped !== original) {
    fs.writeFileSync(wsPath, stripped, "utf8");
    console.log(
      "[eas-pre-install] Stripped `overrides:` block from pnpm-workspace.yaml.",
    );
  }

  // 2. Inject expo (and any other ENSURE_AT_ROOT entries) into workspace
  //    root devDependencies, using whatever version specifier the artifact
  //    already declares. After install, the binary lands at
  //    <workspace>/node_modules/.bin/expo where EAS's prebuild step looks.
  const artifactPkgPath = path.join(root, "artifacts/met/package.json");
  const additions = {};
  for (const dep of ENSURE_AT_ROOT) {
    const version = readDepVersion(artifactPkgPath, dep);
    if (!version) {
      console.warn(
        `[eas-pre-install] Could not find ${dep} in ${artifactPkgPath}; skipping`,
      );
      continue;
    }
    additions[dep] = version;
  }
  injectRootDevDependencies(path.join(root, "package.json"), additions);

  // 3. Activate pinned pnpm via Corepack so the lockfile we regenerate is
  //    produced by the same pnpm EAS will use for the frozen install.
  try {
    run("corepack enable", root);
  } catch (err) {
    console.warn(
      "[eas-pre-install] corepack enable failed; continuing with system pnpm.",
      err && err.message ? err.message : err,
    );
  }

  // 4. Regenerate the lockfile against the modified workspace state.
  run("pnpm install --lockfile-only --no-strict-peer-dependencies", root);

  console.log(
    "[eas-pre-install] Done. EAS frozen install will place expo at workspace root.",
  );
}

main();
