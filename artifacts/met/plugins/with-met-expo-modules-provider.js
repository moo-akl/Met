const { withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

const PROVIDER_NAME = "MetExpoModulesProvider";
const PROVIDER_FILE_NAME = `${PROVIDER_NAME}.swift`;

function patchPodfile(contents) {
  const replacement =
    `use_expo_modules!(providerName: "${PROVIDER_FILE_NAME}", ` +
    'projectRoot: File.expand_path("..", __dir__), ' +
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

function replaceRequired(contents, before, after, label) {
  if (contents.includes(after)) return contents;
  const firstIndex = contents.indexOf(before);
  if (firstIndex < 0 || contents.indexOf(before, firstIndex + before.length) >= 0) {
    throw new Error(
      `[with-met-expo-modules-provider] Expected one ${label} marker in Expo Modules Core.`,
    );
  }
  return contents.replace(before, after);
}

function patchAppContext(contents) {
  return replaceRequired(
    contents,
    'public static func modulesProvider(withName providerName: String = "ExpoModulesProvider")',
    `public static func modulesProvider(withName providerName: String = "${PROVIDER_NAME}")`,
    "default provider name",
  );
}

function patchExpoBridgeModule(contents) {
  return replaceRequired(
    contents,
    'useModulesProvider:@"ExpoModulesProvider"',
    `useModulesProvider:@"${PROVIDER_NAME}"`,
    "bridge provider name",
  );
}

function resolveExpoModulesCoreRoot(projectRoot) {
  const expoPackageJson = require.resolve("expo/package.json", {
    paths: [projectRoot],
  });
  const expoRoot = path.dirname(expoPackageJson);
  const corePackageJson = require.resolve("expo-modules-core/package.json", {
    paths: [expoRoot],
  });
  return path.dirname(corePackageJson);
}

module.exports = function withMetExpoModulesProvider(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Podfile",
      );
      const appContextPath = path.join(
        resolveExpoModulesCoreRoot(cfg.modRequest.projectRoot),
        "ios",
        "Core",
        "AppContext.swift",
      );
      const expoBridgeModulePath = path.join(
        path.dirname(appContextPath),
        "ExpoBridgeModule.mm",
      );

      for (const filePath of [podfilePath, appContextPath, expoBridgeModulePath]) {
        if (!fs.existsSync(filePath)) {
          throw new Error(
            `[with-met-expo-modules-provider] Required iOS provider file is missing: ${path.basename(filePath)}`,
          );
        }
      }

      const podfile = fs.readFileSync(podfilePath, "utf8");
      const appContext = fs.readFileSync(appContextPath, "utf8");
      const expoBridgeModule = fs.readFileSync(expoBridgeModulePath, "utf8");
      const patched = [
        [podfilePath, patchPodfile(podfile)],
        [appContextPath, patchAppContext(appContext)],
        [expoBridgeModulePath, patchExpoBridgeModule(expoBridgeModule)],
      ];

      for (const [filePath, contents] of patched) {
        if (contents !== fs.readFileSync(filePath, "utf8")) {
          fs.writeFileSync(filePath, contents);
        }
      }

      console.log(
        `[with-met-expo-modules-provider] Using ${PROVIDER_NAME} and anchoring Expo autolinking to the app root.`,
      );
      return cfg;
    },
  ]);
};

module.exports.patchAppContext = patchAppContext;
module.exports.patchExpoBridgeModule = patchExpoBridgeModule;
module.exports.patchPodfile = patchPodfile;
module.exports.PROVIDER_FILE_NAME = PROVIDER_FILE_NAME;
module.exports.PROVIDER_NAME = PROVIDER_NAME;
