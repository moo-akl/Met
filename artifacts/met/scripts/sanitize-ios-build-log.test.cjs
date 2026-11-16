"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { sanitizeLine } = require("./sanitize-ios-build-log.cjs");

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
    "Native compile error: unresolved symbol (App.swift:42).",
  );
  assert.equal(
    sanitizeLine("/private/path/App.ts:4:2: error TS2322: secret details"),
    "TypeScript compile error (TS2322).",
  );
});

test("includes short safe details for otherwise unknown compiler diagnostics", () => {
  assert.equal(
    sanitizeLine(
      "/private/path/ExpoModulesProvider.swift:18:9: error: could not construct module dependency graph for ExpoModulesCore",
    ),
    "Native compile error: other compiler diagnostic (ExpoModulesProvider.swift:18): could not construct module dependency graph for ExpoModulesCore.",
  );
});

test("reports only allowlisted native provider checks", () => {
  assert.equal(
    sanitizeLine("[MET_EXPO_PROVIDER_CHECK] ValidatorInstalled=present"),
    "iOS provider check: instrumentation installed.",
  );
  assert.equal(
    sanitizeLine("[MET_EXPO_PROVIDER_CHECK] ValidatorInstalled=failed"),
    "iOS provider check: instrumentation could not be installed.",
  );
  assert.equal(
    sanitizeLine("[MET_EXPO_PROVIDER_CHECK] Target=matched"),
    "iOS provider check: app target matched.",
  );
  assert.equal(
    sanitizeLine("[MET_EXPO_PROVIDER_CHECK] ExpoLinkingModule=present"),
    "iOS provider check: ExpoLinkingModule present.",
  );
  assert.equal(
    sanitizeLine("[MET_EXPO_PROVIDER_CHECK] SplashScreenModule=missing"),
    "iOS provider check: SplashScreenModule missing.",
  );
  assert.equal(
    sanitizeLine("[MET_EXPO_PROVIDER_CHECK] Generated provider is missing required entries."),
    "iOS provider check: validation failed.",
  );
  assert.equal(
    sanitizeLine("[MET_EXPO_PROVIDER_CHECK] ExpoLinkingModule=present /private/path/App.swift"),
    null,
  );
  assert.equal(
    sanitizeLine("\u001b[32m› [MET_EXPO_PROVIDER_CHECK] ExpoLinkingModule=present\u001b[39m"),
    "iOS provider check: ExpoLinkingModule present.",
  );
  assert.equal(
    sanitizeLine("Build output: [MET_EXPO_PROVIDER_CHECK] Target=matched"),
    "iOS provider check: app target matched.",
  );
});

test("suppresses credential-like details inside compiler diagnostics", () => {
  const credentialDiagnostic =
    "/private/path/App.swift:10: error: token rejected for secret-value";
  const opaqueDiagnostic = `/private/path/App.swift:11: error: ${"A".repeat(64)}`;

  assert.equal(
    sanitizeLine(credentialDiagnostic),
    "Native compile error: other compiler diagnostic (App.swift:10).",
  );
  assert.equal(
    sanitizeLine(opaqueDiagnostic),
    "Native compile error: other compiler diagnostic (App.swift:11).",
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
    "Native compile error: unresolved symbol (App.java:17).",
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