// Expo config plugin that wires the local `expo-met-ble` native
// module's manifest requirements:
//
//   iOS: `NSBluetoothAlwaysUsageDescription` (and the deprecated
//        peripheral string, defensively, for legacy simulators).
//
//   Android: `BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_SCAN`
//        (with `neverForLocation`), `BLUETOOTH_CONNECT`,
//        `BLUETOOTH_ADVERTISE`.
//
// The native module itself is autolinked via `expo-modules-autolinking`
// because it lives at `<project>/modules/expo-met-ble/` with an
// `expo-module.config.json`. This plugin handles ONLY the manifest
// edits — every other piece of glue is in the module folder.
//
// Reviewer note (App Store): the iOS usage description below MUST stay
// truthful and consistent with the App Privacy disclosure. If you
// change Met's BLE behaviour, update both.

const { withAndroidManifest, withInfoPlist } = require("@expo/config-plugins");

const IOS_USAGE =
  "Met uses Bluetooth to detect nearby Met users you cross paths with.";

function withInfoPlistChanges(config, opts) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.NSBluetoothAlwaysUsageDescription =
      opts.iosUsage || cfg.modResults.NSBluetoothAlwaysUsageDescription || IOS_USAGE;
    cfg.modResults.NSBluetoothPeripheralUsageDescription =
      opts.iosUsage || cfg.modResults.NSBluetoothPeripheralUsageDescription || IOS_USAGE;
    return cfg;
  });
}

function withAndroidPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    if (!Array.isArray(manifest.manifest["uses-permission"])) {
      manifest.manifest["uses-permission"] = [];
    }
    const list = manifest.manifest["uses-permission"];

    function ensure(name, extra) {
      const existing = list.find((p) => p && p.$ && p.$["android:name"] === name);
      if (existing) {
        if (extra) Object.assign(existing.$, extra);
        return;
      }
      list.push({ $: Object.assign({ "android:name": name }, extra || {}) });
    }

    ensure("android.permission.BLUETOOTH");
    ensure("android.permission.BLUETOOTH_ADMIN");
    ensure("android.permission.BLUETOOTH_SCAN", {
      "android:usesPermissionFlags": "neverForLocation",
    });
    ensure("android.permission.BLUETOOTH_CONNECT");
    ensure("android.permission.BLUETOOTH_ADVERTISE");

    return cfg;
  });
}

const withMetBle = (config, props) => {
  const opts = props || {};
  config = withInfoPlistChanges(config, opts);
  config = withAndroidPermissions(config);
  return config;
};

module.exports = withMetBle;
