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
 * Required env vars (set as EAS secrets or in your local shell for native builds):
 *   GOOGLE_SERVICES_JSON        — full JSON content of google-services.json
 *   GOOGLE_SERVICE_INFO_PLIST   — full XML content of GoogleService-Info.plist
 *
 * If either variable is absent the plugin emits a warning and skips writing
 * that file, allowing local Expo Go / web runs to proceed without credentials.
 * A native (iOS/Android) build will fail later when googleServicesFile is
 * missing, which is the intended behaviour — this is a required build step.
 */

function writeCredentialFile(projectRoot, filename, content, label) {
  if (!content || !content.trim()) {
    console.warn(
      `[with-firebase-credentials] ${label} env var is not set. ` +
        `${filename} will not be written. ` +
        `Set this env var (or EAS secret) before running a native build.`,
    );
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
