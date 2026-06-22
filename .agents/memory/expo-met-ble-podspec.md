---
name: ExpoMetBle podspec Firebase dependencies
description: CocoaPods requires explicit pod dependencies in ExpoMetBle.podspec for Firebase modules even when they're already in the project via @react-native-firebase.
---

## Rule
`artifacts/met/modules/expo-met-ble/ios/ExpoMetBle.podspec` must declare `s.dependency 'FirebaseFirestore'` and `s.dependency 'FirebaseAuth'` whenever MetBleModule.swift uses `import FirebaseFirestore` or `import FirebaseAuth`.

**Why:** CocoaPods resolves framework search paths per-target. Without the explicit dependency declaration, the ExpoMetBle Xcode target does not have FirebaseFirestore in its framework search path, causing `import FirebaseFirestore` to fail with "No such module 'FirebaseFirestore'" at EAS build time — even though the pods are present in the workspace from `@react-native-firebase/firestore`.

**How to apply:** Any time a Swift file in `artifacts/met/modules/expo-met-ble/ios/` adds a `import Firebase*` statement, add the corresponding `s.dependency 'Firebase*'` line to the podspec. The pod names match the Firebase iOS SDK module names (FirebaseFirestore, FirebaseAuth, FirebaseMessaging, etc.).
