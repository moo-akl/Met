const assert = require("node:assert/strict");
const fs = require("node:fs");
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

test("iOS config uses a dedicated Expo modules provider name", () => {
  assert.ok(appConfig.plugins.includes("./plugins/with-met-expo-modules-provider.js"));
  assert.equal(appConfig.ios.buildNumber, "350");
  assert.equal(plugin.PROVIDER_NAME, "MetExpoModulesProvider");
  assert.equal(plugin.PROVIDER_FILE_NAME, "MetExpoModulesProvider.swift");
});

test("Podfile anchors Expo autolinking to Met's app root and unique provider", () => {
  const source = [
    "target 'Met' do",
    "  use_react_native!",
    "  use_expo_modules!",
    "end",
  ].join("\n");
  const result = plugin.patchPodfile(source);

  assert.match(
    result,
    /use_expo_modules!\(providerName: "MetExpoModulesProvider\.swift", projectRoot: File\.expand_path\("\.\.", __dir__\), appRoot: File\.expand_path\("\.\.", __dir__\)\)/,
  );
  assert.equal(plugin.patchPodfile(result), result);

  const oldProviderCall = '  use_expo_modules!(providerName: "MetExpoModulesProvider.swift")';
  assert.match(
    plugin.patchPodfile(oldProviderCall),
    /projectRoot: File\.expand_path\("\.\.", __dir__\), appRoot: File\.expand_path\("\.\.", __dir__\)/,
  );
  assert.throws(
    () => plugin.patchPodfile("target 'Met' do\nend"),
    /Could not find the generated use_expo_modules! call/,
  );
});

test("Expo runtime and bridge request the same unique provider", () => {
  const appContext = fs.readFileSync(
    path.join(coreRoot, "ios", "Core", "AppContext.swift"),
    "utf8",
  );
  const bridge = fs.readFileSync(
    path.join(coreRoot, "ios", "Core", "ExpoBridgeModule.mm"),
    "utf8",
  );
  const patchedContext = plugin.patchAppContext(appContext);
  const patchedBridge = plugin.patchExpoBridgeModule(bridge);

  assert.match(patchedContext, /providerName: String = "MetExpoModulesProvider"/);
  assert.match(patchedBridge, /useModulesProvider:@"MetExpoModulesProvider"/);
  assert.equal(plugin.patchAppContext(patchedContext), patchedContext);
  assert.equal(plugin.patchExpoBridgeModule(patchedBridge), patchedBridge);
});
