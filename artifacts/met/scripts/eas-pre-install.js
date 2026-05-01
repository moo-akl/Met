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
//    Our pnpm-workspace.yaml has a large `overrides:` block that tombstones
//    every non-Linux-x64 native binary (esbuild/rollup/lightningcss/oxide/
//    @expo/ngrok-bin) so Replit doesn't waste bandwidth/disk on darwin and
//    win32 binaries we never run. pnpm 10's frozen install hashes that
//    overrides block and compares it to a hash in the lockfile. Subtle
//    serialization differences between pnpm versions produce different
//    hashes, so the frozen check rejects an otherwise-valid lockfile.
//    FIX: strip the `overrides:` block entirely on the EAS worker. EAS is
//    macOS and actually wants the darwin binaries, so the overrides are
//    pure deadweight there. With no overrides on either side, there's no
//    hash to mismatch.
//
// 2) `Command "expo" not found` during `pnpm expo prebuild`
//    pnpm's default `node-linker=isolated` puts each workspace package's
//    binaries only in that package's local `node_modules/.bin/`. EAS runs
//    `pnpm expo prebuild` from a directory where parent-dir lookup for
//    `expo` fails. The Expo + pnpm monorepo guidance is to use the
//    npm-style flat layout (`node-linker=hoisted`) so every binary lives
//    at the workspace root's `node_modules/.bin/`.
//    FIX: append `node-linker=hoisted` and `shamefully-hoist=true` to the
//    workspace `.npmrc`. (We also set `NPM_CONFIG_*` env vars in eas.json
//    as a fallback, but writing to .npmrc is the most reliable mechanism.)
//
// LOCAL SAFETY
// ------------
// We MUST NOT modify pnpm-workspace.yaml or .npmrc during local
// development — that would force the user to download all the platform
// binaries we're trying to skip on Replit, and would change the local
// node_modules layout in disruptive ways. The hook gates every
// destructive step on EAS-set env vars (`EAS_BUILD` or `CI`), so a local
// invocation is a harmless no-op.
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

function ensureNpmrcSetting(npmrcPath, key, value) {
  let text = fs.existsSync(npmrcPath) ? fs.readFileSync(npmrcPath, "utf8") : "";
  const re = new RegExp(`^${key}\\s*=.*$`, "m");
  if (re.test(text)) {
    text = text.replace(re, `${key}=${value}`);
  } else {
    if (text.length > 0 && !text.endsWith("\n")) text += "\n";
    text += `${key}=${value}\n`;
  }
  fs.writeFileSync(npmrcPath, text, "utf8");
  console.log(`[eas-pre-install] .npmrc: set ${key}=${value}`);
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

  // 2. Force npm-style flat node_modules layout so the `expo` binary lives
  //    at <workspace>/node_modules/.bin/expo where EAS's prebuild step
  //    looks for it.
  const npmrcPath = path.join(root, ".npmrc");
  ensureNpmrcSetting(npmrcPath, "node-linker", "hoisted");
  ensureNpmrcSetting(npmrcPath, "shamefully-hoist", "true");

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

  // 4. Regenerate the lockfile against the now-stripped workspace config.
  run("pnpm install --lockfile-only --no-strict-peer-dependencies", root);

  console.log(
    "[eas-pre-install] Done. EAS frozen install will run with hoisted layout.",
  );
}

main();
