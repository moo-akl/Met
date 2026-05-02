import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { isExpoViewManagerError, recordNativeError } from "@/lib/diagnostics";

// Defensive wrapper around expo-camera's CameraView component.
//
// Same protective pattern as `MetGradient` and `MetImage`. If the
// expo-camera native view manager fails to register at runtime (the
// `ViewManagerAdapter_ExpoCamera_<id> must be a function` family of
// crashes seen in iOS production builds since Build #14), this wrapper
// degrades to a plain "Camera unavailable" panel so the user can back
// out of the screen instead of the whole app crashing at the root
// error boundary.

export type MetCameraViewProps = {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  // Pass-through for facing, barcodeScannerSettings, onBarcodeScanned, etc.
  [key: string]: unknown;
};

let resolvedImpl: React.ComponentType<MetCameraViewProps> | null = null;
let resolveAttempted = false;
// Once a render-time failure is observed we know expo-camera's view
// manager is broken in this binary; future instances skip the native
// path. This also keeps the diagnostics ring buffer from being flooded
// with duplicates from re-mounts.
let renderFailed = false;

function getImpl(): React.ComponentType<MetCameraViewProps> | null {
  if (renderFailed) return null;
  if (resolveAttempted) return resolvedImpl;
  resolveAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-camera");
    resolvedImpl = mod.CameraView as React.ComponentType<MetCameraViewProps>;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "MetCameraView: expo-camera failed to load; using fallback.",
      err,
    );
    recordNativeError("MetCameraView", "import", err);
    resolvedImpl = null;
  }
  return resolvedImpl;
}

type BoundaryProps = React.PropsWithChildren<{ fallback: React.ReactNode }>;
type BoundaryState = { errored: boolean };

class CameraBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { errored: false };

  static getDerivedStateFromError(): BoundaryState {
    return { errored: true };
  }

  componentDidCatch(error: unknown) {
    // Only flip the module-level "renderFailed" poison flag on the
    // expected iOS view-manager-registration signature so an unrelated
    // transient error doesn't permanently disable the camera.
    if (!renderFailed) {
      // eslint-disable-next-line no-console
      console.warn(
        "MetCameraView: native render failed; using fallback.",
        error,
      );
      recordNativeError("MetCameraView", "render", error);
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

export function MetCameraView(props: MetCameraViewProps) {
  const Impl = getImpl();
  const fallback = (
    <View style={[styles.fallback, props.style]}>
      <Text style={styles.fallbackText}>Camera unavailable</Text>
      {props.children}
    </View>
  );
  if (!Impl) return fallback;
  return (
    <CameraBoundary fallback={fallback}>
      <Impl {...props} />
    </CameraBoundary>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  fallbackText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

// Drop-in alias.
export const CameraView = MetCameraView;
