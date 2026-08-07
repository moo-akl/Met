import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Props = {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  rightAction?: React.ReactNode;
};

/**
 * Shared business-portal navigation header. Shows an optional back button on
 * the left and an optional action slot on the right (e.g. "+ New" buttons).
 */
export function VenueOwnerHeader({
  title,
  onBack,
  backLabel = "Back",
  rightAction,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + webTop + 12,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            testID="venue-owner-back"
            onPress={onBack}
            hitSlop={8}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
          >
            <Feather name="arrow-left" size={18} color={colors.mutedForeground} />
            <Text style={[styles.backText, { color: colors.mutedForeground }]}>
              {backLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.trailing}>
        {rightAction}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  side: { width: 82, minHeight: 28, justifyContent: "center" },
  backButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  trailing: {
    width: 112,
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
});