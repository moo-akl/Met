const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Surgical Podfile patches for `@react-native-firebase/*` (v24+) on
 * Expo SDK 54+ with `use_frameworks! :linkage => :static`.
 *
 * History of this plugin:
 *   v1 — added `$RNFirebaseAsStaticFramework = true` + `use_modular_headers!`
 *        + `DEFINES_MODULE = YES` to fix the original "must be imported
 *        from module 'RNFBApp.RNFBAppModule' before required" chain.
 *   v2 (this) — REMOVED `use_modular_headers!` and `DEFINES_MODULE = YES`.
 *        Those two together turned every `<React/RCTBridgeModule.h>` import
 *        in RNFB's `.m` files into a *module* import, which only crosses
 *        types/protocols across the framework boundary — NOT preprocessor
 *        macros. As a result, `RCT_EXTERN`, `RCT_EXPORT_METHOD`, and
 *        `RCT_CONCAT` (defined as macros in RCTBridgeModule.h) became
 *        unknown identifiers at compile time, producing:
 *           - "unknown type name 'RCT_EXTERN'"
 *           - "duplicate declaration of method 'RCT_CONCAT'"
 *           - "expected method body" / "expected ':'"
 *        on Xcode 26 + RNFB 24 + Expo SDK 54.
 *
 * Two minimal injections remain:
 *
 *   1. `$RNFirebaseAsStaticFramework = true` at the top of the Podfile.
 *      This is the official react-native-firebase recommendation when
 *      `use_frameworks! :linkage => :static` is in effect — it tells every
 *      RNFB pod to opt into static framework packaging with its own
 *      module map (instead of forcing it globally).
 *
 *   2. Inside the existing `post_install` block, set
 *      `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES` on
 *      every pod target. This suppresses the
 *      `-Wnon-modular-include-in-framework-module` warning-as-error that
 *      otherwise fires when RNFB's framework module headers `#import`
 *      React-Core's textual headers. Without this, the build fails with
 *      "include of non-modular header inside framework module".
 *
 *      We deliberately do NOT add `DEFINES_MODULE = YES` — forcing every
 *      pod (including React-Core) to emit a module map is what flipped
 *      RNFB's React-Core imports into modular ones, stripping the macros.
 */
const STATIC_FRAMEWORK_FLAG = "$RNFirebaseAsStaticFramework = true";

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

      // 1. Set `$RNFirebaseAsStaticFramework = true` at the very top of the
      //    Podfile (before any `target` block). Without this, RNFB pods
      //    aren't packaged as static frameworks with module maps, and
      //    downstream pods (RNFBFirestore, RNFBAppCheck) can't find
      //    RNFBApp's exported symbols.
      if (!contents.includes(STATIC_FRAMEWORK_FLAG)) {
        contents = `${STATIC_FRAMEWORK_FLAG}\n${contents}`;
        changed = true;
      }

      // 2. Inject the warning-suppression build setting inside the existing
      //    `post_install do |installer| ... end` block, right after
      //    `react_native_post_install(...)`. This is needed because RNFB
      //    framework modules `#import` React-Core's non-modular headers,
      //    which otherwise trips `-Wnon-modular-include-in-framework-module`.
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
