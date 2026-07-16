import React, { useEffect } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const BORDER = 3;

type Props = {
  size: number;
  children: React.ReactNode;
};

/**
 * Wraps children with a rotating gold shimmer border.
 * Designed for circular profile photos.
 */
export function GoldShimmerBorder({ size, children }: Props) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2400, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const containerSize = size + BORDER * 2;
  const gradientSize = containerSize * 2;

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View
      style={{
        width: containerSize,
        height: containerSize,
        borderRadius: containerSize / 2,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            width: gradientSize,
            height: gradientSize,
            top: -(gradientSize / 2) + containerSize / 2,
            left: -(gradientSize / 2) + containerSize / 2,
          },
          animStyle,
        ]}
      >
        <LinearGradient
          colors={["#FFD700", "#FFFACD", "#D4AF37", "#FFA500", "#FFD700"]}
          style={{ flex: 1 }}
        />
      </Animated.View>

      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </View>
    </View>
  );
}
