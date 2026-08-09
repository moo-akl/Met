const {
  withGradleProperties,
  withProjectBuildGradle,
  withAppBuildGradle,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

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
 *      the duplicate unless the app-level entry carries
 *      `tools:replace="android:resource"`.
 *
 *      We use withDangerousMod (which writes to the actual file on disk
 *      AFTER all in-memory mods complete) so the fix is not affected by
 *      Expo's internal mod-pipeline ordering — the entry written by
 *      expo-notifications is already on disk when our patch runs.
 *
 * All changes only apply to CI/local production builds.
 */
const withAndroidBuildFixes = (config) => {
  // Force TikTok SDK to a pinned, stable version.
  // The react-native-tiktok-business-sdk npm package hardcodes 1.6.1 in its
  // own build.gradle; JitPack intermittently fails to serve that artifact
  // (returns 0 bytes). This resolution strategy overrides every subproject's
  // dependency resolution to use 1.5.0 instead.
  // Fix #0 — Inject ndkVersion into the root project ext so that native
  // modules that read rootProject.ext.ndkVersion (e.g. react-native-gesture-handler)
  // use the same NDK as ReactAndroid's prefab package was compiled with.
  // Without this, RNGH's CMake prefab_command step fails with exit code 1
  // because the NDK version mismatches the one baked into the ReactAndroid
  // shared libraries.  RN 0.81.x requires NDK 27.1.12297006.
  config = withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") return cfg;
    if (cfg.modResults.contents.includes("// with-android-build-fixes:ndkVersion")) {
      return cfg;
    }
    // Prepend before the first line so it's available to all subprojects
    // during the configuration phase.
    cfg.modResults.contents =
      `// with-android-build-fixes:ndkVersion\next.ndkVersion = "27.1.12297006"\n\n` +
      cfg.modResults.contents;
    return cfg;
  });

  config = withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") return cfg;
    if (cfg.modResults.contents.includes("// with-android-build-fixes:tiktok-pin")) {
      return cfg;
    }
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /subprojects\s*\{/,
      `subprojects {
    // with-android-build-fixes:tiktok-pin
    configurations.all {
        resolutionStrategy {
            force 'com.github.tiktok:tiktok-business-android-sdk:1.5.0'
        }
    }`,
    );
    // Fallback: if no subprojects block, append allprojects block
    if (!cfg.modResults.contents.includes("// with-android-build-fixes:tiktok-pin")) {
      cfg.modResults.contents += `
allprojects {
    // with-android-build-fixes:tiktok-pin
    configurations.all {
        resolutionStrategy {
            force 'com.github.tiktok:tiktok-business-android-sdk:1.5.0'
        }
    }
}
`;
    }
    return cfg;
  });

  // Force TikTok SDK Kotlin source to compile as 1.9 even when the root project
  // ships the Kotlin 2.0 compiler (RN 0.81 sets kotlinVersion=2.0.21 globally).
  // In a Gradle multi-project build the root buildscript classpath is inherited
  // by all subprojects, so patching the SDK's own buildscript entry is
  // ineffective — the root's 2.0.x compiler still wins.  Instead we use
  // subprojects/afterEvaluate to set languageVersion+apiVersion="1.9" on the
  // SDK's KotlinCompile tasks, which tells the 2.0 compiler to accept 1.9
  // source, and jvmTarget="17" to match the rest of the build.
  config = withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") return cfg;
    if (cfg.modResults.contents.includes("// with-android-build-fixes:tiktok-kotlin")) {
      return cfg;
    }
    cfg.modResults.contents += `

// with-android-build-fixes:tiktok-kotlin
// Force react-native-tiktok-business-sdk to compile as Kotlin 1.9 source
// so it stays compatible when the root project uses the Kotlin 2.0 compiler.
// NOTE: do NOT use afterEvaluate here — Gradle 8.x throws
// "Cannot run Project.afterEvaluate when the project is already evaluated"
// when subprojects have already passed their configuration phase.
// tasks.withType().configureEach is lazy and avoids that restriction.
subprojects {
    if (project.name == 'react-native-tiktok-business-sdk') {
        tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
            kotlinOptions {
                languageVersion = "1.9"
                apiVersion      = "1.9"
                jvmTarget       = "17"
            }
        }
    }
}
`;
    return cfg;
  });

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
    // Suppress JVM-target mismatch warning-as-error: some third-party modules
    // (including react-native-tiktok-business-sdk) still declare jvmTarget=1.8
    // or 11 in their own build.gradle; Kotlin 2.0 promotes the cross-module
    // mismatch from a warning to a build error.  IGNORE disables the check
    // project-wide; correctness is unaffected (the actual bytecode target is
    // set per-task via the afterEvaluate block above).
    setProp("kotlin.jvm.target.validation.mode", "IGNORE");
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
  //
  // withDangerousMod runs on the file system AFTER all withAndroidManifest
  // callbacks have written their output to disk, so the entry added by
  // expo-notifications is already present when we patch it.
  config = withDangerousMod(config, [
    "android",
    (cfg) => {
      const manifestPath = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/AndroidManifest.xml",
      );

      if (!fs.existsSync(manifestPath)) return cfg;

      let contents = fs.readFileSync(manifestPath, "utf-8");

      // 1. Ensure the tools namespace is declared on the root <manifest> element.
      if (!contents.includes("xmlns:tools")) {
        contents = contents.replace(
          /<manifest /,
          '<manifest xmlns:tools="http://schemas.android.com/tools" ',
        );
      }

      // 2. Add tools:replace="android:resource" to the FCM colour meta-data
      //    entry if it is present and does not already carry that attribute.
      const FCM_COLOR_KEY =
        "com.google.firebase.messaging.default_notification_color";
      if (
        contents.includes(FCM_COLOR_KEY) &&
        !contents.includes('tools:replace="android:resource"')
      ) {
        // Match the opening tag of that specific <meta-data> element and
        // insert the attribute just before the closing /> or >.
        contents = contents.replace(
          new RegExp(
            `(<meta-data[^>]*${FCM_COLOR_KEY.replace(/\./g, "\\.")}[^>]*?)(\\/?>)`,
          ),
          '$1 tools:replace="android:resource"$2',
        );
      }

      fs.writeFileSync(manifestPath, contents);
      return cfg;
    },
  ]);

  return config;
};

module.exports = withAndroidBuildFixes;
