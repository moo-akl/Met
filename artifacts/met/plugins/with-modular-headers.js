const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Fixes the iOS build for `@react-native-firebase/*` (v22+) when used with
 * `use_frameworks! :linkage => :static` (required by Firebase iOS SDK)
 * and the React Native New Architecture (Expo SDK 54+).
 *
 * RNFBApp is built as a framework module that #includes non-modular React-Core
 * headers (`RCTBridgeModule.h`, `RCTConvert.h`, `RCTEventEmitter.h`). Xcode
 * treats those as `-Wnon-modular-include-in-framework-module` errors and emits
 * the cryptic "declaration of 'RCTBridgeModule' must be imported from module
 * 'RNFBApp.RNFBAppModule' before it is required" failure when downstream pods
 * (RNFBFirestore, RNFBAuth, RNFBAppCheck) try to consume RNFBApp.
 *
 * Three injections into the generated Podfile:
 *   1. Set `$RNFirebaseAsStaticFramework = true` at the very top so all RNFB
 *      pods opt into static framework packaging with proper module maps.
 *      This is the official react-native-firebase recommendation when
 *      `use_frameworks! :linkage => :static` is in effect.
 *   2. Inject `use_modular_headers!` after the first `use_frameworks!` so
 *      every transitive pod (including React-Core) ships a module map.
 *   3. Inside the existing `post_install` block, force
 *      `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES` AND
 *      `DEFINES_MODULE = YES` on every pod target. The DEFINES_MODULE flag
 *      is the bit that was missing — without it, React-Core's headers can be
 *      included by RNFBApp's framework module but not re-exported, producing
 *      the "must be imported from module X before required" error chain.
 */
const STATIC_FRAMEWORK_FLAG = "$RNFirebaseAsStaticFramework = true";

const POST_INSTALL_INJECTION = `
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        config.build_settings['DEFINES_MODULE'] = 'YES'
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

      // 0. Set `$RNFirebaseAsStaticFramework = true` at the very top of the
      //    Podfile (before any `target` block). This is the official RNFB
      //    recommendation when `use_frameworks! :linkage => :static` is set
      //    — it forces every RNFB pod to be vendored as a static framework
      //    with proper module-map emission, which fixes RNFBFirestore /
      //    RNFBAppCheck failing to find RNFBApp's RCTBridgeModule symbols.
      if (!contents.includes(STATIC_FRAMEWORK_FLAG)) {
        contents = `${STATIC_FRAMEWORK_FLAG}\n${contents}`;
        changed = true;
      }

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
