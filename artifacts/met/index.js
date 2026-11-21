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
  if (Platform.OS !== "web") {
    try {
      const messaging = require("@react-native-firebase/messaging");
      messaging.setBackgroundMessageHandler(
        messaging.getMessaging(),
        async (_remoteMessage) => {
          // FCM notification payloads are displayed automatically by FCM/APNs.
          // This handler supports Android killed-state headless tasks.
        },
      );
    } catch {
      // Firebase Messaging is unavailable in Expo Go and web previews.
    }
  }
  require("expo-router/entry");
}
