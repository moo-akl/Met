const {
  withGradleProperties,
  withAppBuildGradle,
  withAndroidManifest,
} = require("expo/config-plugins");

/**
 * with-android-build-fixes
 *
 * Three production-build fixes:
 *
 *   1. Bump the Gradle JVM args. The Expo template ships
 *      `org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m`, which is
 *      too small once `:expo-modules-core:lintVitalAnalyzeRelease` and
 *      friends start running — the daemon exhausts Metaspace, throws a
 *      flood of `RMI TCP Connection(idle) java.lang.OutOfMemoryError`
 *      exceptions, and never recovers. We raise heap to 6 GiB and
 *      Metaspace to 2 GiB.
 *
 *   2. Disable Lint on release builds. `lintVitalRelease` is a
 *      code-quality pass, not a correctness pass, and several upstream
 *      Expo modules (expo-updates, expo-modules-core,
 *      react-native-async-storage) currently report lint warnings that
 *      Gradle treats as fatal in release. Skipping it cuts ~5 min off
 *      the build and removes the OOM trigger entirely. Crashlytics,
 *      ProGuard/R8, and runtime behavior are unaffected.
 *
 *   3. Fix FCM notification-color manifest merger conflict. Both
 *      `expo-notifications` (which generates `@color/notification_icon_color`)
 *      and `@react-native-firebase/messaging` (which ships `@color/white`)
 *      declare `com.google.firebase.messaging.default_notification_color` in
 *      their AndroidManifest contributions. Gradle's manifest merger rejects
 *      the duplicate unless one side carries `tools:replace="android:resource"`.
 *      We add that attribute to the app-level entry so our colour wins.
 *
 * All changes only apply to CI/local production builds — running the
 * app via `expo start` doesn't go through Gradle assembleRelease, so
 * developer DX is unchanged.
 */
const withAndroidBuildFixes = (config) => {
  config = withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const setProp = (key, value) => {
      const existing = props.find(
        (p) => p.type === "property" && p.key === key,
      );
      if (existing) {
        existing.value = value;
      } else {
        props.push({ type: "property", key, value });
      }
    };
    setProp(
      "org.gradle.jvmargs",
      "-Xmx6g -XX:MaxMetaspaceSize=2g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8",
    );
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") return cfg;
    if (cfg.modResults.contents.includes("// with-android-build-fixes:lint")) {
      return cfg;
    }
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /android\s*\{/,
      `android {
    // with-android-build-fixes:lint — skip lintVitalRelease to avoid
    // OOM during :expo-modules-core / :expo-updates lint analysis.
    lint {
        checkReleaseBuilds false
        abortOnError false
    }`,
    );
    return cfg;
  });

  // Fix #3 — FCM notification-color manifest merger conflict.
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Ensure the tools namespace is declared on the root <manifest> element.
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    const application = manifest.application?.[0];
    if (application) {
      const metaDataList = application["meta-data"] ?? [];
      const fcmColorEntry = metaDataList.find(
        (m) =>
          m.$?.["android:name"] ===
          "com.google.firebase.messaging.default_notification_color",
      );
      if (fcmColorEntry) {
        // Tell the merger to use our value and discard the library's.
        fcmColorEntry.$["tools:replace"] = "android:resource";
      }
    }

    return cfg;
  });

  return config;
};

module.exports = withAndroidBuildFixes;
