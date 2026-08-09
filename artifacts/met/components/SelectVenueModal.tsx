/**
 * SelectVenueModal
 *
 * Shown when the user's GPS position is within 50 m of two or more Google
 * Places venues simultaneously.  The user taps a row to confirm their venue
 * and trigger a check-in, or taps "Not now" to dismiss without checking in.
 */

import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { SheetHandle } from "@/components/SheetHandle";
import { useColors } from "@/hooks/useColors";
import { useSlideUpModal } from "@/hooks/useSlideUpModal";
import { useT } from "@/lib/i18n";
import type { VenueResult } from "@/hooks/useHubCheckin";

interface SelectVenueModalProps {
  visible: boolean;
  venues: VenueResult[];
  onSelect: (venue: VenueResult) => void;
  onDismiss: () => void;
}

export function SelectVenueModal({
  visible,
  venues,
  onSelect,
  onDismiss,
}: SelectVenueModalProps) {
  const colors = useColors();
  const { t } = useT();
  const { isMounted, panelStyle, backdropStyle, panGesture } = useSlideUpModal(visible, onDismiss);

  return (
    <Modal
      visible={isMounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Animated.View style={[styles.backdropWrapper, backdropStyle]}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <GestureDetector gesture={panGesture}>
        <Animated.View style={panelStyle}>
        {/* Stop tap propagation so tapping the sheet itself doesn't dismiss */}
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
          {/* Drag handle */}
          <SheetHandle style={{ marginBottom: 16 }} />

          <Text style={[styles.title, { color: colors.foreground }]}>
            {t("venue.selectTitle")}
          </Text>

          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {venues.map((venue, idx) => (
              <Pressable
                key={venue.placeId}
                onPress={() => onSelect(venue)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: pressed
                      ? colors.border
                      : colors.card,
                    borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${venue.displayName}, ${venue.distanceM} metres away`}
              >
                <Text style={styles.rowIcon}>📍</Text>
                <View style={styles.rowText}>
                  <Text
                    style={[styles.venueName, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {venue.displayName}
                  </Text>
                  <Text
                    style={[styles.distance, { color: colors.mutedForeground }]}
                  >
                    {venue.distanceM} m
                  </Text>
                </View>
                <Text style={[styles.chevron, { color: colors.mutedForeground }]}>
                  ›
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.cancelBtn,
              { backgroundColor: pressed ? colors.border : colors.background },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("venue.cancel")}
          >
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
              {t("venue.cancel")}
            </Text>
          </Pressable>
        </Pressable>
        </Animated.View>
        </GestureDetector>
      </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrapper: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  list: {
    maxHeight: 320,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    fontSize: 18,
    lineHeight: 22,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  venueName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  distance: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  chevron: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: "Inter_400Regular",
  },
  cancelBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
});
