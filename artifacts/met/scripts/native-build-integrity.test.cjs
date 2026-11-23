const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { test } = require("node:test");

const appRoot = path.resolve(__dirname, "..");
const moduleRoot = path.join(appRoot, "modules/expo-met-ble");

test("Calendar permission descriptions are configured only with the native module", async () => {
  const app = JSON.parse(fs.readFileSync(path.join(appRoot, "app.json"), "utf8")).expo;
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8"));
  const hasCalendarDependency = ["dependencies", "devDependencies"].some(
    (section) => Boolean(packageJson[section]?.["expo-calendar"]),
  );
  const calendarPlugin = app.plugins.find(
    (plugin) => plugin === "expo-calendar" ||
      (Array.isArray(plugin) && plugin[0] === "expo-calendar"),
  );

  assert.equal(
    Boolean(calendarPlugin),
    hasCalendarDependency,
    "expo-calendar must be both installed and configured, or absent",
  );
  if (!hasCalendarDependency) return;

  const withCalendar = require("expo-calendar/app.plugin.js").default;
  const options = Array.isArray(calendarPlugin) ? calendarPlugin[1] ?? {} : {};
  const config = withCalendar({ name: app.name, slug: app.slug }, options);
  const result = await config.mods.ios.infoPlist({
    ...config,
    modResults: structuredClone(app.ios.infoPlist ?? {}),
    modRequest: { nextMod: async (value) => value },
  });

  for (const key of [
    "NSCalendarsUsageDescription",
    "NSCalendarsFullAccessUsageDescription",
    "NSRemindersUsageDescription",
    "NSRemindersFullAccessUsageDescription",
  ]) {
    assert.ok(
      typeof result.modResults[key] === "string" && result.modResults[key].trim(),
      `${key} is required when Expo Calendar is installed`,
    );
  }
});

test("iOS archive validator fixtures pass before the native build", () => {
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