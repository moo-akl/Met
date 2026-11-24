/**
 * with-ios-turbomodule-patch
 *
 * Replaces the pnpm patchedDependencies entry for react-native that previously
 * applied this fix. patchedDependencies caused pnpm to encode a `patch_hash=…`
 * suffix into every dependent package's directory path; the Google `prefab`
 * CLI (v2.1.0) interprets paths containing `=` as CLI options and aborts with
 * "no such option …", breaking the Android CMake/prefab build step.
 *
 * Fix: instead of patching the npm package on disk, we apply the same change
 * here via withDangerousMod, which runs during `expo prebuild` on the EAS
 * build machine — before CocoaPods compiles RCTTurboModule.mm.
 *
 * The patch suppresses rethrown NSExceptions from void async TurboModule
 * methods.  Rethrowing causes an uncatchable C++ exception on background
 * queues → SIGABRT on iOS 26 / Xcode 16.3+ images.
 * See: https://github.com/facebook/react-native/issues/54859
 */

const { withDangerousMod } = require("expo/config-plugins");
const {
  patchReactNativeTurboModule,
} = require("../scripts/ios-turbomodule-patch.cjs");

module.exports = function withIosTurboModulePatch(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const result = patchReactNativeTurboModule(
        cfg.modRequest.projectRoot,
      );
      console.log(
        `[MET_TURBOMODULE_PATCH] ${
          result.status === "patched" ? "Applied" : "AlreadyApplied"
        }`,
      );
      return cfg;
    },
  ]);
};
