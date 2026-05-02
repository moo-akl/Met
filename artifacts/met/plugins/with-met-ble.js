// Expo config plugin that wires the local `expo-met-ble` native
// module's manifest requirements:
//
//   iOS: `NSBluetoothAlwaysUsageDescription` (and the deprecated
//        peripheral string, defensively, for legacy simulators).
//
//   Android: `BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_SCAN`
//        (WITHOUT `neverForLocation` — see note below),
//        `BLUETOOTH_CONNECT`, `BLUETOOTH_ADVERTISE`.
//
// `neverForLocation` note: Met uses BLE specifically to infer physical
// proximity via Apple's iBeacon protocol. That's exactly the kind of
// "deriving location from BLE" Google's `neverForLocation` flag is
// designed to disclaim — and on Android 12+ devices, declaring it
// causes the OS to filter scan results in ways that materially break
// proximity discovery (we lose beacons that would otherwise resolve).
// We therefore omit the flag and pair the BLE scan permission with
// the standard `ACCESS_FINE_LOCATION` declaration that the
// `expo-location` plugin already adds to the manifest.
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
    // Intentionally NOT tagged `neverForLocation` — see the file
    // header for the rationale. iBeacon ranging IS location inference
    // and the OS scan-result filter actively breaks proximity when
    // the flag is set.
    ensure("android.permission.BLUETOOTH_SCAN");
    ensure("android.permission.BLUETOOTH_CONNECT");
    ensure("android.permission.BLUETOOTH_ADVERTISE");
    // ACCESS_FINE_LOCATION is the legacy permission required for
    // BLE scanning on Android 6..11. The `expo-location` plugin
    // declares it for the GPS pipeline, but we ensure it here too in
    // case the plugin order ever changes.
    ensure("android.permission.ACCESS_FINE_LOCATION");

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
