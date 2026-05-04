import React from "react";
import {
  Image as RNImage,
  View,
  type ImageProps as RNImageProps,
  type ImageResizeMode,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { isExpoViewManagerError, recordNativeError } from "@/lib/diagnostics";

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
// Build #18 confirmed via the in-app Diagnostics screen that the
// ExpoImage native view manager is in fact `undefined` in the production
// binary. The wrapper successfully prevented an app-wide crash, but the
// previous fallback rendered a flat grey placeholder, so users saw blank
// photo slots instead of their actual photos.
//
// Build #19 changes the fallback to React Native's *built-in* Image
// component. RN core Image does not go through the Expo Modules /
// Fabric interop view-manager registry that is failing on the device,
// so it remains usable even when expo-image's native view manager is
// missing. The user loses expo-image's caching/blurhash/transition
// niceties, but actually sees their photos — which is the entire point.

export type MetImageProps = {
  source?: unknown;
  style?: StyleProp<ViewStyle>;
  contentFit?: string;
  onLoad?: (...args: unknown[]) => unknown;
  onError?: (...args: unknown[]) => unknown;
  onLoadStart?: (...args: unknown[]) => unknown;
  onLoadEnd?: (...args: unknown[]) => unknown;
  accessible?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  // Pass-through for every other prop expo-image's Image supports
  // (transition, placeholder, cachePolicy, recyclingKey, ...). They are
  // dropped on the RN core fallback path.
  [key: string]: unknown;
};

let resolvedImpl: React.ComponentType<MetImageProps> | null = null;
let resolveAttempted = false;
// Once a render-time failure is observed once we know expo-image's view
// manager is broken in this binary; future MetImage instances skip the
// expo-image path entirely. This avoids re-throwing for every photo on
// screen and prevents the 20-entry diagnostics ring buffer from being
// flooded with identical entries from a single broken module.
let renderFailed = false;

function getImpl(): React.ComponentType<MetImageProps> | null {
  if (renderFailed) return null;
  if (resolveAttempted) return resolvedImpl;
  resolveAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-image");
    resolvedImpl = mod.Image as React.ComponentType<MetImageProps>;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "MetImage: expo-image failed to load; using RN core Image fallback.",
      err,
    );
    recordNativeError("MetImage", "import", err);
    resolvedImpl = null;
  }
  return resolvedImpl;
}

// Normalize the polymorphic expo-image `source` shape down to something
// RN core Image accepts: `{ uri: string }`, a numeric require() handle,
// or null (placeholder).
function normalizeSource(raw: unknown): { uri: string } | number | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    return raw.length > 0 ? { uri: raw } : null;
  }
  if (typeof raw === "number") return raw;
  if (Array.isArray(raw)) {
    return raw.length > 0 ? normalizeSource(raw[0]) : null;
  }
  if (typeof raw === "object") {
    const obj = raw as { uri?: unknown };
    if (typeof obj.uri === "string" && obj.uri.length > 0) {
      return { uri: obj.uri };
    }
  }
  return null;
}

function mapResizeMode(contentFit: unknown): ImageResizeMode {
  switch (contentFit) {
    case "contain":
    case "scale-down":
      return "contain";
    case "fill":
      return "stretch";
    case "none":
      return "center";
    case "cover":
    default:
      return "cover";
  }
}

function CoreImageFallback(props: MetImageProps) {
  const source = normalizeSource(props.source);
  if (!source) {
    return (
      <View
        style={[
          { backgroundColor: "#e5e7eb" },
          props.style as StyleProp<ViewStyle>,
        ]}
      />
    );
  }
  // expo-image's `style` is broader than RN core Image's `ImageStyle`
  // (e.g. it allows `overflow: "scroll"`). Layouts in this app only
  // exercise the common subset (width/height/borderRadius/margin/etc),
  // so casting through `unknown` here is safe in practice. A bad style
  // value would simply be ignored by RN Image.
  const style = props.style as unknown as StyleProp<ImageStyle>;
  return (
    <RNImage
      source={source}
      style={style}
      resizeMode={mapResizeMode(props.contentFit)}
      onLoad={props.onLoad as RNImageProps["onLoad"]}
      onError={props.onError as RNImageProps["onError"]}
      onLoadStart={props.onLoadStart as RNImageProps["onLoadStart"]}
      onLoadEnd={props.onLoadEnd as RNImageProps["onLoadEnd"]}
      accessible={props.accessible}
      accessibilityLabel={props.accessibilityLabel}
      testID={props.testID}
    />
  );
}

type BoundaryProps = React.PropsWithChildren<{ fallback: React.ReactNode }>;
type BoundaryState = { errored: boolean };

class ImageBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { errored: false };

  static getDerivedStateFromError(): BoundaryState {
    return { errored: true };
  }

  componentDidCatch(error: unknown) {
    // Only flip the module-level "renderFailed" poison flag if the error
    // matches the iOS view-manager-registration signature we are
    // actually defending against — otherwise a transient/unrelated
    // render error (e.g. a one-off bug in user code) would permanently
    // disable expo-image for the whole session.
    if (!renderFailed) {
      // eslint-disable-next-line no-console
      console.warn(
        "MetImage: native render failed; using RN core Image fallback.",
        error,
      );
      recordNativeError("MetImage", "render", error);
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

function MetImageInner(props: MetImageProps) {
  const Impl = getImpl();
  const [loadFailed, setLoadFailed] = React.useState(false);
  const fallback = <CoreImageFallback {...props} />;
  if (!Impl || loadFailed) return fallback;
  return (
    <ImageBoundary fallback={fallback}>
      <Impl
        {...props}
        onError={(e: unknown) => {
          recordNativeError("MetImage", "runtime", e);
          setLoadFailed(true);
          props.onError?.(e);
        }}
      />
    </ImageBoundary>
  );
}

export function MetImage(props: MetImageProps) {
  return <MetImageInner key={String((props.source as any)?.uri ?? props.source)} {...props} />;
}

// Drop-in alias so import sites can keep their existing identifier.
export const Image = MetImage;
