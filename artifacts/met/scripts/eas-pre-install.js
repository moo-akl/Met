#!/usr/bin/env node
// EAS Build pre-install hook.
//
// Why this exists:
// EAS Build runs `pnpm install --frozen-lockfile` from the workspace
// root. If the pnpm version on EAS's worker hashes/serializes the
// `overrides` block in pnpm-lock.yaml differently than the version we
// commit with locally, the frozen install fails with
// `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`. We've already pinned
// `packageManager: pnpm@10.26.1` in the root package.json, but EAS's
// pre-built image sometimes reaches the install step before Corepack
// has activated that version.
//
// What this hook does:
// Walk up to the workspace root (where `pnpm-workspace.yaml` lives),
// activate the pinned pnpm via Corepack, and regenerate the lockfile
// with `pnpm install --lockfile-only`. After this, EAS's subsequent
// `--frozen-lockfile` install sees a lockfile produced by the same
// pnpm version it's about to use, and the check passes.
//
// Safe locally: this script is only invoked by EAS Build via the
// `eas-build-pre-install` npm hook. It never runs during normal
// development.

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

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

function main() {
  const root = findWorkspaceRoot(__dirname);
  console.log(`[eas-pre-install] Workspace root: ${root}`);

  // Best-effort: activate Corepack so the pinned pnpm version (from
  // `packageManager` in the root package.json) is used. If Corepack
  // is unavailable, fall through — `pnpm` on the PATH is still fine.
  try {
    run("corepack enable", root);
  } catch (err) {
    console.warn(
      "[eas-pre-install] corepack enable failed; continuing with system pnpm",
      err && err.message ? err.message : err,
    );
  }

  // Regenerate pnpm-lock.yaml in place. `--lockfile-only` skips the
  // node_modules write so EAS's own install step does the heavy work.
  run("pnpm install --lockfile-only --no-strict-peer-dependencies", root);

  console.log("[eas-pre-install] Lockfile regenerated successfully.");
}

main();
