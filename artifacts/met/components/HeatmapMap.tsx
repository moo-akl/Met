import React from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export interface HeatmapMapProps {
  style?: StyleProp<ViewStyle>;
}

export function HeatmapMap({ style }: HeatmapMapProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>
        Map view is not available in the web preview.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
  },
  text: {
    color: "#888",
    fontSize: 13,
    textAlign: "center",
    padding: 16,
  },
});
