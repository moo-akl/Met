import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import {
  distanceBetweenMeters,
  type Coordinates,
  type HangoutSortMode,
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
  sortMode: HangoutSortMode;
  onSortModeChange: (value: HangoutSortMode) => void;
  nearestFallsBackToTime: boolean;
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
  sortMode,
  onSortModeChange,
  nearestFallsBackToTime,
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
      <View style={styles.sortRow} testID="hangouts-sort-options">
        <Text style={[styles.sortLabel, { color: colors.mutedForeground }]}>
          {t("tabs.events.sortBy")}
        </Text>
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
                styles.sortChip,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primarySoft : colors.card,
                },
              ]}
            >
              <Text style={[styles.sortChipText, { color: selected ? colors.primary : colors.text }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.locationRow}>
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
      {locationError ? (
        <Text accessibilityRole="alert" style={[styles.locationError, { color: colors.destructive }]}>
          {t(locationError === "permission" ? "tabs.events.locationDenied" : "tabs.events.locationUnavailable")}
        </Text>
      ) : null}
      {nearestFallsBackToTime ? (
        <Text testID="hangouts-nearest-fallback" style={[styles.locationHint, { color: colors.mutedForeground }]}>
          {t("tabs.events.nearestUsesTimeUntilLocation")}
        </Text>
      ) : null}

      {isLoading && hangouts.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError && hangouts.length === 0 ? (
        <View style={[styles.emptyCard, { borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("tabs.events.loadError")}</Text>
          <Pressable accessibilityRole="button" testID="hangouts-retry" onPress={onRetry}>
            <Text style={[styles.actionText, { color: colors.primary }]}>{t("common.retry")}</Text>
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
            const creatorLabel = event.creatorName ?? t("tabs.events.planHost");
            return (
              <Pressable
                key={`${event.eventType}:${event.id}`}
                accessibilityRole="button"
                accessibilityLabel={[event.title, creatorLabel, startLabel, locationLabel, distanceText].filter(Boolean).join(". ")}
                accessibilityHint={t("tabs.events.hangoutDetailsView")}
                testID={`nearby-hangout-${event.id}`}
                onPress={() => onPressHangout(event.id)}
                style={[styles.hangoutCard, { borderBottomColor: colors.border }]}
              >
                <View
                  testID={`nearby-hangout-banner-${event.id}`}
                  style={[styles.hangoutBanner, { backgroundColor: colors.primarySoft }]}
                >
                  {event.imageUrl ? (
                    <Image source={{ uri: event.imageUrl }} style={styles.bannerImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.bannerFallback}>
                      <Feather name="map-pin" size={34} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.bannerTopline}>
                    <Text style={[styles.bannerBadge, { color: colors.primary, backgroundColor: colors.card }]}>
                      {t("tabs.events.nearbyTab")}
                    </Text>
                    {distanceText ? (
                      <Text style={[styles.distanceLabel, { color: colors.primary, backgroundColor: colors.card }]}>
                        {t("tabs.events.distanceAway", { distance: distanceText })}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.bannerCreator, { backgroundColor: colors.card }]}>
                    {event.creatorPhotoUrl ? (
                      <Image
                        testID={`nearby-hangout-creator-photo-${event.id}`}
                        accessibilityLabel={creatorLabel}
                        source={{ uri: event.creatorPhotoUrl }}
                        style={[styles.creatorAvatar, { borderColor: colors.primary }]}
                      />
                    ) : (
                      <View style={[styles.creatorAvatar, styles.creatorAvatarFallback, { backgroundColor: colors.primarySoft }]}>
                        <Feather name="user" size={16} color={colors.primary} />
                      </View>
                    )}
                    <View style={styles.creatorCopy}>
                      <Text style={[styles.creatorKicker, { color: colors.mutedForeground }]}>
                        {t("tabs.events.createdBy")}
                      </Text>
                      <Text
                        testID={`nearby-hangout-creator-${event.id}`}
                        numberOfLines={1}
                        style={[styles.creatorName, { color: colors.text }]}
                      >
                        {creatorLabel}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.hangoutBody}>
                  <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
                  <Text style={[styles.eventMeta, { color: colors.mutedForeground }]}>{startLabel}</Text>
                  {locationLabel ? (
                    <Text style={[styles.eventMeta, { color: colors.mutedForeground }]}>{locationLabel}</Text>
                  ) : null}
                  {event.description ? (
                    <Text style={[styles.description, { color: colors.text }]} numberOfLines={2}>{event.description}</Text>
                  ) : null}
                  <View style={styles.detailsLink}>
                    <Text style={[styles.detailsLinkText, { color: colors.primary }]}>{t("tabs.events.hangoutDetailsView")}</Text>
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
          <Text style={[styles.actionText, { color: colors.destructive }]}>{t("common.retry")}</Text>
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
            <Text style={[styles.actionText, { color: colors.primary }]}>
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
  sortRow: { minHeight: 44, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  sortLabel: { fontSize: 12, fontWeight: "600", marginRight: "auto" },
  sortChip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sortChipText: { fontSize: 12, fontWeight: "600" },
  locationHint: { fontSize: 12, fontWeight: "600" },
  locationRow: { flexDirection: "row", justifyContent: "flex-end" },
  locationButton: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderRadius: 18, paddingHorizontal: 12 },
  locationButtonText: { fontSize: 11, fontWeight: "700" },
  locationError: { fontSize: 12, lineHeight: 17 },
  actionText: { fontSize: 12, fontWeight: "700" },
  emptyCard: { minHeight: 130, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 24, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", gap: 10 },
  loading: { minHeight: 110, alignItems: "center", justifyContent: "center" },
  loadMoreButton: { minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: "serif", fontSize: 20, fontWeight: "400", textAlign: "center" },
  eventList: { gap: 0, paddingTop: 3 },
  hangoutCard: { borderBottomWidth: StyleSheet.hairlineWidth, paddingTop: 18, paddingBottom: 19, gap: 11 },
  hangoutBanner: { height: 158, borderTopLeftRadius: 28, borderBottomRightRadius: 24, overflow: "hidden", justifyContent: "space-between", padding: 11 },
  bannerImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  bannerFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  bannerTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  bannerBadge: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 12, overflow: "hidden" },
  distanceLabel: { fontSize: 11, fontWeight: "700", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 12, overflow: "hidden" },
  bannerCreator: { alignSelf: "flex-start", maxWidth: "92%", minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8, padding: 6, paddingRight: 12, borderTopLeftRadius: 20, borderBottomRightRadius: 18 },
  creatorCopy: { minWidth: 0, flexShrink: 1 },
  creatorKicker: { fontSize: 9, lineHeight: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  hangoutBody: { minWidth: 0, paddingHorizontal: 2 },
  eventTitle: { fontFamily: "serif", fontSize: 20, fontWeight: "400", lineHeight: 26 },
  creatorAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2 },
  creatorAvatarFallback: { alignItems: "center", justifyContent: "center" },
  eventMeta: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  creatorName: { fontSize: 12, lineHeight: 16, fontWeight: "700" },
  description: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  detailsLink: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 2, marginTop: 8 },
  detailsLinkText: { fontSize: 12, fontWeight: "700" },
});
