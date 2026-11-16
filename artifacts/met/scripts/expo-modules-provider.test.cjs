const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const appRoot = path.resolve(__dirname, "..");
const appConfig = require("../app.json").expo;
const expoRoot = path.dirname(require.resolve("expo/package.json", {
  paths: [appRoot],
}));
const coreRoot = path.dirname(require.resolve("expo-modules-core/package.json", {
  paths: [expoRoot],
}));

test("iOS config keeps Expo's default provider", () => {
  assert.ok(!appConfig.plugins.includes("./plugins/with-met-expo-modules-provider.js"));
  assert.equal(appConfig.experiments.autolinkingModuleResolution, undefined);
  assert.equal(
    fs.existsSync(path.join(appRoot, "plugins", "with-met-expo-modules-provider.js")),
    false,
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
