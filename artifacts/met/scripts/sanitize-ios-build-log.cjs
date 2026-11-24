"use strict";

const readline = require("node:readline");

const MAX_LINE_LENGTH = 16_384;
const MAX_NATIVE_DIAGNOSTIC_LENGTH = 180;

const ANSI_ESCAPE = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const SENSITIVE_NATIVE_DIAGNOSTIC = [
  /\b(?:API[_ -]?KEY|ACCESS[_ -]?TOKEN|AUTHORIZATION|PASSWORD|SECRET|PRIVATE[_ -]?KEY|CREDENTIAL)\b\s*[:=]\s*\S+/i,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i,
  /\b(?:gh[pousr]_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]{12,}/i,
  /\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/,
  /\b[A-Za-z0-9+/]{48,}={0,2}\b/,
  /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/i,
];

const STAGE_MARKERS = new Map([
  ["PREPARE", "Build stage: preparing the project."],
  ["PREBUILD", "Build stage: generating native projects."],
  ["RUN_EXPO_DOCTOR", "Build stage: checking project configuration."],
  ["INSTALL_PODS", "Build stage: installing iOS dependencies."],
  ["INSTALL_COCOAPODS", "Build stage: installing iOS dependencies."],
  ["RUN_GRADLEW", "Build stage: compiling the Android app."],
  ["BUNDLE_JS", "Build stage: bundling JavaScript."],
  ["EXPO_EXPORT", "Build stage: exporting the app."],
  ["XCODE_BUILD", "Build stage: compiling the iOS app."],
  ["BUILD", "Build stage: compiling the iOS app."],
  ["ARCHIVE", "Build stage: archiving the iOS app."],
  ["SIGNING", "Build stage: signing the iOS app."],
  ["PACKAGE", "Build stage: packaging the iOS app."],
]);

const SIGNING_DIAGNOSTICS = [
  [/provisioning[ -]?profile/i, "Signing diagnostic: provisioning profile issue."],
  [/distribution certificate|signing certificate|certificate.{0,40}(?:expired|invalid|not found)/i, "Signing diagnostic: certificate issue."],
  [/code[ -]?sign(?:ing)?|codesign/i, "Signing diagnostic: code signing issue."],
];

const NATIVE_DIAGNOSTICS = [
  [/no such module|could not find module|cannot find module|package .+ does not exist/i, "missing module dependency"],
  [/cannot find .* in scope|cannot find symbol|undeclared identifier|unresolved reference|unresolved identifier/i, "unresolved symbol"],
  [/does not conform to protocol/i, "protocol conformance"],
  [/ambiguous use of|reference is ambiguous/i, "ambiguous reference"],
  [/build input file cannot be found|module map.*not found|no such file or directory|file not found/i, "missing build input"],
  [/incompatible types|type mismatch|cannot be applied to given types/i, "type mismatch"],
  [/duplicate class|redeclaration|redeclared|already defined/i, "duplicate declaration"],
  [/android resource linking failed|no resource found|resource .+ not found/i, "Android resource linking"],
  [/no value passed for parameter|too many arguments|wrong number of arguments/i, "argument mismatch"],
  [/cannot access|is not public|visibility/i, "access restriction"],
];

const COCOAPODS_DIAGNOSTICS = [
  [
    /could not find compatible versions for pod/i,
    "CocoaPods dependency version conflict.",
  ],
  [
    /unable to find a specification for|none of your spec sources contain a spec satisfying/i,
    "CocoaPods could not find a required podspec.",
  ],
  [
    /higher minimum deployment target|deployment target.*(?:required|higher|conflict)/i,
    "CocoaPods deployment target conflict.",
  ],
  [
    /cannot yet be integrated as static librar(?:y|ies)|static framework.*(?:conflict|incompatib)/i,
    "CocoaPods static framework integration conflict.",
  ],
  [
    /invalid podfile|podfile.*syntax error|syntax error.*podfile/i,
    "CocoaPods Podfile parsing failed.",
  ],
  [
    /post_install hook.*(?:error|fail)|error.*processing.*post_install|post-install hook/i,
    "CocoaPods post-install hook failed.",
  ],
  [
    /CDN:.*(?:couldn't|could not) be downloaded|could not connect to server|could not resolve host|connection reset|timed out|SSL_connect/i,
    "CocoaPods spec source or network request failed.",
  ],
  [
    /\[!\]\s*Error installing\b|pod install.*(?:failed|error)/i,
    "CocoaPods dependency installation failed.",
  ],
];

function isSensitiveFormat(line) {
  const trimmed = line.trim();
  return (
    trimmed.length === 0 ||
    /^-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/.test(trimmed) ||
    /^-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/.test(trimmed) ||
    /^[A-Za-z0-9+/]{48,}={0,2}$/.test(trimmed) ||
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed) ||
    /^[A-Z_][A-Z0-9_]{1,80}\s*=/.test(trimmed) ||
    /\b[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PRIVATE_KEY|API_KEY|KEY_ID)[A-Z0-9_]*\s*=/i.test(line) ||
    /^\s*\{/.test(trimmed) ||
    /^\s*\[\s*(?:\{|"|-?\d|true\b|false\b|null\b|\])/.test(trimmed)
  );
}

function getNativeSourceLocation(line) {
  const match = line.match(
    /(?:file:\/\/)?(?:[^\s:]*(?:\/|\\))?([^/\\:\s]+\.(?:kt|java|kts|cpp|c|cc|h|mm|m|swift)):\s*(?:\((\d+)(?:,\s*\d+)?\)|(\d+)(?::\d+)?)/i,
  );
  if (!match) return null;
  const lineNumber = match[2] ?? match[3];
  return `${match[1]}:${lineNumber}`;
}

function sanitizeNativeDiagnostic(line) {
  const match = line.match(/\b(?:fatal\s+)?error:\s*(.*)$/i);
  if (!match) return null;

  let diagnostic = match[1].trim();
  if (
    !diagnostic ||
    SENSITIVE_NATIVE_DIAGNOSTIC.some((pattern) => pattern.test(diagnostic))
  ) {
    return null;
  }

  diagnostic = diagnostic
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[url]")
    .replace(/\b[A-Z]:\\[^\s"'<>]+/gi, "[path]")
    .replace(/\/[^\s"'<>]+/g, "[path]")
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[email]",
    )
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!diagnostic) return null;
  if (diagnostic.length > MAX_NATIVE_DIAGNOSTIC_LENGTH) {
    diagnostic = `${diagnostic.slice(0, MAX_NATIVE_DIAGNOSTIC_LENGTH - 1)}…`;
  }
  return diagnostic;
}

function summarizeNativeCompileError(line) {
  const diagnostic = line.replace(/^.*?\b(?:fatal\s+)?error:\s*/i, "");
  const category =
    NATIVE_DIAGNOSTICS.find(([pattern]) => pattern.test(diagnostic))?.[1] ??
    "other compiler diagnostic";
  const location = getNativeSourceLocation(line);
  const suffix = location ? ` (${location})` : "";
  const safeDiagnostic = sanitizeNativeDiagnostic(line);
  const detail = safeDiagnostic ? `: ${safeDiagnostic}` : "";
  return `Native compile error: ${category}${detail}${suffix}.`;
}

function sanitizeExpoProviderMarker(line) {
  const normalizedLine = line.replace(ANSI_ESCAPE, "");
  const markerIndex = normalizedLine.lastIndexOf("[MET_EXPO_PROVIDER_CHECK]");
  if (markerIndex < 0) return null;

  const markerLine = normalizedLine.slice(markerIndex).trim();
  const match = markerLine.match(
    /^\[MET_EXPO_PROVIDER_CHECK\]\s+(ValidatorInstalled|ProviderGeneration|Target|ExpoModulesProvider|ExpoLinkingModule|SplashScreenModule|RuntimeRegistration)=([a-z]+)\s*$/,
  );
  if (!match) return null;

  const [, item, status] = match;
  if (item === "ValidatorInstalled" && status === "present") {
    return "iOS provider check: instrumentation installed.";
  }
  if (item === "ValidatorInstalled" && status === "failed") {
    return "iOS provider check: instrumentation could not be installed.";
  }
  if (item === "ProviderGeneration" && status === "present") {
    return "iOS provider check: generated provider file found.";
  }
  if (item === "ProviderGeneration" && status === "failed") {
    return "iOS provider check: generated provider file not found.";
  }
  if (item === "ProviderGeneration" && status === "unavailable") {
    return "iOS provider check: provider capture was unavailable.";
  }
  if (item === "Target" && status === "matched") {
    return "iOS provider check: expected app target matched.";
  }
  if (item === "Target" && status === "unexpected") {
    return "iOS provider check: app target was unexpected.";
  }
  if (item === "Target" && status === "unavailable") {
    return "iOS provider check: target could not be identified.";
  }
  if (
    ["ExpoModulesProvider", "ExpoLinkingModule", "SplashScreenModule"].includes(
      item,
    ) &&
    ["present", "missing"].includes(status)
  ) {
    return `iOS provider check: ${item} ${status}.`;
  }
  if (item === "RuntimeRegistration" && status === "notchecked") {
    return "iOS provider check: runtime registration was not measured.";
  }
  return null;
}

function sanitizeTurboModulePatchMarker(line) {
  const normalizedLine = line.replace(ANSI_ESCAPE, "");
  const match = normalizedLine.trim().match(
    /^\[MET_TURBOMODULE_PATCH\]\s+(Applied|AlreadyApplied)\s*$/,
  );
  if (!match) return null;
  return match[1] === "Applied"
    ? "iOS TurboModule patch: applied."
    : "iOS TurboModule patch: already applied.";
}

function summarizeCocoaPodsError(line) {
  return (
    COCOAPODS_DIAGNOSTICS.find(([pattern]) => pattern.test(line))?.[1] ?? null
  );
}

function sanitizeLine(line) {
  if (typeof line !== "string" || line.length > MAX_LINE_LENGTH) {
    return null;
  }
  line = line.replace(ANSI_ESCAPE, "");
  const nativeError =
    /^\s*(?:fatal\s+)?error:\s*/i.test(line) ||
    /:\d+(?::\d+)?:\s*(?:fatal\s+)?error:\s*/i.test(line) ||
    /^\s*(?:\[[A-Z0-9_]+\]\s*)?e:\s*(?:file:\/\/|\/)/i.test(line);
  if (isSensitiveFormat(line)) {
    return nativeError ? summarizeNativeCompileError(line) : null;
  }

  const providerCheck = sanitizeExpoProviderMarker(line);
  if (providerCheck) return providerCheck;

  const turboModulePatch = sanitizeTurboModulePatchMarker(line);
  if (turboModulePatch) return turboModulePatch;

  const cocoaPodsError = summarizeCocoaPodsError(line);
  if (cocoaPodsError) return cocoaPodsError;

  const gradleTask = line.match(/Execution failed for task ['"]([^'"]+)['"]/i);
  if (gradleTask && /^[A-Za-z0-9:_-]{1,100}$/.test(gradleTask[1])) {
    return `Gradle task failed: ${gradleTask[1]}.`;
  }
  if (/^\s*FAILURE:\s*Build failed with an exception\.?\s*$/i.test(line)) {
    return "Gradle build failed.";
  }

  if (/^\s*[✔✓]\s*(?:build setup complete|build completed|build successful)\b/i.test(line)) {
    return "Build stage: build process completed.";
  }
  if (/^\s*[›•]\s*(?:planning build|installing dependencies|building|signing|exporting)\b/i.test(line)) {
    return "Build stage: build is in progress.";
  }

  if (/\b(?:error|failed|failure|no|missing|invalid|expired|not found|could not|unable|requires)\b/i.test(line)) {
    for (const [pattern, summary] of SIGNING_DIAGNOSTICS) {
      if (pattern.test(line)) return summary;
    }
  }

  const typescriptError = line.match(/\berror\s+(TS\d{1,5})\s*:/i);
  if (typescriptError) {
    return `TypeScript compile error (${typescriptError[1].toUpperCase()}).`;
  }

  if (nativeError) {
    return summarizeNativeCompileError(line);
  }

  const marker = line.match(/^\s*\[([A-Z0-9_]+)\]/);
  if (marker && STAGE_MARKERS.has(marker[1])) {
    return STAGE_MARKERS.get(marker[1]);
  }

  return null;
}

function runSanitizer(input = process.stdin, output = process.stdout) {
  const emitted = new Set();
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  lines.on("line", (line) => {
    const safeMessage = sanitizeLine(line);
    if (safeMessage && !emitted.has(safeMessage)) {
      emitted.add(safeMessage);
      output.write(`${safeMessage}\n`);
    }
  });
}

if (require.main === module) {
  runSanitizer();
}

module.exports = {
  sanitizeExpoProviderMarker,
  sanitizeLine,
  sanitizeTurboModulePatchMarker,
  runSanitizer,
};