---
name: expo-camera microphonePermission:false deletes NSMicrophoneUsageDescription
description: Setting microphonePermission:false in the expo-camera plugin actively removes NSMicrophoneUsageDescription from Info.plist, causing iOS to kill the app on any audio API call.
---

# expo-camera plugin removes mic permission key when set to false

## The Rule
Never set `microphonePermission: false` in the expo-camera plugin config if the app uses any microphone API (including expo-av recording, `Audio.requestPermissionsAsync()`, etc.).

## Why
The expo-camera plugin calls `createPermissionsPlugin({ NSMicrophoneUsageDescription: ... })` with the value you pass. When that value is `false`, the plugin **deletes** `NSMicrophoneUsageDescription` from the built Info.plist — even if you also set it manually via `infoPlist` in app.json (plugins run after infoPlist merging and can override it).

Without `NSMicrophoneUsageDescription` in Info.plist, iOS immediately terminates the app the moment any audio API is touched. The crash happens before any JS code can run, before any permission dialog appears, and bypasses all try/catch blocks. Symptom: "app crashes when recording/sending voice messages, no permission dialog ever shown."

The CHANGELOG even documents this as intentional: *"Allow user to remove NSMicrophoneUsageDescription... if they don't intend to use video."*

## How to Apply
If expo-camera is in the plugins list and the app uses the microphone for ANY reason (not just camera video), always set `microphonePermission` to a proper usage string:

```json
["expo-camera", {
  "cameraPermission": "...",
  "microphonePermission": "Met uses your microphone to record and send voice messages.",
  "recordAudioAndroid": false
}]
```

Also safe to keep the same string in `infoPlist.NSMicrophoneUsageDescription` — redundancy is fine.
