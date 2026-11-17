"use strict";

const readline = require("node:readline");

const MAX_LINE_LENGTH = 16_384;

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
  [/cannot find .* in scope|cannot find symbol|unresolved reference|unresolved identifier/i, "unresolved symbol"],
  [/does not conform to protocol/i, "protocol conformance"],
  [/ambiguous use of|reference is ambiguous/i, "ambiguous reference"],
  [/build input file cannot be found|no such file or directory|file not found/i, "missing build input"],
  [/incompatible types|type mismatch|cannot be applied to given types/i, "type mismatch"],
  [/duplicate class|redeclaration|redeclared|already defined/i, "duplicate declaration"],
  [/android resource linking failed|no resource found|resource .+ not found/i, "Android resource linking"],
  [/no value passed for parameter|too many arguments|wrong number of arguments/i, "argument mismatch"],
  [/cannot access|is not public|visibility/i, "access restriction"],
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

function getSafeCompilerDetail(diagnostic) {
  const detail = diagnostic
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    !detail ||
    detail.length > 180 ||
    /(?:\b(?:tokens?|secrets?|passwords?|keys?|auth|credentials?|authorization|bearer|issuer|certificate|provisioning)\b|private[\s_-]*keys?|api[\s_-]*keys?)/i.test(detail) ||
    /[A-Za-z0-9_+/=-]{40,}/.test(detail) ||
    /(?:gh[pousr]_|github_pat_|xox[baprs]-|sk-[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{8,}\.)/i.test(detail) ||
    /\b[A-Z_][A-Z0-9_]{1,80}\s*=/.test(detail) ||
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(detail) ||
    /https?:\/\/|(?:\/|\\)[^\s:]+(?:\/|\\)/i.test(detail) ||
    /^\s*[\[{]/.test(detail)
  ) {
    return null;
  }
  return detail;
}

function summarizeNativeCompileError(line) {
  const diagnostic = line.replace(/^.*?\b(?:fatal\s+)?error:\s*/i, "");
  const category =
    NATIVE_DIAGNOSTICS.find(([pattern]) => pattern.test(diagnostic))?.[1] ??
    "other compiler diagnostic";
  const location = getNativeSourceLocation(line);
  const suffix = location ? ` (${location})` : "";
  const detail =
    category === "other compiler diagnostic"
      ? getSafeCompilerDetail(diagnostic)
      : null;
  const detailSuffix = detail ? `: ${detail}` : "";
  return `Native compile error: ${category}${suffix}${detailSuffix}.`;
}

function sanitizeLine(line) {
  if (typeof line !== "string" || line.length > MAX_LINE_LENGTH) {
    return null;
  }

  // Expo/EAS may prepend terminal styling or a progress label to plugin output.
  // Parse only the exact allowlisted marker suffix; never return the prefix.
  const normalizedLine = line.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
  const markerIndex = normalizedLine.lastIndexOf("[MET_EXPO_PROVIDER_CHECK]");
  const markerLine = markerIndex >= 0 ? normalizedLine.slice(markerIndex).trim() : "";
  const providerCheck = markerLine.match(
    /^\[MET_EXPO_PROVIDER_CHECK\]\s+(ValidatorInstalled|ProviderGeneration|Target|ExpoModulesProvider|ExpoLinkingModule|SplashScreenModule|RuntimeRegistration)=([a-z]+)\s*$/
  );
  if (providerCheck) {
    const [, item, status] = providerCheck;
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
    if (item === "Target" && ["matched", "unexpected"].includes(status)) {
      return `iOS provider check: app target ${status}.`;
    }
    if (item === "Target" && status === "unavailable") {
      return "iOS provider check: target could not be identified.";
    }
    if (
      ["ExpoModulesProvider", "ExpoLinkingModule", "SplashScreenModule"].includes(item) &&
      ["present", "missing"].includes(status)
    ) {
      return `iOS provider check: ${item} ${status}.`;
    }    if (item === "RuntimeRegistration" && status === "notchecked") {
      return "iOS provider check: runtime registration was not measured.";
    }
  }
  if (
    /^\s*\[MET_EXPO_PROVIDER_CHECK\] (?:Could not locate the Expo provider generator|Expo provider generation failed|Generated provider is missing required entries|App target name is unavailable|Expo autolinking package is unavailable|Expo provider generator is unavailable)\.?$/.test(markerLine)
  ) {
    return "iOS provider check: validation failed.";
  }

  if (isSensitiveFormat(line)) {
    return null;
  }

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

  const nativeError =
    /^\s*(?:fatal\s+)?error:\s*/i.test(line) ||
    /:\d+(?::\d+)?:\s*(?:fatal\s+)?error:\s*/i.test(line) ||
    /^\s*(?:\[[A-Z0-9_]+\]\s*)?e:\s*(?:file:\/\/|\/)/i.test(line);
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

module.exports = { sanitizeLine, runSanitizer };