const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const appRoot = path.resolve(__dirname, "..");
const appConfig = require("../app.json").expo;
const plugin = require("../plugins/with-met-expo-modules-provider");
const expoRoot = path.dirname(require.resolve("expo/package.json", {
  paths: [appRoot],
}));
const coreRoot = path.dirname(require.resolve("expo-modules-core/package.json", {
  paths: [expoRoot],
}));

test("iOS config keeps Expo's default provider", () => {
  assert.ok(appConfig.plugins.includes("./plugins/with-met-expo-modules-provider.js"));
});

test("Podfile anchors autolinking to Met's app root without renaming the provider", () => {
  const source = [
    "target 'Met' do",
    "  use_react_native!",
    "  use_expo_modules!",
    "end",
  ].join("\n");
  const result = plugin.patchPodfile(source);

  assert.match(
    result,
    /use_expo_modules!\(projectRoot: File\.expand_path\("\.\.", __dir__\), appRoot: File\.expand_path\("\.\.", __dir__\)\)/,
  );
  assert.doesNotMatch(result, /providerName:/);
  assert.equal(plugin.patchPodfile(result), result);

  const oldProviderCall = '  use_expo_modules!(providerName: "MetExpoModulesProvider.swift")';
  const restoredCall = plugin.patchPodfile(oldProviderCall);
  assert.match(
    restoredCall,
    /projectRoot: File\.expand_path\("\.\.", __dir__\), appRoot: File\.expand_path\("\.\.", __dir__\)/,
  );
  assert.doesNotMatch(restoredCall, /MetExpoModulesProvider|providerName:/);
  assert.throws(
    () => plugin.patchPodfile("target 'Met' do\nend"),
    /Could not find the generated use_expo_modules! call/,
  );
});

test("CocoaPods' generated provider is checked for the app's required modules", () => {
  const managerPath = plugin.resolveAutolinkingManagerPath(appRoot);
  assert.ok(managerPath, "Expo's autolinking provider generator is installed");
  const source = fs.readFileSync(managerPath, "utf8");
  const result = plugin.patchAutolinkingManager(source, appConfig.name);

  assert.match(result, /target_name != "Met"/);
  assert.match(result, /File\.read\(target_path\)/);
  assert.match(result, /Target=matched/);
  assert.match(result, /Target=unexpected/);
  assert.match(result, /provider_source\.include\?\("ExpoLinkingModule\.self"\)/);
  assert.match(result, /provider_source\.include\?\("SplashScreenModule\.self"\)/);
  assert.match(result, /MET_EXPO_PROVIDER_CHECK/);
  assert.equal(
    plugin.patchAutolinkingManager(result, appConfig.name),
    result,
  );
  assert.throws(
    () => plugin.patchAutolinkingManager("module Expo\nend\n", appConfig.name),
    /Could not locate the Expo provider generator/,
  );
});

test("Expo runtime and bridge retain the default provider name", () => {
  const appContext = fs.readFileSync(
    path.join(coreRoot, "ios", "Core", "AppContext.swift"),
    "utf8",
  );
  const bridge = fs.readFileSync(
    path.join(coreRoot, "ios", "Core", "ExpoBridgeModule.mm"),
    "utf8",
  );
  assert.match(appContext, /providerName: String = "ExpoModulesProvider"/);
  assert.match(bridge, /useModulesProvider:@"ExpoModulesProvider"/);
  assert.doesNotMatch(appContext, /MetExpoModulesProvider/);
  assert.doesNotMatch(bridge, /MetExpoModulesProvider/);
});

test("Met's generated iOS provider includes Linking and Splash Screen", () => {
  const autolinking = path.join(
    appRoot,
    "node_modules",
    ".bin",
    "expo-modules-autolinking",
  );
  const resolved = JSON.parse(
    execFileSync(
      autolinking,
      [
        "resolve",
        "--platform",
        "apple",
        "--project-root",
        appRoot,
        "--json",
      ],
      { encoding: "utf8" },
    ),
  );
  const packageNames = resolved.modules.map((module) => module.packageName);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "met-expo-provider-"));
  const providerPath = path.join(tempDir, "ExpoModulesProvider.swift");

  try {
    execFileSync(autolinking, [
      "generate-modules-provider",
      "--platform",
      "apple",
      "--project-root",
      appRoot,
      "--app-root",
      appRoot,
      "--target",
      providerPath,
      "--packages",
      ...packageNames,
    ]);
    const provider = fs.readFileSync(providerPath, "utf8");

    assert.match(provider, /class ExpoModulesProvider/);
    assert.match(provider, /ExpoLinkingModule\.self/);
    assert.match(provider, /SplashScreenModule\.self/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
