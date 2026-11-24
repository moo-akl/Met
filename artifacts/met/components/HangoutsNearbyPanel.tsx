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
  formatApproximateDistance,
  type Coordinates,
  type HangoutSortMode,
} from "@/lib/hangoutDiscovery";
import type { NearbyHangoutItem } from "@workspace/api-client-react";

type Props = {
  hangouts: NearbyHangoutItem[];
  userLocation: Coordinates | null;
  sortMode: HangoutSortMode;
  onSortModeChange: (value: HangoutSortMode) => void;
  nearestFallsBackToTime: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isError: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onPressHangout: (event: NearbyHangoutItem) => void;
  onToggleJoinRequest?: (event: NearbyHangoutItem) => void;
  pendingJoinRequestId?: number | null;
  currentUserUid?: string | null;
};

export function HangoutsNearbyPanel({
  hangouts,
  userLocation,
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
  onToggleJoinRequest,
  pendingJoinRequestId = null,
  currentUserUid = null,
}: Props) {
  const colors = useColors();
  const { t, lang } = useT();

  return (
    <View style={styles.content}>
      <View
        style={[styles.sortRow, { borderColor: colors.border }]}
        testID="hangouts-sort-options"
      >
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
          {hangouts.map((event, index) => {
            const distance =
              userLocation && event.latitude != null && event.longitude != null
                ? distanceBetweenMeters(userLocation, {
                    latitude: event.latitude,
                    longitude: event.longitude,
                  })
                : null;
            const distanceText = distance == null
              ? null
              : formatApproximateDistance(distance, lang);
            const coverPhoto = event.galleryPhotos?.[0] ?? event.imageUrl;
            const locationLabel = event.location ?? "";
            const startLabel = new Date(event.startsAt).toLocaleString(lang);
            const creatorLabel = event.creatorName ?? t("tabs.events.planHost");
            const joinStatusLabel =
              event.myJoinRequestStatus === "pending"
                ? t("tabs.events.joinRequestPending")
                : event.myJoinRequestStatus === "accepted"
                  ? t("tabs.events.planInvitationAccepted")
                  : null;
            return (
              <Pressable
                key={`${event.eventType}:${event.id}`}
                accessibilityRole="button"
                accessibilityLabel={[
                  event.title,
                  `${t("tabs.events.createdBy")} ${creatorLabel}`,
                  startLabel,
                  locationLabel,
                  distanceText,
                  event.description,
                ].filter(Boolean).join(". ")}
                accessibilityHint={t("tabs.events.hangoutDetailsView")}
                testID={`nearby-hangout-${event.id}`}
                onPress={() => onPressHangout(event)}
                style={[
                  styles.hangoutCard,
                  index === 0 && styles.featuredHangout,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <View
                  testID={`nearby-hangout-banner-${event.id}`}
                  style={[
                    styles.hangoutBanner,
                    index === 0 && styles.featuredBanner,
                    { backgroundColor: colors.primarySoft },
                  ]}
                >
                  {coverPhoto ? (
                    <Image source={{ uri: coverPhoto }} style={styles.bannerImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.bannerFallback, { backgroundColor: colors.primarySoft }]}>
                      <View style={[styles.fallbackSun, { backgroundColor: colors.primary }]} />
                      <View style={[styles.fallbackHillBack, { backgroundColor: colors.card }]} />
                      <View style={[styles.fallbackHillFront, { backgroundColor: colors.primarySoft }]} />
                      <Feather name="map-pin" size={26} color={colors.primary} />
                    </View>
                  )}
                  <View
                    testID={`nearby-hangout-banner-topline-${event.id}`}
                    style={styles.bannerTopline}
                  >
                    <Text style={[styles.bannerBadge, { color: colors.primary, backgroundColor: colors.card }]}>
                      {t("tabs.events.nearbyTab")}
                    </Text>
                    {distanceText ? (
                      <Text
                        testID={`nearby-hangout-distance-${event.id}`}
                        style={[styles.distanceLabel, { color: colors.primary, backgroundColor: colors.card }]}
                      >
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
                  {joinStatusLabel ? (
                    <View
                      testID={`nearby-hangout-status-${event.id}`}
                      style={[
                        styles.joinStatus,
                        {
                          backgroundColor: colors.primarySoft,
                        },
                      ]}
                    >
                      <Feather
                        name={event.myJoinRequestStatus === "pending" ? "clock" : "check-circle"}
                        size={13}
                        color={colors.primary}
                      />
                      <Text style={[styles.joinStatusText, { color: colors.primary }]}>
                        {joinStatusLabel}
                      </Text>
                    </View>
                  ) : null}
                  {event.description ? (
                    <Text style={[styles.description, { color: colors.text }]}>{event.description}</Text>
                  ) : null}
                  <View style={styles.detailsLink}>
                    <Text style={[styles.detailsLinkText, { color: colors.primary }]}>{t("tabs.events.hangoutDetailsView")}</Text>
                    <Feather name="chevron-right" size={16} color={colors.primary} />
                  </View>
                  {onToggleJoinRequest && currentUserUid !== event.ownerUid ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        event.myJoinRequestStatus === "pending"
                          ? t("tabs.events.cancelJoinRequest")
                          : event.myJoinRequestStatus === "accepted"
                            ? t("tabs.events.planInvitationAccepted")
                            : t("tabs.events.requestToJoin")
                      }
                      accessibilityState={{
                        disabled: pendingJoinRequestId === event.id || event.myJoinRequestStatus === "accepted",
                        busy: pendingJoinRequestId === event.id,
                      }}
                      testID={`nearby-hangout-request-${event.id}`}
                      disabled={pendingJoinRequestId === event.id || event.myJoinRequestStatus === "accepted"}
                      onPress={(pressEvent) => {
                        pressEvent.stopPropagation();
                        onToggleJoinRequest(event);
                      }}
                      style={[
                        styles.requestButton,
                        {
                          borderColor: colors.border,
                          backgroundColor: event.myJoinRequestStatus === "accepted" ? colors.primarySoft : "transparent",
                          opacity: pendingJoinRequestId === event.id ? 0.65 : 1,
                        },
                      ]}
                    >
                      {pendingJoinRequestId === event.id ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Text style={[styles.requestButtonText, { color: colors.primary }]}>
                          {event.myJoinRequestStatus === "pending"
                            ? t("tabs.events.cancelJoinRequest")
                            : event.myJoinRequestStatus === "accepted"
                              ? t("tabs.events.planInvitationAccepted")
                              : t("tabs.events.requestToJoin")}
                        </Text>
                      )}
                    </Pressable>
                  ) : null}
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
          accessibilityLabel={t("tabs.events.loadMoreHangouts")}
          accessibilityState={{ busy: isLoadingMore, disabled: isLoadingMore }}
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
  sortRow: { minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7 },
  sortLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase", marginRight: "auto" },
  sortChip: { minHeight: 31, paddingHorizontal: 11, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sortChipText: { fontSize: 10, fontWeight: "700" },
  locationHint: { fontSize: 12, fontWeight: "600" },
  actionText: { fontSize: 12, fontWeight: "700" },
  emptyCard: { minHeight: 130, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 24, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", gap: 10 },
  loading: { minHeight: 110, alignItems: "center", justifyContent: "center" },
  loadMoreButton: { minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: "serif", fontSize: 20, fontWeight: "400", textAlign: "center" },
  eventList: { gap: 0, paddingTop: 3 },
  hangoutCard: { borderWidth: 1, borderRadius: 22, overflow: "hidden", marginBottom: 15, paddingBottom: 12, backgroundColor: "transparent" },
  featuredHangout: { paddingTop: 0 },
  hangoutBanner: { minHeight: 142, borderTopLeftRadius: 0, borderTopRightRadius: 0, overflow: "hidden", justifyContent: "space-between", padding: 11 },
  featuredBanner: { minHeight: 160, borderTopRightRadius: 0 },
  bannerImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  bannerFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  fallbackSun: { position: "absolute", right: 48, top: 32, width: 40, height: 40, borderRadius: 20, opacity: 0.2 },
  fallbackHillBack: { position: "absolute", width: 210, height: 86, left: -40, bottom: -48, borderRadius: 80, transform: [{ rotate: "-14deg" }] },
  fallbackHillFront: { position: "absolute", width: 240, height: 90, right: -45, bottom: -56, borderRadius: 90, transform: [{ rotate: "12deg" }] },
  bannerTopline: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  bannerBadge: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 12, overflow: "hidden" },
  distanceLabel: { fontSize: 11, fontWeight: "700", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 12, overflow: "hidden" },
  bannerCreator: { alignSelf: "flex-start", maxWidth: "92%", minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8, padding: 6, paddingRight: 12, borderTopLeftRadius: 20, borderBottomRightRadius: 18 },
  creatorCopy: { minWidth: 0, flexShrink: 1 },
  creatorKicker: { fontSize: 9, lineHeight: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  hangoutBody: { minWidth: 0, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 1 },
  eventTitle: { fontFamily: "serif", fontSize: 24, fontWeight: "400", lineHeight: 29 },
  creatorAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2 },
  creatorAvatarFallback: { alignItems: "center", justifyContent: "center" },
  eventMeta: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  creatorName: { fontSize: 12, lineHeight: 16, fontWeight: "700" },
  description: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  joinStatus: { alignSelf: "flex-start", maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 6, borderTopLeftRadius: 11, borderBottomRightRadius: 11, paddingHorizontal: 9, paddingVertical: 6, marginTop: 8 },
  joinStatusText: { flexShrink: 1, fontSize: 10, lineHeight: 14, fontWeight: "700" },
  detailsLink: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 2, marginTop: 8 },
  detailsLinkText: { fontSize: 12, fontWeight: "700" },
  requestButton: { minHeight: 34, alignSelf: "flex-end", justifyContent: "center", alignItems: "center", borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, marginTop: 8 },
  requestButtonText: { fontSize: 10, fontWeight: "700" },
});
