---
name: Android Maps API key — react-native-maps plugin
description: react-native-maps Expo plugin removes the API key from AndroidManifest when androidGoogleMapsApiKey is not provided, causing a fatal native crash on Android.
---

## The rule

Always pass `androidGoogleMapsApiKey` to the `react-native-maps` Expo plugin in `app.json`. Without it, the plugin **actively removes** `com.google.android.geo.API_KEY` from AndroidManifest.xml.

**Why:** The Google Maps SDK for Android crashes fatally when no API key is present in the manifest. This is a native crash — no amount of JS-level timing fixes (setTimeout, InteractionManager, useFocusEffect) can prevent it.

**How to apply:** In `app.json` plugins array:
```json
["react-native-maps", {
  "androidGoogleMapsApiKey": "<the Android API key>"
}]
```

The Android API key lives in `google-services.json` under `client[0].api_key[0].current_key`. It is already committed to the repo, so using it in `app.json` adds no new security exposure.

Also ensure **Maps SDK for Android** is enabled in Google Cloud Console for that key — otherwise the map shows a watermark but at least the app doesn't crash.

## Symptoms that led here

- App crashed on Android exactly at login (the first time the home tab — which contains the MapView — showed)
- iOS worked fine (uses Apple Maps by default, no key needed)
- Three JS-timing fixes (setTimeout 500ms, InteractionManager, useFocusEffect+InteractionManager) all failed — the crash was native, not in JS
- Deployment logs showed no crash (native crash kills the process before any server log is written)
