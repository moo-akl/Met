/**
 * SheetHandle
 *
 * Shared drag-handle pill for all bottom sheets. Enforces the project-wide
 * convention of using `colors.mutedForeground` so the handle color stays
 * consistent as new sheets are added.
 *
 * Usage:
 *   <SheetHandle />
 *   <SheetHandle style={{ marginBottom: 18 }} />
 */

import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { useColors } from "@/hooks/useColors";

interface SheetHandleProps {
  /** Optional extra style for spacing (e.g. marginBottom). Color is always enforced. */
  style?: ViewStyle;
}

export function SheetHandle({ style }: SheetHandleProps) {
  const colors = useColors();
  return (
    <View
      style={[styles.handle, { backgroundColor: colors.mutedForeground }, style]}
    />
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
  },
});
