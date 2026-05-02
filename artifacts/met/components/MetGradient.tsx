import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { isExpoViewManagerError, recordNativeError } from "@/lib/diagnostics";

// Defensive wrapper around expo-linear-gradient.
//
// Build #14 / #15 surfaced an iOS production crash on launch:
//
//   View config getter callback for component
//   `ViewManagerAdapter_ExpoLinearGradient_<id>` must be a function
//   (received `undefined`).
//
// The expo-linear-gradient native view manager was not registered in the
// production binary, even though autolinking resolves the package locally.
// The most plausible cause is that adding `react-native-ble-plx` plus the
// local `expo-met-ble` module shifted how the New Architecture interop
// layer enumerates Paper view managers, and the lookup for ExpoLinearGradient
// returned undefined. The whole app then died at the root error boundary.
//
// This wrapper makes the app resilient to the same class of failure:
//   1. The expo-linear-gradient module is required lazily inside a try
//      so that even an import-time module error becomes a fallback.
//   2. The actual <LinearGradient /> render is wrapped in a small React
//      error boundary so that a render-time view-config lookup error
//      degrades to a plain View with the first color as backgroundColor
//      instead of taking down the entire screen tree.
//
// Visually a flat color is uglier than a gradient, but the user can still
// use the app, which is infinitely better than a "Something went wrong"
// crash screen.

export type MetGradientProps = {
  colors: readonly string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: readonly number[];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  // Pass-through for any other props expo-linear-gradient accepts.
  [key: string]: unknown;
};

let resolvedImpl: React.ComponentType<MetGradientProps> | null = null;
let resolveAttempted = false;
// Once a render-time failure is observed we know expo-linear-gradient's
// view manager is broken in this binary; future MetGradient instances
// skip the native path. This prevents the diagnostics ring buffer from
// being flooded with identical entries from every gradient on screen.
let renderFailed = false;

function getImpl(): React.ComponentType<MetGradientProps> | null {
  if (renderFailed) return null;
  if (resolveAttempted) return resolvedImpl;
  resolveAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-linear-gradient");
    resolvedImpl = mod.LinearGradient as React.ComponentType<MetGradientProps>;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "MetGradient: expo-linear-gradient failed to load; using flat fallback.",
      err,
    );
    recordNativeError("MetGradient", "import", err);
    resolvedImpl = null;
  }
  return resolvedImpl;
}

type BoundaryProps = React.PropsWithChildren<{ fallback: React.ReactNode }>;
type BoundaryState = { errored: boolean };

class GradientBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { errored: false };

  static getDerivedStateFromError(): BoundaryState {
    return { errored: true };
  }

  componentDidCatch(error: unknown) {
    // Only flip the module-level "renderFailed" poison flag if the error
    // matches the iOS view-manager-registration signature — this
    // boundary wraps `children`, so a render error from a gradient's
    // child subtree would otherwise incorrectly disable gradients for
    // the whole session.
    if (!renderFailed) {
      // eslint-disable-next-line no-console
      console.warn(
        "MetGradient: native render failed; using flat fallback.",
        error,
      );
      recordNativeError("MetGradient", "render", error);
      if (isExpoViewManagerError(error)) {
        renderFailed = true;
      }
    }
  }

  render() {
    if (this.state.errored) return this.props.fallback;
    return this.props.children;
  }
}

export function MetGradient(props: MetGradientProps) {
  const Impl = getImpl();
  const firstColor =
    (Array.isArray(props.colors) && (props.colors[0] as string)) ||
    "transparent";
  const fallback = (
    <View style={[{ backgroundColor: firstColor }, props.style]}>
      {props.children}
    </View>
  );
  if (!Impl) return fallback;
  return (
    <GradientBoundary fallback={fallback}>
      <Impl {...props} />
    </GradientBoundary>
  );
}

// Drop-in alias so import sites can keep their existing identifier.
export const LinearGradient = MetGradient;
