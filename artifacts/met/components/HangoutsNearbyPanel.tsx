import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import {
  distanceBetweenMeters,
  type Coordinates,
  type HangoutSortMode,
  type HangoutTimePeriod,
} from "@/lib/hangoutDiscovery";
import type { NearbyHangoutItem } from "@workspace/api-client-react";

type Props = {
  hangouts: NearbyHangoutItem[];
  userLocation: Coordinates | null;
  locationLoading: boolean;
  locationError: "permission" | "unavailable" | null;
  locationNeedsSettings: boolean;
  onUseLocation: () => void;
  onOpenSettings: () => void;
  locationQuery: string;
  onLocationQueryChange: (value: string) => void;
  dateQuery: string;
  onDateQueryChange: (value: string) => void;
  invalidDateFilter: boolean;
  timePeriod: HangoutTimePeriod;
  onTimePeriodChange: (value: HangoutTimePeriod) => void;
  sortMode: HangoutSortMode;
  onSortModeChange: (value: HangoutSortMode) => void;
  nearestFallsBackToTime: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
  isLoading: boolean;
  isLoadingMore: boolean;
  isError: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onPressHangout: (eventId: number) => void;
};

export function HangoutsNearbyPanel({
  hangouts,
  userLocation,
  locationLoading,
  locationError,
  locationNeedsSettings,
  onUseLocation,
  onOpenSettings,
  locationQuery,
  onLocationQueryChange,
  dateQuery,
  onDateQueryChange,
  invalidDateFilter,
  timePeriod,
  onTimePeriodChange,
  sortMode,
  onSortModeChange,
  nearestFallsBackToTime,
  hasFilters,
  onClearFilters,
  isLoading,
  isLoadingMore,
  isError,
  hasMore,
  onLoadMore,
  onRetry,
  onPressHangout,
}: Props) {
  const colors = useColors();
  const { t, lang } = useT();

  return (
    <View style={styles.content}>
      <View style={[styles.filters, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={[styles.filterInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            accessibilityLabel={t("tabs.events.locationSearch")}
            testID="hangouts-location-search"
            value={locationQuery}
            onChangeText={onLocationQueryChange}
            placeholder={t("tabs.events.locationSearch")}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.inputText, { color: colors.text }]}
            returnKeyType="search"
          />
          {locationQuery ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("tabs.events.clearFilters")}
              onPress={() => onLocationQueryChange("")}
              hitSlop={8}
            >
              <Feather name="x-circle" size={17} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.locationDateRow}>
          <View style={[styles.filterInput, styles.dateInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Feather name="calendar" size={15} color={colors.mutedForeground} />
            <TextInput
              accessibilityLabel={t("tabs.events.dateFilter")}
              testID="hangouts-date-filter"
              value={dateQuery}
              onChangeText={onDateQueryChange}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.inputText, { color: colors.text }]}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              returnKeyType="done"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={locationNeedsSettings
              ? t("tabs.events.openLocationSettings")
              : userLocation
                ? t("tabs.events.updateLocation")
                    : t("tabs.events.useLocation")}
            testID="hangouts-use-location"
            disabled={locationLoading}
            onPress={locationNeedsSettings ? onOpenSettings : onUseLocation}
            style={[styles.locationButton, { borderColor: colors.border, opacity: locationLoading ? 0.6 : 1 }]}
          >
            {locationLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name={userLocation ? "refresh-cw" : "crosshair"} size={15} color={colors.primary} />
            )}
            <Text numberOfLines={1} style={[styles.locationButtonText, { color: colors.primary }]}>
              {locationLoading
                ? t("tabs.events.findingLocation")
                : locationNeedsSettings
                  ? t("tabs.events.openLocationSettings")
                  : userLocation
                    ? t("tabs.events.updateLocation")
                    : t("tabs.events.useLocation")}
            </Text>
          </Pressable>
        </View>
        {userLocation ? (
          <Text style={[styles.locationHint, { color: colors.primary }]}>{t("tabs.events.nearbyFirst")}</Text>
        ) : null}
        {locationError ? (
          <Text accessibilityRole="alert" style={[styles.filterError, { color: colors.destructive }]}>
            {t(locationError === "permission" ? "tabs.events.locationDenied" : "tabs.events.locationUnavailable")}
          </Text>
        ) : null}
        {invalidDateFilter ? (
          <Text accessibilityRole="alert" style={[styles.filterError, { color: colors.destructive }]}>
            {t("tabs.events.invalidDate")}
          </Text>
        ) : null}

        <View style={styles.filterHeadingRow}>
          <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>{t("tabs.events.timeFilter")}</Text>
          {hasFilters ? (
            <Pressable
              accessibilityRole="button"
              testID="hangouts-clear-filters"
              onPress={onClearFilters}
            >
              <Text style={[styles.clearFilters, { color: colors.primary }]}>{t("tabs.events.clearFilters")}</Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {([
            ["any", t("tabs.events.anyTime")],
            ["morning", t("tabs.events.morning")],
            ["afternoon", t("tabs.events.afternoon")],
            ["evening", t("tabs.events.evening")],
            ["night", t("tabs.events.night")],
          ] as const).map(([period, label]) => {
            const selected = timePeriod === period;
            return (
              <Pressable
                key={period}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                testID={`hangouts-time-${period}`}
                onPress={() => onTimePeriodChange(period)}
                style={[
                  styles.filterChip,
                  { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : "transparent" },
                ]}
              >
                <Text style={[styles.filterChipText, { color: selected ? colors.primary : colors.text }]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>{t("tabs.events.sortBy")}</Text>
        <View style={styles.chipRow}>
          {([
            ["nearest", t("tabs.events.sortNearest")],
            ["soonest", t("tabs.events.sortSoonest")],
          ] as const).map(([mode, label]) => {
            const selected = sortMode === mode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                testID={`hangouts-sort-${mode}`}
                onPress={() => onSortModeChange(mode)}
                style={[
                  styles.filterChip,
                  { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : "transparent" },
                ]}
              >
                <Text style={[styles.filterChipText, { color: selected ? colors.primary : colors.text }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {nearestFallsBackToTime ? (
          <Text testID="hangouts-nearest-fallback" style={[styles.locationHint, { color: colors.mutedForeground }]}>
            {t("tabs.events.nearestUsesTimeUntilLocation")}
          </Text>
        ) : null}
      </View>

      {isLoading && hangouts.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError && hangouts.length === 0 ? (
        <View style={[styles.emptyCard, { borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("tabs.events.loadError")}</Text>
          <Pressable accessibilityRole="button" testID="hangouts-retry" onPress={onRetry}>
            <Text style={[styles.clearFilters, { color: colors.primary }]}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : hangouts.length === 0 ? (
        <View style={[styles.emptyCard, { borderColor: colors.border }]}>
          <Feather name="map-pin" size={24} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("tabs.events.noHangouts")}</Text>
        </View>
      ) : (
        <View style={styles.eventList}>
          {hangouts.map((event) => {
            const distance =
              userLocation && event.latitude != null && event.longitude != null
                ? distanceBetweenMeters(userLocation, {
                    latitude: event.latitude,
                    longitude: event.longitude,
                  })
                : null;
            const distanceText = distance == null
              ? null
              : distance < 1000
                ? `${Math.round(distance)} m`
                : `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(distance / 1000)} km`;
            const locationLabel = event.location ?? "";
            const startLabel = new Date(event.startsAt).toLocaleString(lang);
            return (
              <Pressable
                key={`${event.eventType}:${event.id}`}
                accessibilityRole="button"
                accessibilityLabel={[event.title, startLabel, locationLabel, distanceText].filter(Boolean).join(". ")}
                accessibilityHint={t("tabs.events.detailsView")}
                testID={`nearby-hangout-${event.id}`}
                onPress={() => onPressHangout(event.id)}
                style={[styles.hangoutCard, { borderBottomColor: colors.border }]}
              >
                {event.imageUrl ? <Image source={{ uri: event.imageUrl }} style={styles.cover} resizeMode="cover" /> : null}
                <View style={styles.hangoutBody}>
                  <View style={styles.cardTopline}>
                    <Text style={[styles.badge, { color: colors.primary }]}>{t("tabs.events.nearbyTab")}</Text>
                    {distanceText ? (
                      <Text style={[styles.distanceLabel, { color: colors.primary }]}>
                        {t("tabs.events.distanceAway", { distance: distanceText })}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
                  <Text style={[styles.eventMeta, { color: colors.mutedForeground }]}>{startLabel}</Text>
                  {locationLabel ? (
                    <Text style={[styles.eventMeta, { color: colors.mutedForeground }]}>{locationLabel}</Text>
                  ) : null}
                  {event.description ? (
                    <Text style={[styles.description, { color: colors.text }]} numberOfLines={2}>{event.description}</Text>
                  ) : null}
                  <View style={styles.detailsLink}>
                    <Text style={[styles.detailsLinkText, { color: colors.primary }]}>{t("tabs.events.detailsView")}</Text>
                    <Feather name="chevron-right" size={16} color={colors.primary} />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      {hangouts.length > 0 && isError ? (
        <Pressable accessibilityRole="button" testID="hangouts-retry" onPress={onRetry}>
          <Text style={[styles.clearFilters, { color: colors.destructive }]}>{t("common.retry")}</Text>
        </Pressable>
      ) : null}
      {hasMore ? (
        <Pressable
          accessibilityRole="button"
          testID="hangouts-load-more"
          disabled={isLoadingMore}
          onPress={onLoadMore}
          style={[styles.loadMoreButton, { borderColor: colors.border }]}
        >
          {isLoadingMore ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.clearFilters, { color: colors.primary }]}>
              {t("tabs.events.loadMoreHangouts")}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  filters: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 13 },
  filterInput: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  inputText: { flex: 1, minWidth: 0, paddingVertical: 9, fontSize: 14 },
  locationDateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateInput: { flex: 1, minWidth: 0 },
  locationButton: { minHeight: 44, maxWidth: "54%", borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 7 },
  locationButtonText: { fontSize: 11, fontWeight: "700", flexShrink: 1 },
  locationHint: { fontSize: 12, fontWeight: "600" },
  filterError: { fontSize: 12, lineHeight: 17 },
  filterHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filterLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  clearFilters: { fontSize: 12, fontWeight: "700" },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  filterChip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  filterChipText: { fontSize: 12, fontWeight: "600" },
  emptyCard: { minHeight: 130, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 24, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", gap: 10 },
  loading: { minHeight: 110, alignItems: "center", justifyContent: "center" },
  loadMoreButton: { minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: "serif", fontSize: 20, fontWeight: "400", textAlign: "center" },
  eventList: { gap: 0 },
  hangoutCard: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 18 },
  cover: { width: "100%", height: 170 },
  hangoutBody: { paddingTop: 13, paddingBottom: 8 },
  cardTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  badge: { fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  distanceLabel: { fontSize: 11, fontWeight: "700" },
  eventTitle: { fontFamily: "serif", fontSize: 22, fontWeight: "400", lineHeight: 28 },
  eventMeta: { fontSize: 13, marginTop: 5 },
  description: { fontSize: 14, lineHeight: 20, marginTop: 9 },
  detailsLink: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 2, marginTop: 10 },
  detailsLinkText: { fontSize: 12, fontWeight: "700" },
});
