"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const {
  findReactNativeTurboModuleSource,
  patchReactNativeTurboModule,
  patchTurboModuleSource,
} = require("./ios-turbomodule-patch.cjs");

const OLD_LINE =
  "throw convertNSExceptionToJSError(runtime, exception, std::string{moduleName}, methodNameStr);";
const PATCH_MARKER = "PATCH(with-ios-turbomodule-patch)";

function fixtureSource() {
  return [
    "void ObjCTurboModule::performMethodInvocation() {",
    `  ${OLD_LINE}`,
    "}",
    "void ObjCTurboModule::performVoidMethodInvocation() {",
    `  ${OLD_LINE}`,
    "}",
    "jsi::Value ObjCTurboModule::convertReturnIdToJSIValue(",
  ].join("\n");
}

test("patches the void method, not the earlier promise-method occurrence", () => {
  const result = patchTurboModuleSource(fixtureSource());
  const promiseMethod = result.source.slice(
    0,
    result.source.indexOf("void ObjCTurboModule::performVoidMethodInvocation("),
  );
  const voidMethod = result.source.slice(
    result.source.indexOf("void ObjCTurboModule::performVoidMethodInvocation("),
  );

  assert.equal(result.status, "patched");
  assert.ok(promiseMethod.includes(OLD_LINE));
  assert.ok(!promiseMethod.includes(PATCH_MARKER));
  assert.ok(voidMethod.includes(PATCH_MARKER));
  assert.ok(voidMethod.includes("RCTLogError"));
  assert.ok(!voidMethod.includes(OLD_LINE));
});

test("patching is idempotent", () => {
  const first = patchTurboModuleSource(fixtureSource());
  const second = patchTurboModuleSource(first.source);
  assert.equal(first.status, "patched");
  assert.equal(second.status, "already-patched");
  assert.equal(second.source, first.source);
});

test("refuses an unexpected React Native source shape", () => {
  assert.throws(
    () =>
      patchTurboModuleSource(
        "void ObjCTurboModule::performVoidMethodInvocation() {}\n" +
          "jsi::Value ObjCTurboModule::convertReturnIdToJSIValue(",
      ),
    /Expected one exception rethrow/,
  );
  assert.throws(
    () => patchTurboModuleSource("void ObjCTurboModule::performMethodInvocation() {}"),
    /performVoidMethodInvocation was not found/,
  );
});

test("resolves React Native source through the app's pnpm dependency link", () => {
  const appRoot = path.resolve(__dirname, "..");
  const sourcePath = findReactNativeTurboModuleSource(appRoot);
  assert.equal(path.basename(sourcePath), "RCTTurboModule.mm");
  assert.ok(fs.existsSync(sourcePath));
});

test("patches the installed React Native source only inside the void method", () => {
  const appRoot = path.resolve(__dirname, "..");
  const sourcePath = findReactNativeTurboModuleSource(appRoot);
  const source = fs.readFileSync(sourcePath, "utf8");
  const result = patchTurboModuleSource(source);
  const promiseMethod = result.source.slice(
    0,
    result.source.indexOf("void ObjCTurboModule::performVoidMethodInvocation("),
  );
  const voidMethod = result.source.slice(
    result.source.indexOf("void ObjCTurboModule::performVoidMethodInvocation("),
  );

  assert.equal(result.status, "patched");
  assert.ok(promiseMethod.includes(OLD_LINE));
  assert.ok(!promiseMethod.includes(PATCH_MARKER));
  assert.ok(voidMethod.includes(PATCH_MARKER));
  assert.ok(!voidMethod.includes(OLD_LINE));
});

test("file patch writes and verifies the scoped guard", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "met-turbomodule-"));
  try {
    const sourcePath = path.join(tempRoot, "RCTTurboModule.mm");
    fs.writeFileSync(sourcePath, fixtureSource());
    const packageRoot = path.join(tempRoot, "node_modules", "react-native");
    const targetPath = path.join(
      packageRoot,
      "ReactCommon",
      "react",
      "nativemodule",
      "core",
      "platform",
      "ios",
      "ReactCommon",
      "RCTTurboModule.mm",
    );
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, "package.json"),
      JSON.stringify({ name: "react-native" }),
    );
    fs.copyFileSync(sourcePath, targetPath);

    const appNodeModules = path.join(tempRoot, "app", "node_modules");
    fs.mkdirSync(appNodeModules, { recursive: true });
    fs.symlinkSync(packageRoot, path.join(appNodeModules, "react-native"), "dir");

    const result = patchReactNativeTurboModule(path.join(tempRoot, "app"));
    const patched = fs.readFileSync(targetPath, "utf8");
    assert.equal(result.status, "patched");
    assert.ok(patched.includes(PATCH_MARKER));
    assert.ok(!patched.slice(
      patched.indexOf("void ObjCTurboModule::performVoidMethodInvocation("),
    ).includes(OLD_LINE));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
