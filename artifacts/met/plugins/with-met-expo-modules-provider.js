const { withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

function patchPodfile(contents) {
  const replacement =
    'use_expo_modules!(projectRoot: File.expand_path("..", __dir__), ' +
    'appRoot: File.expand_path("..", __dir__))';
  if (contents.includes(replacement)) {
    return contents;
  }

  const call = /^([ \t]*)use_expo_modules!\s*(?:\([^)\r\n]*\))?[ \t]*$/m;
  if (!call.test(contents)) {
    throw new Error(
      "[with-met-expo-modules-provider] Could not find the generated use_expo_modules! call.",
    );
  }

  return contents.replace(
    call,
    `$1${replacement}`,
  );
}

module.exports = function withMetExpoModulesProvider(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Podfile",
      );

      if (!fs.existsSync(podfilePath)) {
        throw new Error(
          "[with-met-expo-modules-provider] Generated iOS Podfile is missing.",
        );
      }

      const podfile = fs.readFileSync(podfilePath, "utf8");
      const patched = patchPodfile(podfile);
      if (patched !== podfile) {
        fs.writeFileSync(podfilePath, patched);
      }

      console.log(
        "[with-met-expo-modules-provider] Keeping Expo's default provider and anchoring autolinking to Met's app root.",
      );
      return cfg;
    },
  ]);
};

module.exports.patchPodfile = patchPodfile;
