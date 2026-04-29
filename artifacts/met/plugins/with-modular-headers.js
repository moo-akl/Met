const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Injects `use_modular_headers!` into the iOS Podfile right after the
 * `use_frameworks!` line.
 *
 * Required because `@react-native-firebase/*` (v22+) bundles RNFBApp as a
 * static framework module that includes non-modular React-Core headers
 * (`RCTBridgeModule.h`, `RCTConvert.h`, `RCTEventEmitter.h`). Without
 * `use_modular_headers!`, Xcode treats those includes as
 * `-Wnon-modular-include-in-framework-module` errors and the build fails.
 *
 * `expo-build-properties` doesn't expose a global `useModularHeaders`
 * option (only per-pod via `extraPods`), and `@react-native-firebase/app`'s
 * own Expo plugin doesn't touch the Podfile, so we add this here.
 */
const withModularHeaders = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );

      let contents = await fs.promises.readFile(podfilePath, "utf8");

      if (contents.includes("use_modular_headers!")) {
        return config;
      }

      const updated = contents.replace(
        /^(\s*)use_frameworks!.*$/m,
        (match, indent) => `${match}\n${indent}use_modular_headers!`,
      );

      if (updated === contents) {
        throw new Error(
          "with-modular-headers: could not find `use_frameworks!` line in Podfile to inject `use_modular_headers!` after.",
        );
      }

      await fs.promises.writeFile(podfilePath, updated);
      return config;
    },
  ]);
};

module.exports = withModularHeaders;
