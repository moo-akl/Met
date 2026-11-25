import React from "react";
import { StyleSheet, Text as NativeText, type TextProps, type TextStyle } from "react-native";

const fontFamilyForWeight = (fontWeight: TextStyle["fontWeight"]) => {
  switch (fontWeight) {
    case "500":
      return "DMSans_500Medium";
    case "600":
      return "DMSans_600SemiBold";
    case "700":
    case "bold":
    case "800":
    case "900":
      return "DMSans_700Bold";
    default:
      return "DMSans_400Regular";
  }
};

export function MetText({ style, ...props }: TextProps) {
  const textStyle = StyleSheet.flatten(style);
  const fontFamily = textStyle?.fontFamily ?? fontFamilyForWeight(textStyle?.fontWeight);

  return <NativeText {...props} style={[{ fontFamily }, style]} />;
}
