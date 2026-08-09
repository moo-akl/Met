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
const fs   = require("fs");
const path = require("path");

const TURBOMODULE_REL_PATH = [
  "node_modules",
  "react-native",
  "ReactCommon",
  "react",
  "nativemodule",
  "core",
  "platform",
  "ios",
  "ReactCommon",
  "RCTTurboModule.mm",
];

// Exact string from RN 0.81.5 that we want to suppress
const OLD_LINE =
  "throw convertNSExceptionToJSError(runtime, exception, std::string{moduleName}, methodNameStr);";

// Replacement — logs the error instead of rethrowing
const NEW_LINES = [
  "// PATCH(with-ios-turbomodule-patch): Do NOT rethrow NSExceptions from void",
  "      // async TurboModule methods — causes uncatchable C++ exception on background",
  "      // queues → SIGABRT on iOS 26 (Xcode 16.3+ build images).",
  "      // See: https://github.com/facebook/react-native/issues/54859",
  '      RCTLogError(@"[TurboModule] Exception in void method %s::%s - %@",',
  "                  moduleName, methodNameStr.c_str(), exception);",
].join("\n");

module.exports = function withIosTurboModulePatch(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const filePath = path.join(
        cfg.modRequest.projectRoot,
        ...TURBOMODULE_REL_PATH,
      );

      if (!fs.existsSync(filePath)) {
        console.warn(
          "[with-ios-turbomodule-patch] RCTTurboModule.mm not found at",
          filePath,
          "— skipping patch.",
        );
        return cfg;
      }

      let contents = fs.readFileSync(filePath, "utf8");

      if (contents.includes("with-ios-turbomodule-patch")) {
        // Already patched (e.g. re-running prebuild without cleaning)
        console.log("[with-ios-turbomodule-patch] Already applied — skipping.");
        return cfg;
      }

      if (!contents.includes(OLD_LINE)) {
        console.warn(
          "[with-ios-turbomodule-patch] Target line not found in RCTTurboModule.mm.",
          "The patch may be stale — verify against the installed react-native version.",
        );
        return cfg;
      }

      contents = contents.replace(OLD_LINE, NEW_LINES);
      fs.writeFileSync(filePath, contents, "utf8");
      console.log("[with-ios-turbomodule-patch] RCTTurboModule.mm patched successfully.");
      return cfg;
    },
  ]);
};
