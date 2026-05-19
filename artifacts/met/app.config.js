// app.config.js — dynamic Expo config that wraps app.json.
//
// The only reason this file exists (rather than using app.json alone) is to
// make `googleServicesFile` conditional on the Firebase credential env vars
// being present.  This prevents `npx expo config --type introspect` from
// failing with ENOENT during EAS Build setup when the secrets haven't been
// loaded yet — a problem that occurs because Expo validates the path at
// config-read time, before the `with-firebase-credentials` plugin has had a
// chance to write the files.
//
// When the EAS secrets GOOGLE_SERVICE_INFO_PLIST / GOOGLE_SERVICES_JSON are
// set, the env vars are non-empty, the paths are included in the config, and
// Expo's built-in credential copy step runs as normal after the plugin writes
// the files.  When the secrets are absent the paths are omitted, Expo's copy
// step is skipped, and the build fails later at native compilation with a
// clear "file not found" message from Xcode/Gradle rather than a cryptic
// "expo config exited with code 1" at build-setup time.

const baseConfig = require("./app.json");

module.exports = () => {
  const config = { ...baseConfig.expo };

  config.ios = {
    ...config.ios,
    googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST
      ? "./GoogleService-Info.plist"
      : undefined,
  };

  config.android = {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON
      ? "./google-services.json"
      : undefined,
  };

  return { expo: config };
};
