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

function summarizeNativeCompileError(line) {
  const diagnostic = line.replace(/^.*?\b(?:fatal\s+)?error:\s*/i, "");
  const category =
    NATIVE_DIAGNOSTICS.find(([pattern]) => pattern.test(diagnostic))?.[1] ??
    "other compiler diagnostic";
  const location = getNativeSourceLocation(line);
  const suffix = location ? ` (${location})` : "";
  return `Native compile error: ${category}${suffix}.`;
}

function sanitizeLine(line) {
  if (typeof line !== "string" || line.length > MAX_LINE_LENGTH || isSensitiveFormat(line)) {
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