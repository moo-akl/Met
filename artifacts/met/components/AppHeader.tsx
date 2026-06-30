import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";

type IconName = React.ComponentProps<typeof Feather>["name"];

type Action = {
  icon: IconName;
  onPress: () => void;
  badge?: number;
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
};

export function AppHeader({ title, actions, visibility, onBack }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? 67 : 0;
  const { t } = useT();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.primary }]}>
      <View style={[styles.brandRow, { paddingTop: insets.top + webTop + 10 }]}>
        <Text style={styles.brand}>Met</Text>
      </View>
      <View style={styles.titleRow}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            style={styles.backBtn}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.actions}>
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
                visibility.isVisible
                  ? styles.visPillOn
                  : styles.visPillOff,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather
                name={visibility.isVisible ? "radio" : "slash"}
                size={13}
                color="#FFFFFF"
              />
              <Text style={styles.visPillText}>
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
              style={({ pressed }) => [
                styles.actionBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name={a.icon} size={22} color="#fff" />
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
  wrap: { width: "100%" },
  brandRow: {
    paddingBottom: 6,
    alignItems: "center",
  },
  brand: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 18,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: "#FFFFFF",
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  actionBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
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
  visPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
  },
  visPillOn: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderColor: "rgba(255,255,255,0.4)",
  },
  visPillOff: {
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.55)",
  },
  visPillText: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
});
