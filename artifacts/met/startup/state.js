// No native imports: this tracker must remain usable before app modules load.
const PHASES = {
  "javascript-entry": "JavaScript entry reached",
  "diagnostic-screen": "Diagnostic screen mounted",
  "firebase-background-handler": "Loading Firebase messaging",
  "router-import": "Loading Expo Router and route modules",
  "root-layout-module": "Root layout imports completed",
  "router-render": "Rendering the app",
  "font-loading": "Waiting for fonts",
  ready: "Root layout mounted and fonts released",
};

function redactDiagnosticText(value) {
  return String(value)
    .replace(/https?:\/\/[^\s)]+/gi, "[URL]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(/(\b[\w-]*(?:token|password|secret|authorization|api[_-]?key)[\w-]*["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi, "$1[REDACTED]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/(?:file:\/\/)?\/(?:Users|private|home|var)\/[^\s)]+/g, "[local path]")
    .slice(0, 3000);
}

function createStartupTracker(now = Date.now) {
  let enabled = false;
  let startedAt = 0;
  let snapshot = { phase: "javascript-entry", ready: false, error: null, timedOut: false, history: [], nativeChecks: [], nativeInventory: null, warnings: [] };
  const listeners = new Set();
  const emit = (next) => {
    snapshot = next;
    listeners.forEach((listener) => listener(snapshot));
  };
  const tracker = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    enable() {
      if (enabled) return;
      enabled = true;
      startedAt = now();
      tracker.markPhase("javascript-entry");
    },
    markPhase(phase) {
      if (!enabled || snapshot.ready || snapshot.error) return;
      // Stage reports are state transitions, not render events. Preserve the
      // snapshot identity on repeats so subscribers cannot feed updates back
      // into the app while the same asynchronous startup work is pending.
      if (snapshot.phase === phase && snapshot.history.length > 0) return;
      emit({
        ...snapshot,
        phase,
        history: [...snapshot.history, { phase, elapsedMs: Math.max(0, now() - startedAt) }].slice(-12),
      });
    },
    captureError(error) {
      if (!enabled || snapshot.ready || snapshot.error) return false;
      const message = error instanceof Error ? error.message : String(error);
      emit({ ...snapshot, error: redactDiagnosticText(message) });
      return true;
    },
    markReady() {
      if (!enabled || snapshot.error || snapshot.ready) return;
      tracker.markPhase("ready");
      emit({ ...snapshot, ready: true });
    },
    markTimedOut() {
      if (!enabled || snapshot.ready || snapshot.error) return;
      emit({ ...snapshot, timedOut: true });
    },
    recordNativeCheck(label, check) {
      if (!enabled || snapshot.ready) return;
      let result;
      try {
        result = check() ? "available" : "unavailable";
      } catch (error) {
        result = `lookup threw: ${redactDiagnosticText(error instanceof Error ? error.message : error)}`;
      }
      emit({ ...snapshot, nativeChecks: [...snapshot.nativeChecks, `${label}: ${result}`].slice(-8) });
    },
    recordNativeInventory(readNames) {
      if (!enabled || snapshot.ready) return;
      let inventory;
      try {
        const names = [...new Set(
          readNames().filter(
            (name) => typeof name === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(name),
          ),
        )].sort();
        inventory = {
          count: names.length,
          names: names.slice(0, 60),
          omitted: Math.max(0, names.length - 60),
        };
      } catch (error) {
        inventory = {
          error: redactDiagnosticText(error instanceof Error ? error.message : error),
        };
      }
      emit({ ...snapshot, nativeInventory: inventory });
    },
    installConsoleCapture(consoleObject) {
      const restorers = [];
      for (const level of ["warn", "error"]) {
        const previous = consoleObject?.[level];
        if (typeof previous !== "function") continue;
        const handler = (...args) => {
          // Capture only Expo's module-loader messages, not app/user logs.
          const first = args[0];
          if (enabled && !snapshot.ready && typeof first === "string" &&
            /^(?:Unable to install Expo modules:|An error occurred while requiring the '|The native ExpoModulesCore)/.test(first)) {
            const warning = redactDiagnosticText(first);
            if (!snapshot.warnings.includes(warning)) {
              emit({ ...snapshot, warnings: [...snapshot.warnings, warning].slice(-6) });
            }
          }
          return previous.apply(consoleObject, args);
        };
        consoleObject[level] = handler;
        restorers.push(() => {
          if (consoleObject[level] === handler) consoleObject[level] = previous;
        });
      }
      const restore = () => restorers.forEach((fn) => fn());
      const unsubscribe = tracker.subscribe((state) => {
        if (state.ready) { restore(); unsubscribe(); }
      });
      return () => { unsubscribe(); restore(); };
    },
    installErrorHandler(errorUtils) {
      if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) return () => {};
      const previous = errorUtils.getGlobalHandler();
      const handler = (error, isFatal) => {
        // React may report the same startup failure more than once. Keep the
        // first failure visible rather than aborting on its duplicate.
        if (enabled && !snapshot.ready && isFatal) {
          tracker.captureError(error);
          return;
        }
        previous?.(error, isFatal);
      };
      errorUtils.setGlobalHandler(handler);
      const restore = () => {
        if (errorUtils.getGlobalHandler() === handler) errorUtils.setGlobalHandler(previous);
      };
      const unsubscribe = tracker.subscribe((state) => {
        if (state.ready) { restore(); unsubscribe(); }
      });
      return () => { unsubscribe(); restore(); };
    },
    formatReport(buildNumber, reportSnapshot = snapshot) {
      return [
        "Met iOS startup diagnostic v1",
        `Build: ${String(buildNumber).replace(/[^0-9]/g, "") || "unknown"}`,
        `Last stage: ${PHASES[reportSnapshot.phase] || reportSnapshot.phase}`,
        `Status: ${reportSnapshot.error ? "error" : reportSnapshot.ready ? "ready" : reportSnapshot.timedOut ? "timeout" : "starting"}`,
        ...(reportSnapshot.error ? [`Error: ${reportSnapshot.error}`] : []),
        ...reportSnapshot.nativeChecks.map((check) => `Native check: ${check}`),
        ...(reportSnapshot.nativeInventory
          ? reportSnapshot.nativeInventory.error
            ? [`Native registry: lookup failed: ${reportSnapshot.nativeInventory.error}`]
            : [
              `Native registry: ${reportSnapshot.nativeInventory.count} Expo modules`,
              `Registered modules: ${reportSnapshot.nativeInventory.names.join(", ") || "(none)"}${reportSnapshot.nativeInventory.omitted ? `; ${reportSnapshot.nativeInventory.omitted} more omitted` : ""}`,
            ]
          : []),
        ...reportSnapshot.warnings.map((warning) => `Expo warning: ${warning}`),
        ...reportSnapshot.history.map((entry) => `${entry.elapsedMs}ms: ${PHASES[entry.phase] || entry.phase}`),
      ].join("\n");
    },
  };
  return tracker;
}

const startupTracker = createStartupTracker();
module.exports = {
  PHASES,
  createStartupTracker,
  redactDiagnosticText,
  startupTracker,
  markStartupPhase: (phase) => startupTracker.markPhase(phase),
  markStartupReady: () => startupTracker.markReady(),
  captureStartupError: (error) => startupTracker.captureError(error),
};
