import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  style,
}: Props) {
  const colors = useColors();
  const isDisabled = disabled || loading;

  const palette = (() => {
    switch (variant) {
      case "secondary":
        return { bg: colors.secondary, fg: colors.secondaryForeground, border: colors.border };
      case "ghost":
        return { bg: "transparent", fg: colors.foreground, border: colors.border };
      case "destructive":
        return { bg: colors.destructive, fg: colors.destructiveForeground, border: "transparent" };
      default:
        return { bg: colors.primary, fg: colors.primaryForeground, border: "transparent" };
    }
  })();

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === "ghost" || variant === "secondary" ? 1 : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    paddingHorizontal: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  icon: {
    marginRight: 2,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
