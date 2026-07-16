const {
  withProjectBuildGradle,
  withAppBuildGradle,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * with-tiktok-android
 *
 * Injects TikTok Business SDK into the Android native build:
 *   1. Adds JitPack repository to project-level build.gradle
 *   2. Adds SDK + lifecycle + install-referrer dependencies to app/build.gradle
 *   3. Adds ProGuard rules to proguard-rules.pro
 *   4. Patches the SDK's own build.gradle to pin Kotlin 1.9.25 (RN 0.81 uses
 *      Kotlin 2.0.x globally, which breaks the SDK's Kotlin source)
 */
const withTikTokAndroid = (config) => {
  // 1. Add JitPack to project-level build.gradle
  config = withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") return cfg;
    if (cfg.modResults.contents.includes("jitpack.io")) return cfg;

    cfg.modResults.contents = cfg.modResults.contents.replace(
      /maven\s*\{\s*url\s*['"]https:\/\/maven\.google\.com['"]\s*\}/,
      (match) =>
        `${match}
        maven { url 'https://jitpack.io' } // TikTok Business SDK`,
    );

    // Fallback: append to first repositories block if google() not found
    if (!cfg.modResults.contents.includes("jitpack.io")) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /repositories\s*\{/,
        `repositories {
        maven { url 'https://jitpack.io' } // TikTok Business SDK`,
      );
    }

    return cfg;
  });

  // 2. Add SDK dependencies to app/build.gradle
  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") return cfg;
    if (cfg.modResults.contents.includes("tiktok-business-android-sdk")) {
      return cfg;
    }

    cfg.modResults.contents = cfg.modResults.contents.replace(
      /dependencies\s*\{/,
      `dependencies {
    // TikTok Business SDK
    implementation 'com.github.tiktok:tiktok-business-android-sdk:1.5.0'
    implementation 'androidx.lifecycle:lifecycle-process:2.3.1'
    implementation 'androidx.lifecycle:lifecycle-common-java8:2.3.1'
    implementation 'com.android.installreferrer:installreferrer:2.2'`,
    );

    return cfg;
  });

  // 3. Add ProGuard rules
  config = withDangerousMod(config, [
    "android",
    (cfg) => {
      const proguardPath = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/proguard-rules.pro",
      );

      if (!fs.existsSync(proguardPath)) return cfg;

      const contents = fs.readFileSync(proguardPath, "utf-8");
      if (contents.includes("com.tiktok.**")) return cfg;

      const rules = `
# TikTok Business SDK
-keep class com.tiktok.** { *; }
-keep class com.android.billingclient.api.** { *; }
-keep class androidx.lifecycle.** { *; }
`;
      fs.writeFileSync(proguardPath, contents + rules);
      return cfg;
    },
  ]);

  // 4. Patch the TikTok SDK's own build.gradle to hardcode Kotlin 1.9.25.
  //
  //    Why: react-native-tiktok-business-sdk's build.gradle uses
  //    getExtOrDefault('kotlinVersion') which first checks rootProject.ext.kotlinVersion.
  //    RN 0.81 sets that ext var to "2.0.21" globally, so the TikTokBusiness_kotlinVersion
  //    gradle.properties fallback is never reached. Kotlin 2.0.x breaks the SDK's source.
  //
  //    Fix: resolve the pnpm symlink to the real build.gradle file and rewrite
  //    the two dynamic version lookups to the literal "1.9.25". This runs during
  //    expo prebuild (before Gradle reads the file), and pnpm reinstalls on every
  //    EAS build so the patched file is fresh on every run.
  config = withDangerousMod(config, [
    "android",
    (cfg) => {
      const symlink = path.join(
        cfg.modRequest.projectRoot,
        "node_modules",
        "react-native-tiktok-business-sdk",
        "android",
        "build.gradle",
      );

      // Resolve through pnpm symlink to the real file
      let realPath;
      try {
        realPath = fs.realpathSync(symlink);
      } catch (_) {
        // SDK not found — nothing to patch
        return cfg;
      }

      let contents = fs.readFileSync(realPath, "utf-8");

      // Already patched on a previous run (shouldn't happen in EAS but be safe)
      if (contents.includes("1.9.25")) return cfg;

      // Replace the classpath version lookup
      contents = contents.replace(
        /classpath "org\.jetbrains\.kotlin:kotlin-gradle-plugin:\$\{getExtOrDefault\('kotlinVersion'\)\}"/g,
        'classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25"',
      );

      // Replace the stdlib version lookup
      contents = contents.replace(
        /def kotlin_version = getExtOrDefault\("kotlinVersion"\)/g,
        'def kotlin_version = "1.9.25"',
      );

      fs.writeFileSync(realPath, contents);
      return cfg;
    },
  ]);

  // 5. Patch TikTokBusinessModule.kt: comment out `configBuilder.disableAutoIapTrack()`
  //    which references a method that does not exist in the native SDK version used
  //    (react-native-tiktok-business-sdk 1.6.x vs the JitPack 1.5.x native AAR).
  config = withDangerousMod(config, [
    "android",
    (cfg) => {
      const ktSymlink = path.join(
        cfg.modRequest.projectRoot,
        "node_modules",
        "react-native-tiktok-business-sdk",
        "android",
        "src",
        "main",
        "java",
        "com",
        "tiktokbusiness",
        "TikTokBusinessModule.kt",
      );

      let ktPath;
      try {
        ktPath = fs.realpathSync(ktSymlink);
      } catch (_) {
        return cfg;
      }

      let kt = fs.readFileSync(ktPath, "utf-8");
      if (kt.includes("// configBuilder.disableAutoIapTrack")) return cfg;

      kt = kt.replace(
        "configBuilder.disableAutoIapTrack()",
        "// configBuilder.disableAutoIapTrack() // method removed in native SDK 1.5.x",
      );

      fs.writeFileSync(ktPath, kt);
      return cfg;
    },
  ]);

  return config;
};

module.exports = withTikTokAndroid;
