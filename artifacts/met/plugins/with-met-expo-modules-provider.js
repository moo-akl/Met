const { withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

const PROVIDER_CHECK_MARKER = "# MET_EXPO_PROVIDER_CHECK";

function failProviderCheck(message) {
  console.error("[MET_EXPO_PROVIDER_CHECK] ValidatorInstalled=failed");
  throw new Error(`[MET_EXPO_PROVIDER_CHECK] ${message}`);
}

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

function patchAutolinkingManager(contents, expectedTargetName) {
  if (contents.includes(PROVIDER_CHECK_MARKER)) {
    return contents;
  }

  const generatorMethod =
    /(^[ \t]*)public def generate_modules_provider\(target_name, target_path\)\r?\n([ \t]*)Process\.wait IO\.popen\(generate_modules_provider_command_args\(target_path\)\)\.pid\r?\n([ \t]*)end/m;
  const match = contents.match(generatorMethod);
  if (!match) {
    throw new Error(
      "[MET_EXPO_PROVIDER_CHECK] Could not locate the Expo provider generator.",
    );
  }

  const [, methodIndent, bodyIndent, endIndent] = match;
  const targetLiteral = JSON.stringify(expectedTargetName);
  const replacement = [
    `${methodIndent}public def generate_modules_provider(target_name, target_path)`,
    `${bodyIndent}Process.wait IO.popen(generate_modules_provider_command_args(target_path)).pid`,
    `${bodyIndent}if target_name != ${targetLiteral}`,
    `${bodyIndent}  puts "[MET_EXPO_PROVIDER_CHECK] Target=unexpected"`,
    `${bodyIndent}  return`,
    `${bodyIndent}end`,
    `${bodyIndent}puts "[MET_EXPO_PROVIDER_CHECK] Target=matched"`,
    `${bodyIndent}unless $?.success?`,
    `${bodyIndent}  puts "[MET_EXPO_PROVIDER_CHECK] ProviderGeneration=failed"`,
    `${bodyIndent}  raise "[MET_EXPO_PROVIDER_CHECK] Expo provider generation failed."`,
    `${bodyIndent}end`,
    `${bodyIndent}provider_source = File.file?(target_path) ? File.read(target_path) : ""`,
    `${bodyIndent}checks = [`,
    `${bodyIndent}  ["ExpoModulesProvider", provider_source.include?("class ExpoModulesProvider")],`,
    `${bodyIndent}  ["ExpoLinkingModule", provider_source.include?("ExpoLinkingModule.self")],`,
    `${bodyIndent}  ["SplashScreenModule", provider_source.include?("SplashScreenModule.self")]`,
    `${bodyIndent}]`,
    `${bodyIndent}checks.each do |name, present|`,
    `${bodyIndent}  status = present ? "present" : "missing"`,
    `${bodyIndent}  puts "[MET_EXPO_PROVIDER_CHECK] #{name}=#{status}"`,
    `${bodyIndent}end`,
    `${bodyIndent}unless checks.all? { |_name, present| present }`,
    `${bodyIndent}  raise "[MET_EXPO_PROVIDER_CHECK] Generated provider is missing required entries."`,
    `${bodyIndent}end`,
    `${bodyIndent}${PROVIDER_CHECK_MARKER}`,
    `${endIndent}end`,
  ].join("\n");

  return contents.replace(generatorMethod, replacement);
}

function findWorkspaceRoot(start) {
  let directory = path.resolve(start);
  for (let depth = 0; depth < 8; depth += 1) {
    if (fs.existsSync(path.join(directory, "pnpm-workspace.yaml"))) {
      return directory;
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return path.resolve(start);
}

function resolveAutolinkingManagerPath(appRoot) {
  const workspaceRoot = findWorkspaceRoot(appRoot);
  const packagePaths = [
    path.join(appRoot, "node_modules", "expo-modules-autolinking"),
    path.join(workspaceRoot, "node_modules", "expo-modules-autolinking"),
    path.join(
      workspaceRoot,
      "node_modules",
      ".pnpm",
      "node_modules",
      "expo-modules-autolinking",
    ),
  ];

  for (const packagePath of packagePaths) {
    if (!fs.existsSync(packagePath)) continue;
    try {
      const managerPath = path.join(
        fs.realpathSync(packagePath),
        "scripts",
        "ios",
        "autolinking_manager.rb",
      );
      if (fs.existsSync(managerPath)) return managerPath;
    } catch {
      // Ignore a broken candidate and check the other pnpm resolution paths.
    }
  }
  return null;
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

      const appRoot = path.resolve(cfg.modRequest.platformProjectRoot, "..");
      const appConfigPath = path.join(appRoot, "app.json");
      const appConfig = JSON.parse(fs.readFileSync(appConfigPath, "utf8")).expo;
      const targetName = cfg.name || appConfig?.name;
      if (typeof targetName !== "string" || targetName.length === 0) {
        failProviderCheck("App target name is unavailable.");
      }

      const autolinkingManagerPath =
        resolveAutolinkingManagerPath(appRoot);
      if (!autolinkingManagerPath) {
        failProviderCheck("Expo provider generator is unavailable.");
      }

      const podfile = fs.readFileSync(podfilePath, "utf8");
      const patched = patchPodfile(podfile);
      if (patched !== podfile) {
        fs.writeFileSync(podfilePath, patched);
      }

      try {
        const manager = fs.readFileSync(autolinkingManagerPath, "utf8");
        const patchedManager = patchAutolinkingManager(manager, targetName);
        if (patchedManager !== manager) {
          fs.writeFileSync(autolinkingManagerPath, patchedManager);
        }
      } catch {
        failProviderCheck("Could not install the generated-provider check.");
      }

      console.log(
        "[MET_EXPO_PROVIDER_CHECK] ValidatorInstalled=present",
      );
      return cfg;
    },
  ]);
};

module.exports.patchPodfile = patchPodfile;
module.exports.patchAutolinkingManager = patchAutolinkingManager;
module.exports.resolveAutolinkingManagerPath = resolveAutolinkingManagerPath;
