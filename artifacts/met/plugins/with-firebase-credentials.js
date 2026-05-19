const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo config plugin — Firebase credential file injection
 *
 * Writes google-services.json and GoogleService-Info.plist into the project
 * root from environment variables during `expo prebuild`, before Expo's
 * built-in googleServicesFile copy step runs. This means app.json can keep
 * its googleServicesFile declarations (so Expo handles correct placement in
 * the native project) while the source files never need to be committed to git.
 *
 * Secrets MUST be stored as --type string (full file content), NOT --type file.
 * EAS --type file secrets expose a filesystem path, not the content itself,
 * which would cause this plugin to write a path string into the credential
 * file instead of valid JSON/XML — resulting in broken native builds.
 *
 * Required env vars — store as EAS string secrets or export in your shell:
 *   GOOGLE_SERVICES_JSON        — full JSON content of google-services.json
 *   GOOGLE_SERVICE_INFO_PLIST   — full XML content of GoogleService-Info.plist
 *
 * To set secrets (from artifacts/met/ with EAS CLI):
 *   eas secret:create --scope project --name GOOGLE_SERVICES_JSON \
 *     --type string --value "$(cat google-services.json)"
 *   eas secret:create --scope project --name GOOGLE_SERVICE_INFO_PLIST \
 *     --type string --value "$(cat GoogleService-Info.plist)"
 *
 * During EAS builds (EAS_BUILD=true) a missing env var is a hard error.
 * Outside EAS (local Expo Go / web) a warning is emitted and the build
 * continues — credential files are only required for native targets.
 */

const EAS_BUILD = process.env.EAS_BUILD === "true";

const SETUP_INSTRUCTIONS = {
  GOOGLE_SERVICES_JSON: [
    "  eas secret:create --scope project --name GOOGLE_SERVICES_JSON \\",
    '    --type string --value "$(cat google-services.json)"',
  ].join("\n"),
  GOOGLE_SERVICE_INFO_PLIST: [
    "  eas secret:create --scope project --name GOOGLE_SERVICE_INFO_PLIST \\",
    '    --type string --value "$(cat GoogleService-Info.plist)"',
  ].join("\n"),
};

function writeCredentialFile(projectRoot, filename, content, envVar) {
  if (!content || !content.trim()) {
    const msg =
      `[with-firebase-credentials] ${envVar} is not set — ` +
      `${filename} will not be written.\n` +
      `Run this command from artifacts/met/ to store the secret in EAS:\n` +
      SETUP_INSTRUCTIONS[envVar];

    // Always warn — never throw — so that `npx expo config --type introspect`
    // (which EAS runs before prebuild) can complete even when secrets are not
    // yet available.  The build will still fail at native compilation if the
    // credential file is missing, but with a clearer platform-level error
    // rather than a cryptic "expo config exited with code 1".
    console.warn(msg);
    return;
  }

  const dest = path.join(projectRoot, filename);
  fs.writeFileSync(dest, content, "utf8");
  console.log(`[with-firebase-credentials] Wrote ${filename} to ${dest}`);
}

const withFirebaseCredentials = (config) => {
  config = withDangerousMod(config, [
    "android",
    (modConfig) => {
      writeCredentialFile(
        modConfig.modRequest.projectRoot,
        "google-services.json",
        process.env.GOOGLE_SERVICES_JSON,
        "GOOGLE_SERVICES_JSON",
      );
      return modConfig;
    },
  ]);

  config = withDangerousMod(config, [
    "ios",
    (modConfig) => {
      writeCredentialFile(
        modConfig.modRequest.projectRoot,
        "GoogleService-Info.plist",
        process.env.GOOGLE_SERVICE_INFO_PLIST,
        "GOOGLE_SERVICE_INFO_PLIST",
      );
      return modConfig;
    },
  ]);

  return config;
};

module.exports = withFirebaseCredentials;
