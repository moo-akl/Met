import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { hexToRgba } from "@/lib/color";

type IconName = React.ComponentProps<typeof Feather>["name"];

type Action = {
  icon: IconName;
  onPress: () => void;
  badge?: number;
  accessibilityLabel?: string;
};

type Visibility = {
  isVisible: boolean;
  onToggle: () => void;
};

type Props = {
  title: string;
  actions?: Action[];
  visibility?: Visibility;
  onBack?: () => void;
  scanActive?: boolean;
  compact?: boolean;
};

export function AppHeader({
  title,
  actions,
  visibility,
  onBack,
  scanActive,
  compact = false,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? 67 : 0;
  const { t } = useT();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          paddingTop: insets.top + webTop,
        },
      ]}
    >
      <View style={[styles.headerRow, compact && styles.compactHeaderRow]}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            style={styles.backBtn}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
        ) : (
          <View style={[styles.brand, compact && styles.compactBrand]}>
            <View
              style={[
                styles.logoCircle,
                compact && styles.compactLogoCircle,
                {
                  borderColor: colors.primary,
                  backgroundColor: hexToRgba(colors.primary, 0.1),
                  shadowColor: colors.primary,
                },
              ]}
            >
              <Text style={[styles.logoLetter, { color: colors.primary }]}>
                M
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.brandText,
                compact && styles.compactBrandText,
                { color: colors.foreground },
              ]}
            >
              {title}
            </Text>
          </View>
        )}

        <View style={[styles.right, compact && styles.compactRight]}>
          {scanActive ? (
            <View
              style={[
                styles.scanPill,
                {
                  borderColor: hexToRgba(colors.primary, 0.35),
                  backgroundColor: hexToRgba(colors.primary, 0.07),
                },
              ]}
            >
              <View style={[styles.scanDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.scanText, { color: colors.primary }]}>
                SCAN.ACTIVE
              </Text>
            </View>
          ) : null}

          {visibility ? (
            <Pressable
              onPress={visibility.onToggle}
              accessibilityRole="switch"
              accessibilityState={{ checked: visibility.isVisible }}
              accessibilityLabel={
                visibility.isVisible
                  ? t("appHeader.beaconVisibleA11y")
                  : t("appHeader.beaconHiddenA11y")
              }
              hitSlop={8}
              style={({ pressed }) => [
                styles.visPill,
                compact && styles.compactVisPill,
                visibility.isVisible
                  ? {
                      backgroundColor: hexToRgba(colors.primary, 0.12),
                      borderColor: hexToRgba(colors.primary, 0.35),
                    }
                  : {
                      backgroundColor: "transparent",
                      borderColor: hexToRgba(colors.primary, 0.25),
                    },
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather
                name={visibility.isVisible ? "radio" : "slash"}
                size={13}
                color={colors.primary}
              />
              <Text style={[styles.visPillText, compact && styles.compactVisPillText, { color: colors.primary }]}>
                {visibility.isVisible
                  ? t("appHeader.visible")
                  : t("appHeader.hidden")}
              </Text>
            </Pressable>
          ) : null}

          {actions?.map((a, i) => (
            <Pressable
              key={i}
              onPress={a.onPress}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={a.accessibilityLabel}
              style={({ pressed }) => [
                styles.actionBtn,
                compact && styles.compactActionBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name={a.icon} size={compact ? 20 : 22} color={colors.foreground} />
              {a.badge && a.badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {a.badge > 9 ? "9+" : a.badge}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
    minWidth: 0,
  },
  logoCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  logoLetter: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  brandText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexShrink: 1,
  },
  scanPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    borderWidth: 1,
  },
  scanDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  scanText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.8,
  },
  visPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
  },
  visPillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  actionBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  compactHeaderRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  compactBrand: {
    gap: 6,
  },
  compactLogoCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  compactBrandText: {
    fontSize: 16,
  },
  compactRight: {
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  compactVisPill: {
    height: 24,
    paddingHorizontal: 7,
  },
  compactVisPillText: {
    fontSize: 10,
  },
  compactActionBtn: {
    width: 24,
    height: 28,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
});
