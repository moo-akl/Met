// Keep Metro's runtime first, as required by Expo Router's standard entry.
require("@expo/metro-runtime");

const { Platform } = require("react-native");
const config = require("./app.json");

if (
  Platform.OS === "ios" &&
  config.expo.extra?.startupDiagnostics === true
) {
  // Register a minimal root before importing app routes or Firebase. This is
  // temporary, opt-in instrumentation for the otherwise invisible launch hang.
  require("./startup/registerDiagnosticRoot");
} else {
  const messaging = require("@react-native-firebase/messaging").default;
  messaging().setBackgroundMessageHandler(async (_remoteMessage) => {
    // Required for Android killed-state headless tasks and RN Firebase.
  });
  require("expo-router/entry");
}
