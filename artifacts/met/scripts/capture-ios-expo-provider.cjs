"use strict";

const fs = require("node:fs");
const path = require("node:path");

const EXPECTED_PODS_TARGET = "Pods-Met";
const PROVIDER_FILE_NAME = "ExpoModulesProvider.swift";
const MAX_DIRECTORY_COUNT = 20_000;
const MAX_DEPTH = 32;
const MAX_PROVIDER_BYTES = 1_000_000;
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules", "DerivedData"]);
const MARKER_PREFIX = "[MET_EXPO_PROVIDER_CHECK]";

function emptyResult(target = "unavailable", generation = "failed") {
  return {
    generation,
    target,
    provider: "missing",
    linking: "missing",
    splashScreen: "missing",
  };
}

function findGeneratedProviderFiles(buildRoot) {
  if (typeof buildRoot !== "string" || !buildRoot.trim()) {
    return { files: [], scanFailed: true };
  }

  let rootStat;
  try {
    rootStat = fs.statSync(buildRoot);
  } catch {
    return { files: [], scanFailed: true };
  }
  if (!rootStat.isDirectory()) {
    return { files: [], scanFailed: true };
  }

  const files = [];
  const pending = [{ directory: path.resolve(buildRoot), depth: 0 }];
  let visitedDirectories = 0;
  let scanFailed = false;

  while (pending.length > 0) {
    const { directory, depth } = pending.pop();
    visitedDirectories += 1;
    if (visitedDirectories > MAX_DIRECTORY_COUNT || depth > MAX_DEPTH) {
      return { files: [], scanFailed: true };
    }

    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      scanFailed = true;
      continue;
    }

    if (path.basename(directory) === "Pods") {
      const supportFilesDirectory = path.join(
        directory,
        "Target Support Files",
      );
      let targets;
      try {
        targets = fs.readdirSync(supportFilesDirectory, {
          withFileTypes: true,
        });
      } catch (error) {
        if (error.code !== "ENOENT") scanFailed = true;
        continue;
      }

      for (const target of targets) {
        if (!target.isDirectory() || !target.name.startsWith("Pods-")) continue;
        const providerPath = path.join(
          supportFilesDirectory,
          target.name,
          PROVIDER_FILE_NAME,
        );
        try {
          if (fs.statSync(providerPath).isFile()) {
            files.push({ targetName: target.name, path: providerPath });
          }
        } catch (error) {
          if (error.code !== "ENOENT") scanFailed = true;
        }
      }
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name)) {
        pending.push({
          directory: path.join(directory, entry.name),
          depth: depth + 1,
        });
      }
    }
  }

  return { files, scanFailed };
}

function inspectGeneratedProvider(buildRoot) {
  const discovery = findGeneratedProviderFiles(buildRoot);
  const expectedTargets = discovery.files.filter(
    (file) => file.targetName === EXPECTED_PODS_TARGET,
  );

  let selected;
  if (expectedTargets.length === 1) {
    selected = expectedTargets[0];
  } else if (expectedTargets.length === 0 && discovery.files.length === 1) {
    selected = discovery.files[0];
  }

  if (!selected) {
    const generation =
      discovery.scanFailed || discovery.files.length > 0
        ? "unavailable"
        : "failed";
    return emptyResult("unavailable", generation);
  }

  const result = emptyResult(
    selected.targetName === EXPECTED_PODS_TARGET ? "matched" : "unexpected",
    "unavailable",
  );

  try {
    const fileStat = fs.statSync(selected.path);
    if (!fileStat.isFile() || fileStat.size > MAX_PROVIDER_BYTES) return result;

    const source = fs.readFileSync(selected.path, "utf8");
    result.generation = "present";
    result.provider = /\bclass\s+ExpoModulesProvider\b/.test(source)
      ? "present"
      : "missing";
    result.linking = /\bExpoLinkingModule\.self\b/.test(source)
      ? "present"
      : "missing";
    result.splashScreen = /\bSplashScreenModule\.self\b/.test(source)
      ? "present"
      : "missing";
    return result;
  } catch {
    return result;
  }
}

function formatMarkers(result) {
  return [
    `${MARKER_PREFIX} ProviderGeneration=${result.generation}`,
    `${MARKER_PREFIX} Target=${result.target}`,
    `${MARKER_PREFIX} ExpoModulesProvider=${result.provider}`,
    `${MARKER_PREFIX} ExpoLinkingModule=${result.linking}`,
    `${MARKER_PREFIX} SplashScreenModule=${result.splashScreen}`,
    `${MARKER_PREFIX} RuntimeRegistration=notchecked`,
  ];
}

function formatReport(result) {
  return [
    `ExpectedTarget=${EXPECTED_PODS_TARGET}`,
    `ProviderGeneration=${result.generation}`,
    `Target=${result.target}`,
    `ExpoModulesProvider=${result.provider}`,
    `ExpoLinkingModule=${result.linking}`,
    `SplashScreenModule=${result.splashScreen}`,
    "RuntimeRegistration=notchecked",
    "",
  ].join("\n");
}

function captureProvider(buildRoot, reportPath) {
  const result = inspectGeneratedProvider(buildRoot);
  const report = formatReport(result);
  let reportWritten = false;

  if (typeof reportPath === "string" && reportPath.trim()) {
    try {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, report, { encoding: "utf8", mode: 0o600 });
      reportWritten = true;
    } catch {
      // Do not print paths or filesystem errors from the signing workspace.
    }
  }

  return { result, report, reportWritten, markers: formatMarkers(result) };
}

if (require.main === module) {
  const capture = captureProvider(
    process.env.MET_IOS_PROVIDER_WORKDIR,
    process.env.MET_IOS_PROVIDER_REPORT,
  );
  process.stdout.write(`${capture.markers.join("\n")}\n`);
  if (!capture.reportWritten) process.exitCode = 1;
}

module.exports = {
  EXPECTED_PODS_TARGET,
  captureProvider,
  formatMarkers,
  formatReport,
  inspectGeneratedProvider,
};
