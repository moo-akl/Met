import React from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Line } from "react-native-svg";

export function GridOverlay() {
  const { width, height } = useWindowDimensions();
  const gridLine = "rgba(58,224,106,0.07)";
  const hCount = Math.ceil(height / 40) + 2;
  const vCount = Math.ceil(width / 44) + 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        {Array.from({ length: hCount }).map((_, i) => (
          <Line
            key={`h${i}`}
            x1={0}
            y1={i * 40}
            x2={width}
            y2={i * 40}
            stroke={gridLine}
            strokeWidth="1"
          />
        ))}
        {Array.from({ length: vCount }).map((_, i) => (
          <Line
            key={`v${i}`}
            x1={i * 44}
            y1={0}
            x2={i * 44}
            y2={height}
            stroke={gridLine}
            strokeWidth="1"
          />
        ))}
      </Svg>
    </View>
  );
}
