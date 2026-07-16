/**
 * TrophyCase
 *
 * Shows a pressable summary row ("Trophies →") on the profile page.
 * Tapping opens a full-screen modal with the trophy grid, a public/private
 * visibility toggle, and a how-to-win hint.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type ListRenderItemInfo,
} from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Trophy {
  id: number;
  hubId: string;
  hubName: string | null;
  monthYear: string;
  rankAchieved: number;
  trophyType: string;
  awardedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TROPHY_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  Gold:   { bg: "#2A1F00", border: "#FFD700", text: "#FFD700", glow: "rgba(255,215,0,0.35)" },
  Silver: { bg: "#1A1A22", border: "#C0C0C0", text: "#D8D8D8", glow: "rgba(192,192,192,0.25)" },
  Bronze: { bg: "#1E1200", border: "#CD7F32", text: "#CD7F32", glow: "rgba(205,127,50,0.25)" },
};

const VISIBILITY_KEY = "met:trophies_public:v1";

// ---------------------------------------------------------------------------
// SVG Trophy Cup icon
// ---------------------------------------------------------------------------

function TrophyCupIcon({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 2 H18 V10 C18 15.5 12 17 12 17 C12 17 6 15.5 6 10 Z"
        fill={color}
        opacity={0.95}
      />
      <Path
        d="M6 5 C2.5 5 2.5 12 6 12"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity={0.7}
      />
      <Path
        d="M18 5 C21.5 5 21.5 12 18 12"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity={0.7}
      />
      <Rect x="11" y="17" width="2" height="3" fill={color} opacity={0.85} />
      <Path
        d="M8 20 H16 A1 1 0 0 1 16 22 H8 A1 1 0 0 1 8 20 Z"
        fill={color}
        opacity={0.85}
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Gold Shine animation
// ---------------------------------------------------------------------------

function GoldShine({ children }: { children: React.ReactNode }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.55, 0] });

  return (
    <View style={styles.shineContainer}>
      {children}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.shineOverlay, { opacity }]}
        pointerEvents="none"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Trophy card
// ---------------------------------------------------------------------------

function TrophyCard({ trophy }: { trophy: Trophy }) {
  const colors = TROPHY_COLORS[trophy.trophyType] ?? TROPHY_COLORS.Bronze!;
  const [year, month] = trophy.monthYear.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  const monthLabel = date.toLocaleString("default", { month: "short", year: "2-digit" });

  const card = (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.bg, borderColor: colors.border, shadowColor: colors.glow },
      ]}
    >
      <TrophyCupIcon color={colors.text} size={32} />
      <Text style={[styles.hubName, { color: colors.text }]} numberOfLines={2}>
        {trophy.hubName ?? trophy.hubId}
      </Text>
      <Text style={styles.monthLabel}>{monthLabel}</Text>
      <Text style={[styles.rankLabel, { color: colors.text }]}>
        #{trophy.rankAchieved} {trophy.trophyType}
      </Text>
    </View>
  );

  if (trophy.trophyType === "Gold") {
    return <GoldShine>{card}</GoldShine>;
  }
  return <View style={styles.shineContainer}>{card}</View>;
}

// ---------------------------------------------------------------------------
// How-to-win card (shown in modal when trophies list is empty)
// ---------------------------------------------------------------------------

function HowToWinCard() {
  const { t } = useT();
  const colors = useColors();
  return (
    <View style={[styles.howToCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.howToTitle, { color: colors.foreground }]}>
        {t("trophies.howToWinTitle")}
      </Text>
      <View style={styles.howToRow}>
        <TrophyCupIcon color={TROPHY_COLORS.Gold!.text} size={18} />
        <Text style={[styles.howToRowText, { color: colors.mutedForeground }]}>
          {t("trophies.howToWinGold")}
        </Text>
      </View>
      <View style={styles.howToRow}>
        <TrophyCupIcon color={TROPHY_COLORS.Silver!.text} size={18} />
        <Text style={[styles.howToRowText, { color: colors.mutedForeground }]}>
          {t("trophies.howToWinSilver")}
        </Text>
      </View>
      <View style={styles.howToRow}>
        <TrophyCupIcon color={TROPHY_COLORS.Bronze!.text} size={18} />
        <Text style={[styles.howToRowText, { color: colors.mutedForeground }]}>
          {t("trophies.howToWinBronze")}
        </Text>
      </View>
      <View style={[styles.howToDivider, { backgroundColor: colors.border }]} />
      <Text style={[styles.howToNote, { color: colors.mutedForeground }]}>
        {t("trophies.howToWinNote")}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  trophies: Trophy[];
  loading?: boolean;
}

export function TrophyCase({ trophies, loading }: Props) {
  const { t } = useT();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(VISIBILITY_KEY).then((val) => {
      if (val !== null) setIsPublic(val === "1");
    });
  }, []);

  const handleToggleVisibility = (val: boolean) => {
    setIsPublic(val);
    void AsyncStorage.setItem(VISIBILITY_KEY, val ? "1" : "0");
  };

  if (loading) {
    return (
      <View style={[styles.rowWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TrophyCupIcon color={TROPHY_COLORS.Gold!.text} size={16} />
        <Text style={[styles.rowTitle, { color: colors.foreground }]}>{t("trophies.title")}</Text>
        <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
          {t("trophies.loading")}
        </Text>
      </View>
    );
  }

  const count = trophies.length;

  return (
    <>
      {/* Pressable summary row — same style as the Pioneer Leaderboard link */}
      <Pressable
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.rowWrap,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.82 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <TrophyCupIcon color={TROPHY_COLORS.Gold!.text} size={18} />
        <Text style={[styles.rowTitle, { color: colors.foreground, flex: 1 }]}>
          {t("trophies.title")}
        </Text>
        {count > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.primary + "22" }]}>
            <Text style={[styles.countBadgeText, { color: colors.primary }]}>{count}</Text>
          </View>
        )}
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </Pressable>

      {/* Full-screen modal with trophies grid + visibility toggle */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modal, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
          {/* Modal header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TrophyCupIcon color={TROPHY_COLORS.Gold!.text} size={22} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t("trophies.title")}
            </Text>
            <Pressable
              onPress={() => setModalVisible(false)}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityLabel={t("common.close")}
            >
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Visibility toggle */}
          <View style={[styles.visibilityRow, { borderBottomColor: colors.border }]}>
            <Feather
              name={isPublic ? "eye" : "eye-off"}
              size={16}
              color={colors.mutedForeground}
            />
            <Text style={[styles.visibilityLabel, { color: colors.foreground }]}>
              {t("trophies.visibility")}
            </Text>
            <Text style={[styles.visibilityValue, { color: colors.mutedForeground }]}>
              {isPublic ? t("trophies.public") : t("trophies.private")}
            </Text>
            <Switch
              value={isPublic}
              onValueChange={handleToggleVisibility}
              trackColor={{ false: colors.muted, true: colors.primary + "88" }}
              thumbColor={isPublic ? colors.primary : colors.mutedForeground}
            />
          </View>

          {/* Trophy grid or empty/how-to state */}
          {count === 0 ? (
            <View style={styles.modalContent}>
              <HowToWinCard />
            </View>
          ) : (
            <FlatList<Trophy>
              data={trophies}
              keyExtractor={(item) => String(item.id)}
              numColumns={3}
              scrollEnabled
              renderItem={({ item }: ListRenderItemInfo<Trophy>) => <TrophyCard trophy={item} />}
              columnWrapperStyle={styles.row}
              contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 24 }]}
              ListHeaderComponent={
                <View style={styles.hintRow}>
                  <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                    {t("trophies.howToWinNote")}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  /* Pressable summary row */
  rowWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  rowMeta: {
    fontSize: 13,
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },

  /* Modal */
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: 2,
  },

  /* Visibility toggle row */
  visibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  visibilityLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  visibilityValue: {
    fontSize: 13,
  },

  /* Trophy grid */
  modalContent: {
    padding: 16,
  },
  grid: {
    gap: 8,
    padding: 16,
  },
  row: {
    gap: 8,
    justifyContent: "flex-start",
  },
  shineContainer: {
    flex: 1,
    maxWidth: "33.33%",
    overflow: "hidden",
    borderRadius: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    alignItems: "center",
    gap: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  hubName: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 13,
  },
  monthLabel: {
    fontSize: 9,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },
  rankLabel: {
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  shineOverlay: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 12,
  },

  /* Hint text at top of grid */
  hintRow: {
    marginBottom: 12,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },

  /* How-to-win card */
  howToCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  howToTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  howToRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  howToRowText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  howToDivider: {
    height: 1,
    marginVertical: 2,
  },
  howToNote: {
    fontSize: 12,
    lineHeight: 17,
  },
});
