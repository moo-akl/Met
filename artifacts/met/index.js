import { getMessaging, setBackgroundMessageHandler } from "@react-native-firebase/messaging";
import { Platform } from "react-native";

if (Platform.OS !== "web") {
  try {
    setBackgroundMessageHandler(getMessaging(), async (_remoteMessage) => {
      // FCM notification payloads are displayed automatically by FCM/APNs.
      // This handler supports Android killed-state headless tasks.
    });
  } catch {
    // Firebase Messaging is unavailable in Expo Go and web previews.
  }
}

import "expo-router/entry";
