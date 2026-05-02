// In-memory ring buffer of native-side errors caught by the defensive
// view wrappers (MetImage, MetCameraView, MetGradient).
//
// Why this exists:
//   TestFlight users can't see `console.warn`. When the app degrades —
//   gray photos, "Camera unavailable" — there's no way to find out what
//   actually failed in the native binary without screen-recording a
//   developer device. This module gives the Settings sheet a tiny
//   read-only surface that exposes the captured errors so a
//   non-technical user can simply screenshot the screen and send it
//   back, and we can patch the real cause in the next build.
//
// Notes:
//   - This buffer is intentionally session-scoped (no AsyncStorage). A
//     persistent log would invite "old errors that no longer apply"
//     confusion across upgrades. Restart-clean is the right semantic.
//   - The snapshot identity changes on every record/clear so it works
//     with useSyncExternalStore without manual force-renders.

export type DiagnosticEntry = {
  /** Stable id so React keys are predictable. */
  id: string;
  /** Capture timestamp, milliseconds since epoch. */
  ts: number;
  /** Which wrapper caught the error (e.g. "MetImage", "MetCameraView"). */
  source: string;
  /** "import" if the lazy require() failed, "render" if the boundary fired. */
  phase: "import" | "render";
  /** Error.name when available, "Error" otherwise. */
  name: string;
  /** Error.message or stringified value. */
  message: string;
  /** First few stack lines, joined with "\n". */
  stack?: string;
};

const MAX_ENTRIES = 20;
const entries: DiagnosticEntry[] = [];
const listeners = new Set<() => void>();
let snapshot: readonly DiagnosticEntry[] = [];

function bump(): void {
  // Fresh array reference so useSyncExternalStore notices the change.
  snapshot = entries.slice();
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // Listener failures must not break diagnostics recording itself.
    }
  });
}

export function recordNativeError(
  source: string,
  phase: "import" | "render",
  error: unknown,
): void {
  // This function is invoked from catch blocks and componentDidCatch in
  // the defensive wrappers — its entire purpose is to make degraded
  // behavior observable. It must therefore NEVER throw, otherwise it
  // would defeat the wrapper's protection. Every step that touches the
  // unknown `error` value (which could have throwing getters or a
  // pathological `String()` coercion) is wrapped accordingly.
  try {
    let name = "Error";
    let message = "Unknown";
    let stack: string | undefined;
    try {
      if (error instanceof Error) {
        name = typeof error.name === "string" && error.name ? error.name : "Error";
        message =
          typeof error.message === "string" && error.message
            ? error.message
            : "Unknown";
        if (typeof error.stack === "string") {
          stack = error.stack.split("\n").slice(0, 6).join("\n");
        }
      } else {
        message = String(error ?? "Unknown");
      }
    } catch {
      // Defensive fallback if reading off `error` itself throws.
      name = "Error";
      message = "Unrepresentable error value";
      stack = undefined;
    }
    const entry: DiagnosticEntry = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      source,
      phase,
      name,
      message,
      stack,
    };
    entries.unshift(entry);
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
    bump();
  } catch {
    // Last-resort silent swallow. Diagnostics must never crash callers.
  }
}

export function clearDiagnostics(): void {
  if (entries.length === 0) return;
  entries.length = 0;
  bump();
}

export function getDiagnosticsSnapshot(): readonly DiagnosticEntry[] {
  return snapshot;
}

export function subscribeToDiagnostics(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Heuristic: does this error look like the iOS production
// view-manager-registration failure that the defensive wrappers exist
// to catch?
//
//   "View config getter callback for component
//    `ViewManagerAdapter_ExpoLinearGradient_<id>` must be a function
//    (received `undefined`)"
//
// The wrappers use this to decide whether the error is permanent (the
// native module is broken in this binary, so flip the per-wrapper
// "renderFailed" flag and stop trying) or transient (e.g. a one-off
// child render error inside a gradient subtree, in which case we should
// keep trying for future renders rather than permanently disabling the
// component for the whole session).
export function isExpoViewManagerError(error: unknown): boolean {
  try {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "";
    if (!message) return false;
    return (
      /ViewManagerAdapter_Expo[A-Za-z0-9_]+/.test(message) &&
      /must be a function/.test(message)
    );
  } catch {
    return false;
  }
}
