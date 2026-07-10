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

  return config;
};

module.exports = withTikTokAndroid;
