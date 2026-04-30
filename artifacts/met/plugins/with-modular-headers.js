const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Fixes the iOS build for `@react-native-firebase/*` (v22+) when used with
 * `use_frameworks! :linkage => :static` (required by Firebase iOS SDK).
 *
 * RNFBApp is built as a framework module that #includes non-modular React-Core
 * headers (`RCTBridgeModule.h`, `RCTConvert.h`, `RCTEventEmitter.h`). Xcode
 * treats those as `-Wnon-modular-include-in-framework-module` errors.
 *
 * Two injections into the generated Podfile:
 *   1. `use_modular_headers!` after `use_frameworks!` — best effort to make
 *      React-Core ship a module map.
 *   2. Inside the existing `post_install` block, force
 *      `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES` on every
 *      pod target. This is the actual fix — it tells Xcode to permit the
 *      non-modular include rather than erroring out.
 */
const POST_INSTALL_INJECTION = `
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
`;

const POST_INSTALL_MARKER = "CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES";

const withModularHeaders = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );

      let contents = await fs.promises.readFile(podfilePath, "utf8");
      let changed = false;

      // 1. Inject `use_modular_headers!` after the first `use_frameworks!`.
      if (!contents.includes("use_modular_headers!")) {
        const updated = contents.replace(
          /^(\s*)use_frameworks!.*$/m,
          (match, indent) => `${match}\n${indent}use_modular_headers!`,
        );
        if (updated === contents) {
          throw new Error(
            "with-modular-headers: could not find `use_frameworks!` line in Podfile.",
          );
        }
        contents = updated;
        changed = true;
      }

      // 2. Inject the build setting override inside the existing
      //    `post_install do |installer| ... end` block, right after
      //    `react_native_post_install(...)`.
      if (!contents.includes(POST_INSTALL_MARKER)) {
        const updated = contents.replace(
          /(react_native_post_install\([\s\S]*?\)[ \t]*\n)/,
          `$1${POST_INSTALL_INJECTION}`,
        );
        if (updated === contents) {
          throw new Error(
            "with-modular-headers: could not find `react_native_post_install(...)` call in Podfile to inject build setting after.",
          );
        }
        contents = updated;
        changed = true;
      }

      if (changed) {
        await fs.promises.writeFile(podfilePath, contents);
      }
      return config;
    },
  ]);
};

module.exports = withModularHeaders;
