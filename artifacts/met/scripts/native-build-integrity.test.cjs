const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { test } = require("node:test");
const { assertNativeLockUnchanged, lockedExpoVersion } = require("./native-lock-guard.cjs");

const appRoot = path.resolve(__dirname, "..");
const moduleRoot = path.join(appRoot, "modules/expo-met-ble");

async function calendarInfoPlist(options, initialPlist = {}) {
  const withCalendar = require("expo-calendar/app.plugin.js").default;
  const config = withCalendar({ name: "Met", slug: "met" }, options);
  const result = await config.mods.ios.infoPlist({
    ...config,
    modResults: structuredClone(initialPlist),
    modRequest: { nextMod: async (value) => value },
  });
  return result.modResults;
}

const calendarUsageKeys = [
  "NSCalendarsUsageDescription",
  "NSCalendarsFullAccessUsageDescription",
  "NSRemindersUsageDescription",
  "NSRemindersFullAccessUsageDescription",
];

test("Calendar startup keeps usage descriptions for both permission requesters", async () => {
  const app = require("../app.json").expo;
  const calendarPlugin = app.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-calendar",
  );
  assert.ok(calendarPlugin, "The native Calendar feature must stay configured");
  const plist = await calendarInfoPlist(calendarPlugin[1], app.ios.infoPlist);
  for (const key of calendarUsageKeys) {
    assert.ok(typeof plist[key] === "string" && plist[key].trim(),
      `${key} is required by Calendar's native startup permission checks`);
  }
});

test("the old remindersPermission false setting deletes even explicit plist descriptions", async () => {
  const initial = Object.fromEntries(calendarUsageKeys.map((key) => [key, "Fixture description"]));
  const plist = await calendarInfoPlist({
    calendarPermission: "Fixture calendar description",
    remindersPermission: false,
  }, initial);
  assert.ok(plist.NSCalendarsFullAccessUsageDescription);
  assert.equal(plist.NSRemindersUsageDescription, undefined);
  assert.equal(plist.NSRemindersFullAccessUsageDescription, undefined);
});

test("final IPA permission validation rejects incomplete and mismatched archives", () => {
  execFileSync("python3", [path.join(__dirname, "ios-startup-permissions.test.py")], {
    cwd: appRoot,
    stdio: "pipe",
  });
});

test("only generated app-level native directories are ignored", () => {
  const isIgnored = (filePath) => {
    try {
      execFileSync("git", ["check-ignore", "--no-index", "--quiet", filePath], { cwd: appRoot });
      return true;
    } catch (error) {
      if (error.status === 1) return false;
      throw error;
    }
  };

  assert.equal(isIgnored("ios/AppDelegate.swift"), true);
  assert.equal(isIgnored("android/app/build.gradle"), true);
  assert.equal(isIgnored("modules/expo-met-ble/ios/MetBleModule.swift"), false);
  assert.equal(
    isIgnored("modules/expo-met-ble/android/src/main/java/expo/modules/metble/MetBleModule.kt"),
    false,
  );
});

test("Expo BLE module config entrypoints have native source files", () => {
  const config = JSON.parse(fs.readFileSync(path.join(moduleRoot, "expo-module.config.json"), "utf8"));

  assert.ok(config.apple.modules.includes("MetBleModule"));
  assert.ok(fs.existsSync(path.join(moduleRoot, "ios", "MetBleModule.swift")));

  const androidModule = config.android.modules.find((name) => name.endsWith(".MetBleModule"));
  assert.ok(androidModule, "Android module config must include MetBleModule");
  const androidSource = path.join(
    moduleRoot,
    "android/src/main/java",
    ...androidModule.split("."),
  ) + ".kt";
  assert.ok(fs.existsSync(androidSource), `Android module source must exist: ${androidSource}`);
});

test("Expo BLE native build configuration has required toolchain guards", () => {
  const gradle = fs.readFileSync(path.join(moduleRoot, "android", "build.gradle"), "utf8");
  const podspec = fs.readFileSync(path.join(moduleRoot, "ios", "ExpoMetBle.podspec"), "utf8");

  assert.match(gradle, /\buseDefaultAndroidSdkVersions\s*\(\s*\)/);
  assert.doesNotMatch(gradle, /\bgetKotlinVersion\b/);
  assert.match(podspec, /\bs\.swift_version\s*=\s*['"]5\.0['"]/);
});

function lockFixture() {
  return [
    "lockfileVersion: '9.0'",
    "overrides:",
    "  'rollup>@rollup/rollup-darwin-arm64': '-'",
    "importers:",
    "  .: {}",
    "  artifacts/met:",
    "    devDependencies:",
    "      expo:",
    "        specifier: ~54.0.38",
    "        version: 54.0.38(react@19.1.0)",
    "packages:",
    "  expo@54.0.38:",
    "    resolution: {integrity: expo-integrity}",
    "  expo-modules-core@3.0.30:",
    "    resolution: {integrity: core-integrity}",
    "  react@19.1.0:",
    "    resolution: {integrity: react-integrity}",
    "  react-native@0.81.5:",
    "    resolution: {integrity: rn-integrity}",
    "snapshots:",
    "  expo@54.0.38(react@19.1.0):",
    "    dependencies:",
    "      expo-modules-core: 3.0.30",
    "  expo-modules-core@3.0.30: {}",
    "  react@19.1.0: {}",
    "  react-native@0.81.5: {}",
    "",
  ].join("\n");
}

test("native lock guard accepts unchanged and platform-adapted locks", () => {
  const before = lockFixture();
  const after = before.replace("  'rollup>@rollup/rollup-darwin-arm64': '-'\n", "")
    .replace("  .: {}", "  .:\n    devDependencies:\n      expo:\n        specifier: 54.0.38\n        version: 54.0.38(react@19.1.0)")
    .replace("packages:\n", "packages:\n  '@rollup/rollup-darwin-arm64@4.0.0':\n    resolution: {integrity: platform-only}\n");
  assert.equal(lockedExpoVersion(before), "54.0.38");
  assert.equal(assertNativeLockUnchanged(before, after).nativePackageCount, 4);
  assert.match(assertNativeLockUnchanged(before, before).fingerprint, /^[a-f0-9]{64}$/);
});

test("native lock guard permits optional-tree promotion without changing dependencies", () => {
  const before = lockFixture().replace("      expo-modules-core: 3.0.30", "      expo-modules-core: 3.0.30\n    optional: true");
  assert.equal(assertNativeLockUnchanged(before, lockFixture()).nativePackageCount, 4);
});

test("native lock guard rejects changed app resolutions and native versions", () => {
  const before = lockFixture();
  assert.throws(() => assertNativeLockUnchanged(before, before.replace("version: 54.0.38(", "version: 54.0.39(")), /Met dependency resolution changed/);
  assert.throws(() => assertNativeLockUnchanged(before, before.replace("expo-modules-core@3.0.30:", "expo-modules-core@3.0.31:")), /Native package versions or integrity changed/);
  assert.throws(() => assertNativeLockUnchanged(before, before.replace("core-integrity", "different-integrity")), /Native package versions or integrity changed/);
});

test("native lock guard rejects rewritten or missing native snapshots", () => {
  const before = lockFixture();
  assert.throws(() => assertNativeLockUnchanged(before, before.replace("expo-modules-core: 3.0.30", "expo-modules-core: 3.0.31")), /native dependency snapshot changed/);
  assert.throws(() => assertNativeLockUnchanged(before, before.replace("  expo-modules-core@3.0.30: {}", "")), /native dependency snapshot changed/);
});

test("native lock guard rejects unreadable or incomplete baselines", () => {
  const before = lockFixture();
  for (const broken of [
    "",
    before.replace("9.0", "10.0"),
    before.replace("  artifacts/met:", "  artifacts/other:"),
    before.replace("  expo-modules-core@3.0.30:", "  other@3.0.30:"),
    before.replace("snapshots:", "other:"),
    before.replace("  react@19.1.0: {}", "  react@19.1.0: {}\n  react@19.1.0: {}"),
  ]) {
    assert.throws(() => assertNativeLockUnchanged(broken, before), /\[native-lock\]/);
  }
});

test("committed native graph validates against itself", () => {
  const lock = fs.readFileSync(path.resolve(appRoot, "../../pnpm-lock.yaml"), "utf8");
  assert.ok(assertNativeLockUnchanged(lock, lock).nativePackageCount > 20);
});