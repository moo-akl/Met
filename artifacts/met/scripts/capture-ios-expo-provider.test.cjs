"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const {
  captureProvider,
  inspectGeneratedProvider,
} = require("./capture-ios-expo-provider.cjs");

function createTempDirectory(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "met-ios-provider-capture-"),
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function writeProvider(root, targetName, source) {
  const providerPath = path.join(
    root,
    "project",
    "ios",
    "Pods",
    "Target Support Files",
    targetName,
    "ExpoModulesProvider.swift",
  );
  fs.mkdirSync(path.dirname(providerPath), { recursive: true });
  fs.writeFileSync(providerPath, source);
  return providerPath;
}

const completeProvider = [
  "public class ExpoModulesProvider: ModulesProvider {",
  "  override func getModuleClasses() -> [AnyModule.Type] {",
  "    return [ExpoLinkingModule.self, SplashScreenModule.self]",
  "  }",
  "}",
].join("\n");

test("captures the actual generated provider for the Met target", (t) => {
  const root = createTempDirectory(t);
  writeProvider(root, "Pods-Met", completeProvider);

  const result = inspectGeneratedProvider(root);
  assert.deepEqual(result, {
    generation: "present",
    target: "matched",
    provider: "present",
    linking: "present",
    splashScreen: "present",
  });

  const reportPath = path.join(root, "safe", "provider-report.txt");
  const capture = captureProvider(root, reportPath);
  assert.equal(capture.reportWritten, true);
  assert.deepEqual(fs.readFileSync(reportPath, "utf8"), capture.report);
  assert.match(capture.report, /ExpectedTarget=Pods-Met/);
  assert.match(capture.report, /ExpoLinkingModule=present/);
  assert.match(capture.report, /SplashScreenModule=present/);
  assert.match(capture.report, /RuntimeRegistration=notchecked/);
  assert.ok(
    capture.markers.every((line) =>
      line.startsWith("[MET_EXPO_PROVIDER_CHECK] "),
    ),
  );
});

test("reports a missing module without replacing the other provider results", (t) => {
  const root = createTempDirectory(t);
  writeProvider(
    root,
    "Pods-Met",
    "class ExpoModulesProvider {}\nSplashScreenModule.self",
  );

  assert.deepEqual(inspectGeneratedProvider(root), {
    generation: "present",
    target: "matched",
    provider: "present",
    linking: "missing",
    splashScreen: "present",
  });
});

test("reports malformed provider text without copying its contents", (t) => {
  const root = createTempDirectory(t);
  writeProvider(root, "Pods-Met", "EXPO_TOKEN=must-not-appear\nnot Swift");

  const capture = captureProvider(root, path.join(root, "provider-report.txt"));
  assert.deepEqual(capture.result, {
    generation: "present",
    target: "matched",
    provider: "missing",
    linking: "missing",
    splashScreen: "missing",
  });
  assert.doesNotMatch(capture.report, /EXPO_TOKEN|must-not-appear|not Swift/);
  assert.ok(capture.markers.every((line) => !/must-not-appear/.test(line)));
});

test("does not reveal an unexpected CocoaPods target name", (t) => {
  const root = createTempDirectory(t);
  writeProvider(root, "Pods-OtherTarget", completeProvider);

  const capture = captureProvider(root, path.join(root, "provider-report.txt"));
  assert.equal(capture.result.target, "unexpected");
  assert.equal(capture.result.linking, "present");
  assert.doesNotMatch(capture.report, /OtherTarget/);
});

test("reports an unavailable capture when the build workspace is missing", (t) => {
  const root = createTempDirectory(t);
  const capture = captureProvider(
    path.join(root, "missing-build-workspace"),
    path.join(root, "provider-report.txt"),
  );

  assert.deepEqual(capture.result, {
    generation: "unavailable",
    target: "unavailable",
    provider: "missing",
    linking: "missing",
    splashScreen: "missing",
  });
  assert.match(capture.report, /ProviderGeneration=unavailable/);
  assert.doesNotMatch(capture.report, /missing-build-workspace/);
});

test("reports a missing generated provider separately from an unreadable workspace", (t) => {
  const root = createTempDirectory(t);
  const capture = captureProvider(root, path.join(root, "provider-report.txt"));

  assert.deepEqual(capture.result, {
    generation: "failed",
    target: "unavailable",
    provider: "missing",
    linking: "missing",
    splashScreen: "missing",
  });
  assert.match(capture.report, /ProviderGeneration=failed/);
});
