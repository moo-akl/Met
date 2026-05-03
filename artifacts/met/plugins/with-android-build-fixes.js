const { withGradleProperties, withAppBuildGradle } = require("expo/config-plugins");

/**
 * with-android-build-fixes
 *
 * Two production-build fixes that together turn a 1h30 OOM-and-time-out
 * into a clean ~20-25 min Android build on the free GitHub Actions Linux
 * runner (16 GB RAM):
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
 * Both changes only apply to CI/local production builds — running the
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

  return config;
};

module.exports = withAndroidBuildFixes;
