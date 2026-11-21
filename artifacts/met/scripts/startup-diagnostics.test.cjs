const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { createStartupTracker, redactDiagnosticText } = require("../startup/state");

test("normal builds do not collect startup state", () => {
  const tracker = createStartupTracker();
  tracker.markPhase("router-import");
  tracker.captureError(new Error("not a startup error"));
  tracker.markReady();
  assert.deepEqual(tracker.getSnapshot().history, []);
  assert.equal(tracker.getSnapshot().error, null);
  assert.equal(tracker.getSnapshot().ready, false);
});

test("diagnostic phases record elapsed time and completion releases the guard", () => {
  let now = 100;
  const tracker = createStartupTracker(() => now);
  tracker.enable();
  now = 140;
  tracker.markPhase("router-import");
  tracker.markTimedOut();
  assert.equal(tracker.getSnapshot().timedOut, true);
  tracker.markReady();
  assert.equal(tracker.getSnapshot().ready, true);
  assert.equal(tracker.captureError(new Error("later application error")), false);
  assert.deepEqual(tracker.getSnapshot().history[1], { phase: "router-import", elapsedMs: 40 });
});

test("the first startup failure remains visible and cannot be marked ready", () => {
  const tracker = createStartupTracker();
  tracker.enable();
  tracker.markPhase("router-import");
  assert.equal(tracker.captureError(new Error("Cannot find native module ExpoCalendar")), true);
  tracker.markPhase("font-loading");
  tracker.markReady();
  assert.equal(tracker.getSnapshot().phase, "router-import");
  assert.equal(tracker.getSnapshot().ready, false);
  assert.equal(tracker.getSnapshot().error, "Cannot find native module ExpoCalendar");
});

test("subscriptions clean up and history remains bounded", () => {
  const tracker = createStartupTracker();
  let notifications = 0;
  const unsubscribe = tracker.subscribe(() => notifications++);
  tracker.enable();
  unsubscribe();
  for (let n = 0; n < 30; n++) tracker.markPhase(`phase-${n}`);
  assert.equal(notifications, 1);
  assert.equal(tracker.getSnapshot().history.length, 12);
});

test("startup-only global error handler restores the original after readiness", () => {
  const calls = [];
  const original = (...args) => calls.push(args);
  let current = original;
  const utils = { getGlobalHandler: () => current, setGlobalHandler: (handler) => { current = handler; } };
  const tracker = createStartupTracker();
  tracker.enable();
  tracker.installErrorHandler(utils);
  current(new Error("nonfatal"), false);
  assert.equal(calls.length, 1);
  tracker.markReady();
  assert.equal(current, original);
  current(new Error("regular fatal"), true);
  assert.equal(calls.length, 2);
});

test("startup fatal error is displayed instead of reaching the native abort path", () => {
  let forwarded = false;
  let current = () => { forwarded = true; };
  const utils = { getGlobalHandler: () => current, setGlobalHandler: (handler) => { current = handler; } };
  const tracker = createStartupTracker();
  tracker.enable();
  const cleanup = tracker.installErrorHandler(utils);
  current(new Error("startup failure"), true);
  current(new Error("duplicate startup failure"), true);
  assert.equal(forwarded, false);
  assert.equal(tracker.getSnapshot().error, "startup failure");
  cleanup();
  current(new Error("normal failure"), true);
  assert.equal(forwarded, true);
});

test("reports redact likely credentials, emails, URLs and private paths", () => {
  const unsafe = 'Bearer example-token token=example-secret person@example.com https://example.test/?token=secret /Users/Someone/private.js {"access_token":"hidden-access","apiKey": "hidden-key"}';
  const safe = redactDiagnosticText(unsafe);
  for (const secret of ["example-token", "example-secret", "person@example.com", "example.test", "Someone", "hidden-access", "hidden-key"]) {
    assert.equal(safe.includes(secret), false);
  }
  assert.equal(redactDiagnosticText("x".repeat(4000)).length, 3000);
  const tracker = createStartupTracker();
  tracker.enable();
  tracker.captureError(new Error(unsafe));
  assert.match(tracker.formatReport("342"), /Build: 342/);
  assert.equal(tracker.formatReport("342").includes("example-secret"), false);
});

for (const [platform, enabled, expected] of [
  ["ios", true, "diagnostic"],
  ["ios", false, "standard"],
  ["android", true, "standard"],
  ["web", true, "standard"],
]) test(`${platform} with diagnostics=${enabled} uses the ${expected} entry`, () => {
  const entry = fs.readFileSync(path.join(__dirname, "../index.js"), "utf8");
  const loaded = [];
  let backgroundRegistrations = 0;
  vm.runInNewContext(entry, {
    require(id) {
      loaded.push(id);
      if (id === "react-native") return { Platform: { OS: platform } };
      if (id === "./app.json") return { expo: { extra: { startupDiagnostics: enabled } } };
      if (id === "@react-native-firebase/messaging") return {
        getMessaging: () => ({}),
        setBackgroundMessageHandler() { backgroundRegistrations++; },
      };
      return {};
    },
  });
  assert.equal(loaded[0], "@expo/metro-runtime");
  assert.equal(loaded.includes("./startup/registerDiagnosticRoot"), expected === "diagnostic");
  assert.equal(loaded.includes("expo-router/entry"), expected === "standard");
  assert.equal(backgroundRegistrations, expected === "standard" && platform !== "web" ? 1 : 0);
});

test("the root layout reports readiness and early provider errors", () => {
  const layout = fs.readFileSync(path.join(__dirname, "../app/_layout.tsx"), "utf8");
  assert.match(layout, /markStartupReady\(\)/);
  assert.match(layout, /ErrorBoundary onError=\{captureStartupError\}/);
});

function diagnosticScreenHarness({ compiled = false, earlyWarning } = {}) {
  const React = require("react");
  const babel = require("@babel/core");
  const stateModule = require("../startup/state");
  const tracker = createStartupTracker();
  let Root;
  let shared = false;
  let sharedMessage;
  const loaded = [];
  const compilerCaches = new Map();
  const box = ({ children, testID }) => React.createElement("div", { "data-testid": testID }, children);
  const code = babel.transformFileSync(path.join(__dirname, "../startup/registerDiagnosticRoot.jsx"), {
    configFile: false,
    babelrc: false,
    presets: [[require.resolve("babel-preset-expo"), { jsxRuntime: "classic" }]],
    caller: { name: "metro", platform: "ios", isDev: false, supportsReactCompiler: compiled },
  }).code;
  const context = {
    DiagnosticScreen: null,
    compilerRuntime: {
      c(size) {
        // Retain memo slots across calls to the same compiled screen, as React
        // does across renders. Only DiagnosticScreen is invoked in this mode.
        if (!compilerCaches.has(size)) {
          compilerCaches.set(size, Array(size).fill(Symbol.for("react.memo_cache_sentinel")));
        }
        return compilerCaches.get(size);
      },
    },
  };
  const fakeConsole = { warn() {}, error() {} };
  vm.runInNewContext(`${code}\ncaptureScreen(DiagnosticScreen);`, {
    ...context,
    console: fakeConsole,
    global: {},
    require(id) {
      loaded.push(id);
      if (id === "react/compiler-runtime") return context.compilerRuntime;
      if (id.startsWith("@babel/runtime/")) {
        // Babel helpers are RN's dependency, not a new app dependency.
        return require(require.resolve(id, { paths: [require.resolve("react-native/package.json")] }));
      }
      if (id === "react") return React;
      if (id === "react-native") return {
        ActivityIndicator: () => React.createElement("span", null, "Loading"),
        SafeAreaView: box, ScrollView: box, Text: box, View: box, TouchableOpacity: box,
        StyleSheet: { create: (styles) => styles, absoluteFill: {} },
        Share: { share: async ({ message }) => { shared = true; sharedMessage = message; } },
      };
      if (id === "expo") {
        if (earlyWarning) fakeConsole.error(earlyWarning);
        return { registerRootComponent: (component) => { Root = component; } };
      }
      if (id === "expo-splash-screen") return { hideAsync: async () => {} };
      if (id === "./state") return { ...stateModule, startupTracker: tracker };
      if (id === "../app.json") return { expo: { ios: { buildNumber: "343" } } };
      throw new Error(`Unexpected eager startup import: ${id}`);
    },
    captureScreen: (screen) => { context.DiagnosticScreen = screen; },
  });
  return {
    tracker, loaded,
    wasShared: () => shared,
    sharedMessage: () => sharedMessage,
    compiledElement: () => context.DiagnosticScreen({ state: tracker.getSnapshot(), onLayout: undefined }),
    render: () => require("react-dom/server").renderToStaticMarkup(React.createElement(Root)),
  };
}

test("minimal diagnostic screen registers before Firebase and Router imports", () => {
  const screen = diagnosticScreenHarness();
  assert.match(screen.render(), /Starting Met/);
  assert.equal(screen.loaded.includes("@react-native-firebase/messaging"), false);
  assert.equal(screen.loaded.includes("expo-router/build/qualified-entry"), false);
});

test("a timed-out startup visibly offers a report without automatic sharing", () => {
  const screen = diagnosticScreenHarness();
  screen.tracker.markPhase("router-import");
  screen.tracker.markTimedOut();
  const html = screen.render();
  assert.match(html, /Met is taking longer to start/);
  assert.match(html, /Loading Expo Router and route modules/);
  assert.match(html, /Share startup report/);
  assert.equal(screen.wasShared(), false);
});

test("a startup error screen displays a redacted failure and tested build", () => {
  const screen = diagnosticScreenHarness();
  screen.tracker.captureError(new Error('Module failed {"access_token":"hidden-access"}'));
  const html = screen.render();
  assert.match(html, /Met could not start/);
  assert.match(html, /BUILD 343/);
  assert.match(html, /REDACTED/);
  assert.equal(html.includes("hidden-access"), false);
});

test("production compiler refreshes reports after the first screen render", () => {
  const screen = diagnosticScreenHarness({ compiled: true });
  const render = (element) => require("react-dom/server").renderToStaticMarkup(element);
  assert.match(render(screen.compiledElement()), /Starting Met/);
  screen.tracker.markPhase("router-import");
  screen.tracker.captureError(new Error("Router import failed token=private-value"));
  const element = screen.compiledElement();
  const html = render(element);
  assert.match(html, /Status: error/);
  assert.match(html, /Last stage: Loading Expo Router and route modules/);
  assert.match(html, /Error: Router import failed token=\[REDACTED\]/);
  assert.equal(html.includes("private-value"), false);
  function findShare(node) {
    if (!node || typeof node !== "object") return undefined;
    if (node.props?.testID === "share-startup-report") return node;
    return require("react").Children.toArray(node.props?.children)
      .map(findShare).find(Boolean);
  }
  findShare(element).props.onPress();
  assert.match(screen.sharedMessage(), /Status: error/);
  assert.match(screen.sharedMessage(), /Router import failed/);
  assert.equal(screen.sharedMessage().includes("private-value"), false);
});

test("production compiler refreshes timeout reports after the first screen render", () => {
  const screen = diagnosticScreenHarness({ compiled: true });
  screen.compiledElement();
  screen.tracker.markPhase("router-import");
  screen.tracker.markTimedOut();
  const html = require("react-dom/server").renderToStaticMarkup(screen.compiledElement());
  assert.match(html, /Status: timeout/);
  assert.match(html, /Last stage: Loading Expo Router and route modules/);
});

test("captures only Expo loader warnings, redacts them and preserves normal logging", () => {
  const screen = createStartupTracker();
  screen.enable();
  const calls = [];
  const original = (...args) => calls.push(args);
  const logger = { warn: original, error: original };
  const cleanup = screen.installConsoleCapture(logger);
  logger.warn("Unrelated private application message");
  logger.error("Unable to install Expo modules: token=private-value");
  logger.warn("An error occurred while requiring the 'ExpoLinking' module: denied");
  logger.error("Unable to install Expo modules: token=private-value");
  assert.equal(calls.length, 4);
  assert.equal(screen.getSnapshot().warnings.length, 2);
  const report = screen.formatReport("345");
  assert.match(report, /Expo warning: Unable to install Expo modules: token=\[REDACTED\]/);
  assert.match(report, /ExpoLinking/);
  assert.equal(report.includes("private-value"), false);
  assert.equal(report.includes("Unrelated private"), false);
  cleanup();
  assert.equal(logger.warn, original);
  assert.equal(logger.error, original);
});

test("loader warning capture restores the console after successful startup", () => {
  const tracker = createStartupTracker();
  tracker.enable();
  const original = () => {};
  const logger = { warn: original, error: original };
  tracker.installConsoleCapture(logger);
  tracker.markReady();
  assert.equal(logger.warn, original);
  assert.equal(logger.error, original);
});

test("native availability checks report present, missing and throwing lookups safely", () => {
  const tracker = createStartupTracker();
  tracker.enable();
  tracker.recordNativeCheck("Expo runtime", () => true);
  tracker.recordNativeCheck("ExpoLinking", () => false);
  tracker.recordNativeCheck("ExpoConstants", () => { throw new Error("lookup failed token=hidden"); });
  const report = tracker.formatReport("345");
  assert.match(report, /Native check: Expo runtime: available/);
  assert.match(report, /Native check: ExpoLinking: unavailable/);
  assert.match(report, /Native check: ExpoConstants: lookup threw: lookup failed token=\[REDACTED\]/);
  assert.equal(report.includes("hidden"), false);
});

test("native module inventory reports the registered Expo modules without unsafe names", () => {
  const tracker = createStartupTracker();
  tracker.enable();
  tracker.recordNativeInventory(() => [
    "ExpoLinking",
    "ExpoSplashScreen",
    "ExpoLinking",
    "not a module",
    "access_token=private",
    42,
  ]);
  const report = tracker.formatReport("348");
  assert.match(report, /Native registry: 2 Expo modules/);
  assert.match(report, /Registered modules: ExpoLinking, ExpoSplashScreen/);
  assert.equal(report.includes("private"), false);
});

test("native module inventory reports empty registries, errors, and bounded output", () => {
  const tracker = createStartupTracker();
  tracker.enable();
  tracker.recordNativeInventory(() => []);
  assert.match(tracker.formatReport("348"), /Registered modules: \(none\)/);

  tracker.recordNativeInventory(() => { throw new Error("registry failed token=private"); });
  const failedReport = tracker.formatReport("348");
  assert.match(failedReport, /Native registry: lookup failed: registry failed token=\[REDACTED\]/);
  assert.equal(failedReport.includes("private"), false);

  tracker.recordNativeInventory(() => Array.from({ length: 65 }, (_, index) => `Module${index}`));
  assert.match(tracker.formatReport("348"), /Native registry: 65 Expo modules/);
  assert.match(tracker.formatReport("348"), /5 more omitted/);
});

test("captures initialization warnings before the first Expo import in compiled builds", () => {
  const screen = diagnosticScreenHarness({
    compiled: true,
    earlyWarning: "Unable to install Expo modules: initialization failed",
  });
  screen.compiledElement();
  screen.tracker.markPhase("router-import");
  screen.tracker.captureError(new Error("Cannot find native module 'ExpoLinking'"));
  const html = require("react-dom/server").renderToStaticMarkup(screen.compiledElement());
  assert.match(html, /initialization failed/);
  assert.match(html, /ExpoLinking/);
});
