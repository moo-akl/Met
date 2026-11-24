"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  sanitizeLine,
  sanitizeTurboModulePatchMarker,
} = require("./sanitize-ios-build-log.cjs");

test("sanitizes known build-stage progress without retaining its input", () => {
  assert.equal(
    sanitizeLine("[INSTALL_PODS] Installing pods for app.met.founders"),
    "Build stage: installing iOS dependencies.",
  );
  assert.equal(
    sanitizeLine("✔ Build completed with secret-value"),
    "Build stage: build process completed.",
  );
});

test("reports signing diagnostics and safe compiler summaries", () => {
  assert.equal(
    sanitizeLine("Provisioning profile 'private-profile-name' is invalid"),
    "Signing diagnostic: provisioning profile issue.",
  );
  assert.equal(
    sanitizeLine("/private/path/App.swift:42:9: error: cannot find 'secretSymbol' in scope"),
    "Native compile error: unresolved symbol: cannot find 'secretSymbol' in scope (App.swift:42).",
  );
  assert.equal(
    sanitizeLine(
      "/Users/runner/work/Met/App.mm:12:3: error: use of undeclared identifier 'RCTThing'",
    ),
    "Native compile error: unresolved symbol: use of undeclared identifier 'RCTThing' (App.mm:12).",
  );
  assert.equal(
    sanitizeLine(
      "/private/path/App.mm:12:3: error: module map at /private/runner/build/module.modulemap not found; see https://private.example/log",
    ),
    "Native compile error: missing build input: module map at [path] not found; see [url] (App.mm:12).",
  );
  assert.equal(
    sanitizeLine(
      "/private/path/App.mm:12:3: error: API_KEY=do-not-print-this-value",
    ),
    "Native compile error: other compiler diagnostic (App.mm:12).",
  );
  assert.equal(
    sanitizeLine("/private/path/App.ts:4:2: error TS2322: secret details"),
    "TypeScript compile error (TS2322).",
  );
});

test("reports safe CocoaPods failure categories without exposing raw diagnostics", () => {
  assert.equal(
    sanitizeLine(
      "[!] CocoaPods could not find compatible versions for pod 'Firebase/Auth' in /private/build/Podfile",
    ),
    "CocoaPods dependency version conflict.",
  );
  assert.equal(
    sanitizeLine(
      "[!] Unable to find a specification for `PrivatePod` depended upon by a private target",
    ),
    "CocoaPods could not find a required podspec.",
  );
  assert.equal(
    sanitizeLine(
      "Specs satisfying the `Firebase` dependency were found, but they required a higher minimum deployment target.",
    ),
    "CocoaPods deployment target conflict.",
  );
  assert.equal(
    sanitizeLine(
      "[!] Invalid Podfile file: private source path /private/build/Podfile",
    ),
    "CocoaPods Podfile parsing failed.",
  );
  assert.equal(
    sanitizeLine(
      "[!] CDN: trunk URL couldn't be downloaded: https://private.example/specs",
    ),
    "CocoaPods spec source or network request failed.",
  );
  assert.equal(
    sanitizeLine("CocoaPods encountered an unrecognized private diagnostic"),
    null,
  );
});

test("suppresses private keys, encoded credentials, environment output, JSON, and unknown lines", () => {
  const sensitiveLines = [
    "-----BEGIN PRIVATE KEY-----",
    "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...",
    "A".repeat(64),
    "-----END PRIVATE KEY-----",
    "EXPO_TOKEN=ghp_example-secret-token",
    "EXPO_ASC_API_KEY_PATH=/private/runner/AuthKey_secret.p8",
    "EXPO_ASC_ISSUER_ID=private-issuer-id",
    '{"authorization":"Bearer secret-token","privateKey":"secret-key"}',
    "eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiJzZWNyZXQifQ.signature-secret",
    "unrecognized build output that may include credentials",
  ];

  for (const line of sensitiveLines) {
    assert.equal(sanitizeLine(line), null, "credential-like input must be suppressed");
  }
});

test("sanitizes only allowlisted Expo provider markers", () => {
  assert.equal(
    sanitizeLine("[MET_EXPO_PROVIDER_CHECK] ProviderGeneration=present"),
    "iOS provider check: generated provider file found.",
  );
  assert.equal(
    sanitizeLine("[MET_EXPO_PROVIDER_CHECK] Target=matched"),
    "iOS provider check: expected app target matched.",
  );
  assert.equal(
    sanitizeLine("[MET_EXPO_PROVIDER_CHECK] ExpoLinkingModule=missing"),
    "iOS provider check: ExpoLinkingModule missing.",
  );
  assert.equal(
    sanitizeLine("[MET_EXPO_PROVIDER_CHECK] RuntimeRegistration=notchecked"),
    "iOS provider check: runtime registration was not measured.",
  );
  assert.equal(
    sanitizeLine("[MET_EXPO_PROVIDER_CHECK] ProviderGeneration=unavailable"),
    "iOS provider check: provider capture was unavailable.",
  );
  assert.equal(
    sanitizeLine(
      "\u001b[32mBuild output: [MET_EXPO_PROVIDER_CHECK] SplashScreenModule=present\u001b[39m",
    ),
    "iOS provider check: SplashScreenModule present.",
  );
  assert.equal(
    sanitizeLine("[MET_EXPO_PROVIDER_CHECK] Target=/private/build/Pods-Met"),
    null,
  );
  assert.equal(
    sanitizeLine(
      "[MET_EXPO_PROVIDER_CHECK] ExpoLinkingModule=present /private/build/source.swift",
    ),
    null,
  );
  assert.equal(
    sanitizeLine(
      "[MET_EXPO_PROVIDER_CHECK] ExpoLinkingModule=present EXPO_TOKEN=secret",
    ),
    null,
  );
});

test("reports only allowlisted TurboModule patch states", () => {
  assert.equal(
    sanitizeTurboModulePatchMarker("[MET_TURBOMODULE_PATCH] Applied"),
    "iOS TurboModule patch: applied.",
  );
  assert.equal(
    sanitizeTurboModulePatchMarker("[MET_TURBOMODULE_PATCH] AlreadyApplied"),
    "iOS TurboModule patch: already applied.",
  );
  assert.equal(
    sanitizeTurboModulePatchMarker(
      "[MET_TURBOMODULE_PATCH] Applied /private/path",
    ),
    null,
  );
  assert.equal(
    sanitizeLine("[MET_TURBOMODULE_PATCH] Applied"),
    "iOS TurboModule patch: applied.",
  );
});

test("reports Android stages, Gradle tasks, and safe native locations", () => {
  assert.equal(
    sanitizeLine("[RUN_GRADLEW] Running Gradle with private-job-details"),
    "Build stage: compiling the Android app.",
  );
  assert.equal(
    sanitizeLine("e: file:///private/MetBleModule.kt:42:9 Unresolved reference 'privateSymbol'"),
    "Native compile error: unresolved symbol (MetBleModule.kt:42).",
  );
  assert.equal(
    sanitizeLine("[RUN_GRADLEW] e: file:///private/MetBleModule.kt:42:9 Unresolved reference 'privateSymbol'"),
    "Native compile error: unresolved symbol (MetBleModule.kt:42).",
  );
  assert.equal(
    sanitizeLine("app/src/main/java/App.java:17: error: cannot find symbol"),
    "Native compile error: unresolved symbol: cannot find symbol (App.java:17).",
  );
  assert.equal(
    sanitizeLine("Execution failed for task ':app:compileReleaseKotlin'. Details omitted."),
    "Gradle task failed: :app:compileReleaseKotlin.",
  );
  assert.equal(
    sanitizeLine("FAILURE: Build failed with an exception."),
    "Gradle build failed.",
  );
  assert.equal(
    sanitizeLine("e: file:///private/CameraModule.kt:9:12 Type mismatch: expected String, got Boolean"),
    "Native compile error: type mismatch (CameraModule.kt:9).",
  );
});