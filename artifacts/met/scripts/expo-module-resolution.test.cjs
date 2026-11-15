const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const appRoot = path.resolve(__dirname, "..");
const app = require("../app.json").expo;
const pkg = require("../package.json");
const expoRoot = path.dirname(require.resolve("expo/package.json"));
const expo = require(path.join(expoRoot, "package.json"));

test("Metro uses native autolinking decisions for the pnpm dependency graph", () => {
  assert.equal(app.experiments.autolinkingModuleResolution, true);
  assert.equal(pkg.devDependencies["expo-modules-autolinking"], undefined);
  const autolinker = require(require.resolve("expo-modules-autolinking/package.json", {
    paths: [expoRoot],
  }));
  assert.equal(autolinker.version, expo.dependencies["expo-modules-autolinking"]);
  assert.equal(pkg.devDependencies["@expo/cli"], expo.dependencies["@expo/cli"]);
});

test("all Expo module consumers resolve the same installed runtime", () => {
  const runtime = fs.realpathSync(require.resolve("expo/package.json"));
  for (const name of ["expo-linking", "expo-splash-screen", "expo-router", "expo-font"]) {
    const moduleRoot = path.dirname(require.resolve(`${name}/package.json`));
    assert.equal(fs.realpathSync(require.resolve("expo/package.json", {
      paths: [moduleRoot],
    })), runtime, `${name} must not use a second Expo installation`);
  }
});

test("native libraries and renderer stay at their tested SDK versions", () => {
  const expected = require("expo/bundledNativeModules.json");
  assert.equal(pkg.dependencies["react-native-maps"], expected["react-native-maps"]);
  assert.equal(pkg.dependencies["@react-native-community/datetimepicker"],
    expected["@react-native-community/datetimepicker"]);
  assert.equal(require("react-test-renderer/package.json").version, require("react/package.json").version);
});

test("SDK-compatible maps plugin preserves the existing Android key", async () => {
  const pluginEntry = app.plugins.find((entry) => Array.isArray(entry) && entry[0] === "./plugins/with-sdk54-maps.js");
  assert.ok(pluginEntry, "map configuration must use the SDK-compatible plugin");
  assert.ok(fs.existsSync(path.join(appRoot, pluginEntry[0])));
  const withMaps = require("../plugins/with-sdk54-maps.js");
  const config = withMaps({
    name: "Test", slug: "test",
    android: { package: "test.example", config: { other: "preserved" } },
  }, { androidGoogleMapsApiKey: "test-public-map-key" });
  assert.equal(config.android.package, "test.example");
  assert.equal(config.android.config.other, "preserved");
  assert.equal(config.android.config.googleMaps.apiKey, "test-public-map-key");
  const manifest = { manifest: { application: [{ $: { "android:name": ".MainApplication" } }] } };
  const result = await config.mods.android.manifest({
    ...config,
    modResults: manifest,
    modRequest: { nextMod: async (value) => value },
  });
  const metadata = result.modResults.manifest.application[0]["meta-data"];
  assert.equal(metadata.find((item) => item.$["android:name"] === "com.google.android.geo.API_KEY").$["android:value"], "test-public-map-key");
  assert.throws(() => withMaps({}, {}), /androidGoogleMapsApiKey is required/);
});
