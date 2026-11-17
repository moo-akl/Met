"use strict";

// The pre-install hook runs before node_modules exists. Read only pnpm 9-format
// mapping blocks using Node built-ins; never load app config or print lock data.
const crypto = require("node:crypto");

function section(text, name) {
  if (!/^lockfileVersion: ['"]?9\.0['"]?\s*$/m.test(text)) {
    throw new Error("[native-lock] Unsupported lockfile format; review before building.");
  }
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const start = lines.indexOf(`${name}:`);
  if (start < 0) throw new Error(`[native-lock] Missing ${name} section.`);
  const end = lines.findIndex((line, index) => index > start && /^[^\s#]/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n");
}

function entries(text) {
  const result = new Map();
  let key;
  let lines = [];
  const save = () => {
    if (key !== undefined) {
      if (result.has(key)) throw new Error("[native-lock] Duplicate mapping entry.");
      result.set(key, lines.join("\n").trimEnd());
    }
  };
  for (const line of text.split("\n")) {
    const match = line.match(/^  (\S.*?):(?:[ \t]+\{\})?[ \t]*$/);
    if (match) {
      save();
      key = match[1].replace(/^(['"])(.*)\1$/, "$2");
      lines = [];
    } else if (key !== undefined) {
      lines.push(line);
    }
  }
  save();
  return result;
}

function appImporter(lockfile) {
  const importer = entries(section(lockfile, "importers")).get("artifacts/met");
  if (!importer || !/^\s{4}(?:devDependencies|dependencies):$/m.test(importer)) {
    throw new Error("[native-lock] Missing Met importer dependencies.");
  }
  return importer;
}

function lockedExpoVersion(lockfile) {
  const importer = appImporter(lockfile);
  const match = importer.match(/^ {6}expo:\n {8}specifier: [^\n]+\n {8}version: (\d+\.\d+\.\d+)(?:\([^\n]*\))?\s*$/m);
  if (!match) throw new Error("[native-lock] Cannot determine the locked Expo version.");
  return match[1];
}

function isNativePackage(key) {
  // Platform-only ngrok downloads may legitimately be added for macOS.
  if (/^@expo\/ngrok-bin(?:-|@)/.test(key)) return false;
  return /^(?:expo(?:-[^@]+)?|@expo\/[^@]+|react|react-native(?:-[^@]+)?|@react-native(?:-[^/]+)?\/[^@]+)@/.test(key);
}

function nativeState(lockfile) {
  const packages = [...entries(section(lockfile, "packages"))]
    .filter(([key]) => isNativePackage(key))
    .sort(([a], [b]) => a.localeCompare(b));
  for (const required of ["expo@", "expo-modules-core@", "react@", "react-native@"]) {
    if (!packages.some(([key]) => key.startsWith(required))) {
      throw new Error("[native-lock] Incomplete native dependency baseline.");
    }
  }
  return packages;
}

function dependencySnapshot(value) {
  if (value === undefined) return undefined;
  // Adding Expo as a direct root dependency promotes its already-resolved
  // optional tree to required. This install flag is not a version/edge change.
  return value.split("\n")
    .filter((line) => !/^ {4}optional: (?:true|false)$/.test(line))
    .join("\n").trimEnd();
}

function assertNativeLockUnchanged(before, after) {
  if (appImporter(before) !== appImporter(after)) {
    throw new Error("[native-lock] Met dependency resolution changed on the worker. Stop and review the lockfile.");
  }
  const nativeBefore = nativeState(before);
  const nativeAfter = nativeState(after);
  if (JSON.stringify(nativeBefore) !== JSON.stringify(nativeAfter)) {
    throw new Error("[native-lock] Native package versions or integrity changed on the worker. Stop and review the lockfile.");
  }
  // Peer-context snapshots reachable by the original app must not be rewritten.
  // An additional root Expo snapshot is permitted only for versions already
  // verified above; it must not replace any existing native snapshot.
  const snapshotsAfter = entries(section(after, "snapshots"));
  for (const [key, value] of entries(section(before, "snapshots"))) {
    if (isNativePackage(key) &&
        dependencySnapshot(snapshotsAfter.get(key)) !== dependencySnapshot(value)) {
      throw new Error("[native-lock] An existing native dependency snapshot changed on the worker. Stop and review the lockfile.");
    }
  }
  return {
    expoVersion: lockedExpoVersion(after),
    nativePackageCount: nativeAfter.length,
    fingerprint: crypto.createHash("sha256")
      .update(JSON.stringify({ importer: appImporter(after), packages: nativeAfter }))
      .digest("hex"),
  };
}

module.exports = { assertNativeLockUnchanged, lockedExpoVersion };
