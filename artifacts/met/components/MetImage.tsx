import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

// Defensive wrapper around expo-image's Image component.
//
// Same protective pattern as `MetGradient` — see that file for the long
// explanation. Build #16 fixed expo-linear-gradient via wrapping; in the
// next install, expo-image hit the identical iOS production crash:
//
//   View config getter callback for component
//   `ViewManagerAdapter_ExpoImage_<id>` must be a function
//   (received `undefined`).
//
// This wrapper catches the same render-time view-config lookup failure
// for expo-image and falls back to a neutral grey placeholder View so the
// screen renders instead of the entire app dying at the root error
// boundary.

export type MetImageProps = {
  source?: unknown;
  style?: StyleProp<ViewStyle>;
  // Pass-through for every other prop expo-image's Image supports
  // (contentFit, transition, placeholder, cachePolicy, recyclingKey, ...).
  [key: string]: unknown;
};

let resolvedImpl: React.ComponentType<MetImageProps> | null = null;
let resolveAttempted = false;

function getImpl(): React.ComponentType<MetImageProps> | null {
  if (resolveAttempted) return resolvedImpl;
  resolveAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-image");
    resolvedImpl = mod.Image as React.ComponentType<MetImageProps>;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "MetImage: expo-image failed to load; using placeholder fallback.",
      err,
    );
    resolvedImpl = null;
  }
  return resolvedImpl;
}

type BoundaryProps = React.PropsWithChildren<{ fallback: React.ReactNode }>;
type BoundaryState = { errored: boolean };

class ImageBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { errored: false };

  static getDerivedStateFromError(): BoundaryState {
    return { errored: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.warn(
      "MetImage: native render failed; using placeholder fallback.",
      error,
    );
  }

  render() {
    if (this.state.errored) return this.props.fallback;
    return this.props.children;
  }
}

export function MetImage(props: MetImageProps) {
  const Impl = getImpl();
  // Neutral grey placeholder so layouts don't collapse if the gradient
  // box is meant to be a fixed-size avatar / photo slot.
  const fallback = (
    <View style={[{ backgroundColor: "#e5e7eb" }, props.style]} />
  );
  if (!Impl) return fallback;
  return (
    <ImageBoundary fallback={fallback}>
      <Impl {...props} />
    </ImageBoundary>
  );
}

// Drop-in alias so import sites can keep their existing identifier.
export const Image = MetImage;
