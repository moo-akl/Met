import messaging from "@react-native-firebase/messaging";

messaging().setBackgroundMessageHandler(async (_remoteMessage) => {
  // FCM messages with a notification payload are displayed automatically
  // by FCM/APNs. This handler is required to be registered for Android
  // killed-state headless tasks and to satisfy the RN Firebase contract.
});

import "expo-router/entry";
