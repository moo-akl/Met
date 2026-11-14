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
  let snapshot = { phase: "javascript-entry", ready: false, error: null, timedOut: false, history: [] };
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
    formatReport(buildNumber) {
      return [
        "Met iOS startup diagnostic v1",
        `Build: ${String(buildNumber).replace(/[^0-9]/g, "") || "unknown"}`,
        `Last stage: ${PHASES[snapshot.phase] || snapshot.phase}`,
        `Status: ${snapshot.error ? "error" : snapshot.ready ? "ready" : snapshot.timedOut ? "timeout" : "starting"}`,
        ...(snapshot.error ? [`Error: ${snapshot.error}`] : []),
        ...snapshot.history.map((entry) => `${entry.elapsedMs}ms: ${PHASES[entry.phase] || entry.phase}`),
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
