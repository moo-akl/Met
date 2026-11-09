import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import { useFonts } from "expo-font";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import type {
  EventMapPin,
  EventMapPinSelection,
} from "@/lib/eventMapPins";

interface Props {
  event: EventMapPin;
  onPress: () => void;
}

export function EventMapMarker({ event, onPress }: Props) {
  const colors = useColors();
  const [fontsLoaded] = useFonts(Feather.font);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const isPrivate = event.visibility === "invite_only";
  const pinColor = isPrivate ? colors.text : colors.primary;
  const iconColor = isPrivate ? colors.background : colors.card;
  const icon = isPrivate
    ? "lock"
    : event.joinApprovalRequired
      ? "users"
      : "calendar";

  useEffect(() => {
    setTracksViewChanges(true);
    if (!fontsLoaded) return;
    const timer = setTimeout(() => setTracksViewChanges(false), 250);
    return () => clearTimeout(timer);
  }, [fontsLoaded, pinColor, icon]);

  return (
    <Marker
      identifier={`event-map-${event.eventType}-${event.id}`}
      coordinate={{ latitude: event.latitude, longitude: event.longitude }}
      anchor={{ x: 0.5, y: 1 }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
      accessibilityLabel={event.title}
    >
      <View style={styles.container}>
        <View
          style={[
            styles.icon,
            {
              backgroundColor: pinColor,
              borderColor: colors.card,
              shadowColor: colors.text,
            },
          ]}
        >
          <Feather name={icon} size={15} color={iconColor} />
        </View>
        <View style={[styles.tail, { borderTopColor: pinColor }]} />
      </View>
    </Marker>
  );
}

interface FilterProps {
  selection: EventMapPinSelection;
  onChange: (selection: EventMapPinSelection) => void;
}

export function EventMapFilterControl({
  selection,
  onChange,
}: FilterProps) {
  const colors = useColors();
  const { t, rtl } = useT();

  const toggle = (key: keyof EventMapPinSelection) => {
    const next = { ...selection, [key]: !selection[key] };
    if (!next.events && !next.hangouts) return;
    onChange(next);
  };

  return (
    <View
      style={[
        styles.filterControls,
        rtl && styles.filterControlsRtl,
      ]}
    >
      {([
        ["events", t("tabs.events.title")],
        ["hangouts", t("tabs.events.nearbyTab")],
      ] as const).map(([key, label]) => {
        const checked = selection[key];
        return (
          <Pressable
            key={key}
            accessibilityLabel={label}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            onPress={() => toggle(key)}
            style={({ pressed }) => [
              styles.filterButton,
              {
                backgroundColor: checked ? colors.primarySoft : colors.card,
                borderColor: checked ? colors.primary : colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            testID={`event-map-filter-${key}`}
          >
            <Feather
              name={checked ? "check-square" : "square"}
              size={15}
              color={checked ? colors.primary : colors.mutedForeground}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.filterLabel,
                { color: checked ? colors.primary : colors.mutedForeground },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface PreviewProps {
  event: EventMapPin;
  onClose: () => void;
  onOpenDetails: () => void;
}

export function EventMapPreview({
  event,
  onClose,
  onOpenDetails,
}: PreviewProps) {
  const colors = useColors();
  const { t, lang } = useT();
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  const startTime = start.toLocaleString(lang, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const endTime =
    end && Number.isFinite(end.getTime())
      ? end.toLocaleTimeString(lang, {
          hour: "numeric",
          minute: "2-digit",
        })
      : null;
  const timeLabel = endTime ? `${startTime} – ${endTime}` : startTime;
  const location = event.location?.trim() || event.venueName?.trim();
  const accessibleLocation =
    location || `${event.latitude.toFixed(4)}, ${event.longitude.toFixed(4)}`;

  return (
    <View
      accessibilityViewIsModal
      style={[
        styles.preview,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: colors.text,
        },
      ]}
      testID="event-map-preview"
    >
      <View style={styles.previewHeader}>
        <View style={styles.previewCopy}>
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            style={[styles.previewTitle, { color: colors.text }]}
            testID="event-map-preview-title"
          >
            {event.title}
          </Text>
          <View style={styles.previewMeta}>
            <Feather name="calendar" size={14} color={colors.primary} />
            <Text
              numberOfLines={1}
              style={[styles.previewMetaText, { color: colors.mutedForeground }]}
              testID="event-map-preview-time"
            >
              {timeLabel}
            </Text>
          </View>
          <View style={styles.previewMeta}>
            <Feather name="map-pin" size={14} color={colors.primary} />
            <Text
              numberOfLines={1}
              style={[styles.previewMetaText, { color: colors.mutedForeground }]}
              testID="event-map-preview-location"
            >
              {accessibleLocation}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel={t("common.close")}
          accessibilityRole="button"
          onPress={onClose}
          style={styles.closeButton}
          testID="event-map-preview-close"
        >
          <Feather name="x" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <Pressable
        accessibilityLabel={t("tabs.events.detailsView")}
        accessibilityRole="button"
        onPress={onOpenDetails}
        style={({ pressed }) => [
          styles.detailsButton,
          {
            backgroundColor: colors.primary,
            opacity: pressed ? 0.82 : 1,
          },
        ]}
        testID="event-map-open-details"
      >
        <Text style={[styles.detailsButtonText, { color: colors.card }]}>
          {t("tabs.events.detailsView")}
        </Text>
        <Feather name="arrow-right" size={15} color={colors.card} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },
  filterControls: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    zIndex: 4,
    flexDirection: "row",
    gap: 8,
  },
  filterControlsRtl: {
    flexDirection: "row-reverse",
  },
  filterButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  preview: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 13,
    gap: 11,
    shadowOpacity: 0.18,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  previewCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  previewMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minWidth: 0,
  },
  previewMetaText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  closeButton: {
    padding: 4,
    marginTop: -3,
    marginRight: -3,
  },
  detailsButton: {
    minHeight: 38,
    borderRadius: 11,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailsButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
