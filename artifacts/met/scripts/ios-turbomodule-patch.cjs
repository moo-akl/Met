"use strict";

const fs = require("node:fs");
const path = require("node:path");

const TURBOMODULE_SOURCE_PARTS = [
  "ReactCommon",
  "react",
  "nativemodule",
  "core",
  "platform",
  "ios",
  "ReactCommon",
  "RCTTurboModule.mm",
];

const VOID_METHOD_START =
  "void ObjCTurboModule::performVoidMethodInvocation(";
const VOID_METHOD_END =
  "\njsi::Value ObjCTurboModule::convertReturnIdToJSIValue(";
const OLD_LINE =
  "throw convertNSExceptionToJSError(runtime, exception, std::string{moduleName}, methodNameStr);";
const PATCH_MARKER = "PATCH(with-ios-turbomodule-patch)";
const REPLACEMENT = [
  `// ${PATCH_MARKER}: Do NOT rethrow NSExceptions from void`,
  "      // async TurboModule methods — causes uncatchable C++ exception on background",
  "      // queues → SIGABRT on iOS 26 (Xcode 16.3+ build images).",
  "      // See: https://github.com/facebook/react-native/issues/54859",
  '      RCTLogError(@"[TurboModule] Exception in void method %s::%s - %@",',
  "                  moduleName, methodNameStr.c_str(), exception);",
].join("\n");

function findReactNativeTurboModuleSource(appRoot) {
  let packageJsonPath;
  try {
    packageJsonPath = require.resolve("react-native/package.json", {
      paths: [appRoot],
    });
  } catch {
    throw new Error(
      "[ios-turbomodule-patch] Could not resolve React Native from the Met app root.",
    );
  }

  const sourcePath = path.join(
    path.dirname(packageJsonPath),
    ...TURBOMODULE_SOURCE_PARTS,
  );
  if (!fs.existsSync(sourcePath)) {
    throw new Error(
      "[ios-turbomodule-patch] React Native's RCTTurboModule.mm source was not found.",
    );
  }
  return sourcePath;
}

function patchTurboModuleSource(source) {
  const methodStart = source.indexOf(VOID_METHOD_START);
  if (methodStart < 0) {
    throw new Error(
      "[ios-turbomodule-patch] performVoidMethodInvocation was not found.",
    );
  }

  const methodEnd = source.indexOf(VOID_METHOD_END, methodStart);
  if (methodEnd < 0) {
    throw new Error(
      "[ios-turbomodule-patch] The end of performVoidMethodInvocation was not found.",
    );
  }

  const method = source.slice(methodStart, methodEnd);
  if (method.includes(PATCH_MARKER) && !method.includes(OLD_LINE)) {
    return { source, status: "already-patched" };
  }

  const targetCount = method.split(OLD_LINE).length - 1;
  if (targetCount !== 1) {
    throw new Error(
      `[ios-turbomodule-patch] Expected one exception rethrow in performVoidMethodInvocation; found ${targetCount}.`,
    );
  }

  const patchedMethod = method.replace(OLD_LINE, REPLACEMENT);
  if (
    !patchedMethod.includes(PATCH_MARKER) ||
    patchedMethod.includes(OLD_LINE)
  ) {
    throw new Error(
      "[ios-turbomodule-patch] The void-method exception guard did not apply.",
    );
  }

  return {
    source:
      source.slice(0, methodStart) +
      patchedMethod +
      source.slice(methodEnd),
    status: "patched",
  };
}

function patchReactNativeTurboModule(appRoot) {
  const sourcePath = findReactNativeTurboModuleSource(appRoot);
  const original = fs.readFileSync(sourcePath, "utf8");
  const result = patchTurboModuleSource(original);
  if (result.status === "patched") {
    fs.writeFileSync(sourcePath, result.source, "utf8");
  }

  const verified = fs.readFileSync(sourcePath, "utf8");
  const verifyStart = verified.indexOf(VOID_METHOD_START);
  const verifyEnd = verified.indexOf(VOID_METHOD_END, verifyStart);
  const verifiedMethod = verified.slice(verifyStart, verifyEnd);
  if (
    !verifiedMethod.includes(PATCH_MARKER) ||
    verifiedMethod.includes(OLD_LINE)
  ) {
    throw new Error(
      "[ios-turbomodule-patch] The compiled void-method source failed verification.",
    );
  }

  return { sourcePath, status: result.status };
}

module.exports = {
  findReactNativeTurboModuleSource,
  patchReactNativeTurboModule,
  patchTurboModuleSource,
};
