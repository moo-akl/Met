const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const React = require("react");
const { act, create } = require("react-test-renderer");
const { createStartupTracker } = require("../startup/state");

test("repeated startup phases preserve snapshot identity and do not notify", () => {
  const tracker = createStartupTracker();
  tracker.enable();
  let notifications = 0;
  tracker.subscribe(() => notifications++);
  tracker.markPhase("font-loading");
  const waiting = tracker.getSnapshot();
  for (let i = 0; i < 100; i++) tracker.markPhase("font-loading");
  assert.equal(tracker.getSnapshot(), waiting);
  assert.equal(notifications, 1);
  tracker.markPhase("router-render");
  tracker.markPhase("font-loading");
  assert.equal(notifications, 3, "real phase transitions must still be reported");
  assert.equal(tracker.getSnapshot().history[0].phase, "javascript-entry");
});

// Exercise the real diagnostic root with React effects/subscriptions, not SSR.
// The router model uses the installed getRoutes and its per-route WeakMap
// component identity pattern: rerendering it can remount the root layout.
function mountedHarness({ compiled }) {
  const tracker = createStartupTracker();
  const stateModule = require("../startup/state");
  const { getRoutes } = require("expo-router/build/getRoutes");
  const routeComponents = new WeakMap();
  const paints = [];
  const timers = new Set();
  const counts = { routerRenders: 0, mounts: 0, unmounts: 0 };
  let Root;
  let finishFonts;
  const box = ({ children, ...props }) => React.createElement("view", props, children);
  function Layout() {
    const [finished, setFinished] = React.useState(false);
    finishFonts = () => setFinished(true);
    React.useEffect(() => {
      counts.mounts++;
      return () => { counts.unmounts++; };
    }, []);
    React.useEffect(() => {
      if (finished) tracker.markReady();
      else tracker.markPhase("font-loading");
    }, [finished]);
    return finished ? React.createElement("app-screen") : null;
  }
  const context = () => ({ default: Layout });
  context.keys = () => ["./_layout.tsx", "./index.tsx"];
  function RouterApp() {
    counts.routerRenders++;
    const route = getRoutes(context, { platform: "ios", skipGenerated: true });
    if (!routeComponents.has(route)) {
      routeComponents.set(route, function QualifiedLayout() {
        return React.createElement(Layout);
      });
    }
    return React.createElement(routeComponents.get(route));
  }
  const code = require("@babel/core").transformFileSync(
    path.join(__dirname, "../startup/registerDiagnosticRoot.jsx"), {
      configFile: false,
      babelrc: false,
      presets: [[require.resolve("babel-preset-expo"), { jsxRuntime: "classic" }]],
      caller: { name: "metro", platform: "ios", isDev: false, supportsReactCompiler: compiled },
    },
  ).code;
  vm.runInNewContext(code, {
    console: { warn() {}, error() {} },
    global: { expo: { modules: { ExpoCalendar: {}, ExpoLinking: {}, ExpoSplashScreen: {} } } },
    requestAnimationFrame: (callback) => { paints.push(callback); },
    setTimeout: (callback, delay) => {
      const timer = { callback, delay };
      timers.add(timer);
      return timer;
    },
    clearTimeout: (timer) => timers.delete(timer),
    require(id) {
      if (id === "react") return React;
      if (id === "react/compiler-runtime") return require(id);
      if (id.startsWith("@babel/runtime/")) {
        return require(require.resolve(id, { paths: [require.resolve("react-native/package.json")] }));
      }
      if (id === "react-native") return {
        ActivityIndicator: box, SafeAreaView: box, ScrollView: box, Text: box, View: box,
        TouchableOpacity: box, Share: { share: async () => {} },
        StyleSheet: { create: (styles) => styles, absoluteFill: {} },
      };
      if (id === "expo") return { registerRootComponent: (component) => { Root = component; } };
      if (id === "expo-splash-screen") return { hideAsync: async () => {} };
      if (id === "./state") return { ...stateModule, startupTracker: tracker };
      if (id === "../app.json") return { expo: { ios: { buildNumber: "357" } } };
      if (id === "@react-native-firebase/messaging") {
        return { default: () => ({ setBackgroundMessageHandler() {} }) };
      }
      if (id === "expo-router/build/qualified-entry") return { App: RouterApp };
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return {
    Root, tracker, counts, timers,
    finishFonts: () => finishFonts(),
    async paint() {
      assert.equal(paints.length, 1);
      paints.shift()();
      const timer = [...timers].find(({ delay }) => delay === 80);
      assert.ok(timer, "startup paint timer was scheduled");
      timers.delete(timer);
      timer.callback();
      await Promise.resolve();
    },
  };
}

for (const compiled of [false, true]) {
  for (const fails of [false, true]) {
    test(`diagnostic updates keep the router mounted; compiler=${compiled}, failure=${fails}`, async () => {
      global.IS_REACT_ACT_ENVIRONMENT = true;
      const app = mountedHarness({ compiled });
      let renderer;
      try {
        await act(async () => { renderer = create(React.createElement(app.Root)); });
        await act(async () => { renderer.root.findAllByType("view").find((node) => node.props.onLayout).props.onLayout(); });
        await act(async () => { await app.paint(); });
        await act(async () => { await app.paint(); });
        assert.equal(app.tracker.getSnapshot().error, null);
        assert.equal(app.tracker.getSnapshot().phase, "font-loading");
        assert.equal(app.counts.mounts, 1);
        const renders = app.counts.routerRenders;
        // A real changed snapshot (not merely a deduplicated phase) must
        // update the overlay without entering RouterApp again.
        await act(async () => { app.tracker.markTimedOut(); });
        assert.match(JSON.stringify(renderer.toJSON()), /Met is taking longer to start/);
        assert.equal(app.counts.routerRenders, renders);
        assert.equal(app.counts.mounts, 1);
        if (fails) {
          await act(async () => { app.tracker.captureError(new Error("Later startup failure token=private")); });
          const visible = JSON.stringify(renderer.toJSON());
          assert.match(visible, /Met could not start/);
          assert.match(visible, /Later startup failure token=\[REDACTED\]/);
          assert.equal(visible.includes("token=private"), false);
          await act(async () => { app.finishFonts(); });
          assert.equal(app.tracker.getSnapshot().ready, false, "readiness cannot erase a captured error");
        } else {
          await act(async () => { app.finishFonts(); });
          assert.equal(app.tracker.getSnapshot().ready, true);
          assert.equal(renderer.root.findAllByType("app-screen").length, 1);
          assert.equal(renderer.root.findAllByType("view").some((node) => node.props.onLayout), false);
        }
        assert.equal(app.counts.unmounts, 0, "diagnostic changes must preserve the running app");
        assert.equal(app.counts.routerRenders, renders);
      } finally {
        if (renderer) await act(async () => renderer.unmount());
        assert.equal(app.timers.size, 0, "the diagnostic timeout must be cleaned up");
        delete global.IS_REACT_ACT_ENVIRONMENT;
      }
    });
  }
}
