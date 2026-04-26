import React, { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

type Props = {
  size?: number;
  active?: boolean;
};

export function PulseBeacon({ size = 140, active = true }: Props) {
  const colors = useColors();
  const p1 = useSharedValue(0);
  const p2 = useSharedValue(0);
  const p3 = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    const config = { duration: 2400, easing: Easing.out(Easing.quad) };
    p1.value = withRepeat(withTiming(1, config), -1, false);
    p2.value = withDelay(800, withRepeat(withTiming(1, config), -1, false));
    p3.value = withDelay(1600, withRepeat(withTiming(1, config), -1, false));
  }, [active, p1, p2, p3]);

  const s1 = useAnimatedStyle(() => ({
    opacity: 1 - p1.value,
    transform: [{ scale: 0.4 + p1.value * 1.2 }],
  }));
  const s2 = useAnimatedStyle(() => ({
    opacity: 1 - p2.value,
    transform: [{ scale: 0.4 + p2.value * 1.2 }],
  }));
  const s3 = useAnimatedStyle(() => ({
    opacity: 1 - p3.value,
    transform: [{ scale: 0.4 + p3.value * 1.2 }],
  }));

  const ringBase = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderColor: colors.primary,
  };

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View style={[styles.ring, ringBase, s1]} />
      <Animated.View style={[styles.ring, ringBase, s2]} />
      <Animated.View style={[styles.ring, ringBase, s3]} />
      <View
        style={[
          styles.core,
          {
            width: size * 0.22,
            height: size * 0.22,
            borderRadius: size * 0.11,
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            shadowOpacity: Platform.OS === "web" ? 0.4 : 0.6,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 2,
  },
  core: {
    elevation: 6,
  },
});
