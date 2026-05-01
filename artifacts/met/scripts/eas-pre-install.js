#!/usr/bin/env node
/* eslint-disable no-console */
//
// EAS Build pre-install hook.
// =============================================================================
//
// PROBLEM
// -------
// When EAS Build runs `pnpm install --frozen-lockfile` against this monorepo,
// it fails with:
//
//     ERR_PNPM_LOCKFILE_CONFIG_MISMATCH
//     The current "overrides" configuration doesn't match the value found
//     in the lockfile.
//
// Root cause: our `pnpm-workspace.yaml` contains a large `overrides:` block
// that tombstones (`'-'`) every non-Linux-x64 native binary for esbuild,
// rollup, lightningcss, tailwindcss/oxide, and @expo/ngrok-bin. This is a
// bandwidth/disk optimisation for Replit (Linux x64 only) — without it,
// pnpm pulls down dozens of darwin/win32/freebsd binaries we never use.
//
// pnpm 10's frozen install hashes the overrides block and compares it to a
// hash stored in the lockfile. Subtle differences in how pnpm versions
// serialise / order the overrides keys produce different hashes, so even
// when the overrides are semantically identical the frozen check fails.
//
// SOLUTION
// --------
// On the EAS worker (which is macOS and DOES want the darwin binaries),
// we don't need the overrides block at all. So this hook:
//
//   1. Strips the entire `overrides:` block from `pnpm-workspace.yaml`.
//   2. Regenerates `pnpm-lock.yaml` with `--lockfile-only`, producing a
//      lockfile with no overrides hash to mismatch.
//
// EAS's subsequent `pnpm install --frozen-lockfile` then sees a workspace
// config and a lockfile that agree (both with no overrides), and proceeds.
//
// LOCAL SAFETY
// ------------
// We MUST NOT mutate `pnpm-workspace.yaml` during local development — that
// would force the user to download all the platform binaries we're trying
// to skip. The hook gates its destructive behaviour on EAS-set env vars
// (`EAS_BUILD` or `CI`), so a local invocation is a harmless no-op.
//
// HOOK DISCOVERY
// --------------
// EAS's documentation on `eas-build-pre-install` is ambiguous for pnpm
// workspaces — it may look in the artifact's package.json (where eas.json
// lives) OR in the workspace root (where pnpm-workspace.yaml lives). We
// register the hook in BOTH `package.json` files and point both at this
// single script, so it runs no matter which one EAS picks up.
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

// Strip the entire `overrides:` block from pnpm-workspace.yaml. The block
// starts with a line `overrides:` and continues until either a non-indented
// line begins a different top-level key, or EOF.
function stripOverridesBlock(yamlText) {
  const lines = yamlText.split("\n");
  const out = [];
  let inOverrides = false;
  for (const line of lines) {
    if (!inOverrides) {
      if (/^overrides\s*:\s*$/.test(line)) {
        inOverrides = true;
        // skip this line entirely
        continue;
      }
      out.push(line);
    } else {
      // We're inside the overrides block. It ends when we hit a line that
      // is non-empty AND not indented (i.e. a new top-level YAML key).
      if (line.length === 0 || /^\s/.test(line)) {
        // still inside the block (blank line or indented child) — skip
        continue;
      }
      // back to a top-level key: stop skipping, emit this line
      inOverrides = false;
      out.push(line);
    }
  }
  return out.join("\n");
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
      "[eas-pre-install] Not running on EAS/CI (no EAS_BUILD or CI env). " +
        "Skipping all destructive steps so local pnpm-workspace.yaml stays intact.",
    );
    return;
  }

  // 1. Strip overrides from pnpm-workspace.yaml on the EAS worker only.
  const wsPath = path.join(root, "pnpm-workspace.yaml");
  const original = fs.readFileSync(wsPath, "utf8");
  const stripped = stripOverridesBlock(original);
  if (stripped !== original) {
    fs.writeFileSync(wsPath, stripped, "utf8");
    console.log(
      "[eas-pre-install] Stripped `overrides:` block from pnpm-workspace.yaml " +
        "(EAS macOS worker downloads native binaries it actually needs).",
    );
  } else {
    console.log(
      "[eas-pre-install] No `overrides:` block found in pnpm-workspace.yaml " +
        "(already clean).",
    );
  }

  // 2. Activate the pinned pnpm version via Corepack so the regenerated
  //    lockfile is produced by the same pnpm EAS will use for the frozen
  //    install. Corepack failures are non-fatal — we fall through to the
  //    pnpm already on PATH.
  try {
    run("corepack enable", root);
  } catch (err) {
    console.warn(
      "[eas-pre-install] corepack enable failed; continuing with system pnpm.",
      err && err.message ? err.message : err,
    );
  }

  // 3. Regenerate pnpm-lock.yaml without modifying node_modules. EAS's own
  //    install step will materialise node_modules right after this returns.
  run("pnpm install --lockfile-only --no-strict-peer-dependencies", root);

  console.log(
    "[eas-pre-install] Lockfile regenerated. EAS's frozen install should now succeed.",
  );
}

main();
