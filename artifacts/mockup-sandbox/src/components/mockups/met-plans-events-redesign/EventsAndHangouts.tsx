import React, { useState } from "react";
import { ActivityIndicator, Feather, Image, Pressable, ScrollView, StyleSheet, Text, View, useColors, useT } from "./rnDom";

type EventRecord = {
  id: string;
  eventType: "venue" | "member";
  title: string;
  startsAt: string;
  location?: string | null;
  venueName?: string | null;
  creatorName?: string | null;
  description?: string;
  imageUrl?: string;
  visibility?: "public" | "invite_only";
  verifiedExplorersOnly?: boolean;
  isVerifiedExplorerHost?: boolean;
  rsvpCount: number;
  myRsvp?: "going" | "maybe" | "not_going";
  creatorPhotoUrl?: string;
  latitude?: number;
  longitude?: number;
  myJoinRequestStatus?: "accepted" | "pending";
};
const after = (days: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};
const events: EventRecord[] = [
  { id: "venue-301", eventType: "venue", title: "Live jazz at The Chapel", startsAt: after(1, 19), venueName: "The Chapel · San Francisco", description: "An intimate evening of live jazz in the heart of the Mission.", imageUrl: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=1100&q=80", rsvpCount: 48, myRsvp: "going" },
  { id: "member-302", eventType: "member", title: "Sunday ceramics and coffee", startsAt: after(4, 11), location: "Clayroom, San Francisco", creatorName: "Maya Chen", description: "A relaxed beginner-friendly pottery session followed by coffee nearby.", imageUrl: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1100&q=80", rsvpCount: 12, myRsvp: "maybe", visibility: "public" },
  { id: "member-303", eventType: "member", title: "Neighborhood book swap", startsAt: after(7, 15), location: "Mission Dolores", description: "Bring a book you loved and leave with a new one.", rsvpCount: 9, visibility: "invite_only" },
];
const hangouts: EventRecord[] = [
  { id: "hangout-401", eventType: "member", title: "Golden hour picnic at Dolores Park", startsAt: after(2, 18), location: "Dolores Park, San Francisco", description: "Bring a blanket and something to share. New friends welcome.", imageUrl: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1100&q=80", rsvpCount: 5, latitude: 37.7596, longitude: -122.4269, creatorName: "Leah Martin", myJoinRequestStatus: "accepted" },
  { id: "hangout-402", eventType: "member", title: "Coffee and a coastal walk", startsAt: after(3, 9), location: "Lands End Lookout", description: "Easy-paced morning walk with a coffee stop along the way.", rsvpCount: 3, latitude: 37.7805, longitude: -122.5032, creatorName: "Jordan Lee", myJoinRequestStatus: "pending" },
  { id: "hangout-403", eventType: "member", title: "Sunset volleyball", startsAt: after(5, 17), location: "Ocean Beach, San Francisco", description: "Casual games, all skill levels. Just bring your energy.", rsvpCount: 7, latitude: 37.7594, longitude: -122.5107, creatorName: "Alex Rivera" },
];
const noop = () => {};
const staticFeedState = { isLoading: false, isError: false };
const staticHangoutState = { isLoading: false, isLoadingMore: false, isError: false, hasMore: false };
function getPreviewLocation(): { latitude: number; longitude: number } | null {
  return null;
}

function HangoutsNearbyPanel() {
  const colors = useColors();
  const { t, lang } = useT();
  const [sortMode, setSortMode] = useState<"nearest" | "soonest">("nearest");
  const userLocation = getPreviewLocation();
  return (
    <View style={hangoutStyles.content}>
      <View style={hangoutStyles.sortRow} testID="hangouts-sort-options">
        <Text style={[hangoutStyles.sortLabel, { color: colors.mutedForeground }]}>{t("tabs.events.sortBy")}</Text>
        {([["nearest", t("tabs.events.sortNearest")], ["soonest", t("tabs.events.sortSoonest")]] as const).map(([mode, label]) => {
          const selected = sortMode === mode;
          return <Pressable key={mode} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} testID={`hangouts-sort-${mode}`} onPress={() => setSortMode(mode)} style={[hangoutStyles.sortChip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.card }]}><Text style={[hangoutStyles.sortChipText, { color: selected ? colors.primary : colors.text }]}>{label}</Text></Pressable>;
        })}
      </View>
      {sortMode === "nearest" && !userLocation ? <Text testID="hangouts-nearest-fallback" style={[hangoutStyles.locationHint, { color: colors.mutedForeground }]}>{t("tabs.events.nearestUsesTimeUntilLocation")}</Text> : null}
      {staticHangoutState.isLoading && hangouts.length === 0 ? (
        <View style={hangoutStyles.loading}><ActivityIndicator color={colors.primary} /></View>
      ) : staticHangoutState.isError && hangouts.length === 0 ? (
        <View style={[hangoutStyles.emptyCard, { borderColor: colors.border }]}>
          <Text style={[hangoutStyles.emptyTitle, { color: colors.text }]}>{t("tabs.events.loadError")}</Text>
          <Pressable accessibilityRole="button" testID="hangouts-retry" onPress={noop}><Text style={[hangoutStyles.clearFilters, { color: colors.primary }]}>{t("common.retry")}</Text></Pressable>
        </View>
      ) : hangouts.length === 0 ? (
        <View style={[hangoutStyles.emptyCard, { borderColor: colors.border }]}><Feather name="map-pin" size={24} color={colors.primary} /><Text style={[hangoutStyles.emptyTitle, { color: colors.text }]}>{t("tabs.events.noHangouts")}</Text></View>
      ) : (
        <View style={hangoutStyles.eventList}>
          {hangouts.map((event) => {
            const distance = userLocation && event.latitude != null && event.longitude != null
              ? Math.round(Math.hypot((event.latitude - userLocation.latitude) * 111_000, (event.longitude - userLocation.longitude) * 88_000))
              : null;
            const distanceText = distance == null ? null : distance < 1000 ? `${distance} m` : `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(distance / 1000)} km`;
            const locationLabel = event.location ?? "";
            const startLabel = new Date(event.startsAt).toLocaleString(lang);
            return (
              <Pressable key={`${event.eventType}:${event.id}`} accessibilityRole="button" accessibilityLabel={[event.title, startLabel, locationLabel, distanceText].filter(Boolean).join(". ")} accessibilityHint={t("tabs.events.detailsView")} testID={`nearby-hangout-${event.id}`} onPress={noop} style={[hangoutStyles.hangoutCard, { borderBottomColor: colors.border }]}>
                {event.imageUrl ? <Image source={{ uri: event.imageUrl }} style={hangoutStyles.cover} resizeMode="cover" /> : null}
                <View style={hangoutStyles.hangoutBody}>
                  <View style={hangoutStyles.cardTopline}>
                    <Text style={[hangoutStyles.badge, { color: colors.primary }]}>{t("tabs.events.nearbyTab")}</Text>
                    {distanceText ? <Text style={[hangoutStyles.distanceLabel, { color: colors.primary }]}>{t("tabs.events.distanceAway", { distance: distanceText })}</Text> : null}
                  </View>
                  <View style={hangoutStyles.titleRow}>
                    <View style={hangoutStyles.titleCopy}>
                      <Text style={[hangoutStyles.eventTitle, { color: colors.text }]}>{event.title}</Text>
                      <Text style={[hangoutStyles.eventMeta, { color: colors.mutedForeground }]}>{startLabel}</Text>
                      {locationLabel ? <Text style={[hangoutStyles.eventMeta, { color: colors.mutedForeground }]}>{locationLabel}</Text> : null}
                    </View>
                    {event.creatorPhotoUrl ? <Image accessibilityLabel={event.creatorName} source={{ uri: event.creatorPhotoUrl }} style={hangoutStyles.creatorAvatar} /> : <View style={[hangoutStyles.creatorAvatar, hangoutStyles.creatorAvatarFallback, { backgroundColor: colors.primarySoft }]}><Feather name="user" size={18} color={colors.primary} /></View>}
                  </View>
                  {event.description ? <Text style={[hangoutStyles.description, { color: colors.text }]} numberOfLines={2}>{event.description}</Text> : null}
                  <View style={hangoutStyles.detailsLink}><Text style={[hangoutStyles.detailsLinkText, { color: colors.primary }]}>{t("tabs.events.detailsView")}</Text><Feather name="chevron-right" size={16} color={colors.primary} /></View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      {hangouts.length > 0 && staticHangoutState.isError ? <Pressable accessibilityRole="button" testID="hangouts-retry" onPress={noop}><Text style={[hangoutStyles.clearFilters, { color: colors.destructive }]}>{t("common.retry")}</Text></Pressable> : null}
      {staticHangoutState.hasMore ? <Pressable accessibilityRole="button" testID="hangouts-load-more" disabled={staticHangoutState.isLoadingMore} onPress={noop} style={[hangoutStyles.loadMoreButton, { borderColor: colors.border }]}>{staticHangoutState.isLoadingMore ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[hangoutStyles.clearFilters, { color: colors.primary }]}>{t("tabs.events.loadMoreHangouts")}</Text>}</Pressable> : null}
    </View>
  );
}

export function EventsAndHangouts({ initialView }: { initialView: "events" | "hangouts" }) {
  const colors = useColors();
  const { t, lang } = useT();
  const [activeView, setActiveView] = useState<"events" | "hangouts">(initialView);
  const groups = events.reduce((result, event) => {
    const date = new Date(event.startsAt);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    let group = result.find((item) => item.key === key);
    if (!group) {
      group = { key, label: date.toLocaleDateString(lang, { weekday: "long", month: "long", day: "numeric" }), events: [] as EventRecord[] };
      result.push(group);
    }
    group.events.push(event);
    return result;
  }, [] as { key: string; label: string; events: EventRecord[] }[]);
  return (
    <View className="met-plans-events" style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 12, paddingBottom: 112 }]}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>{activeView === "hangouts" ? t("tabs.events.nearbyTab") : t("tabs.events.title")}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{activeView === "hangouts" ? t("tabs.events.nearbySubtitle") : t("tabs.events.subtitle")}</Text>
            {activeView === "events" ? <Pressable accessibilityRole="button" accessibilityLabel={t("tabs.events.enableNearby")} testID="events-enable-nearby-sorting" onPress={noop}><Text style={[styles.locationAction, { color: colors.primary }]}>{t("tabs.events.enableNearby")}</Text></Pressable> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={activeView === "hangouts" ? t("tabs.events.quickPlan") : t("tabs.events.create")} onPress={noop} style={[styles.iconButton, { backgroundColor: colors.primary }]}><Feather name="plus" size={21} color={colors.primaryForeground} /></Pressable>
        </View>
        <View style={[styles.viewTabs, { borderColor: colors.border }]}>
          {([["events", t("tabs.events.title"), "calendar"], ["hangouts", t("tabs.events.nearbyTab"), "map-pin"]] as const).map(([view, label, icon]) => {
            const selected = activeView === view;
            return <Pressable key={view} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} testID={`events-view-${view}`} onPress={() => setActiveView(view)} style={[styles.viewTab, selected && { backgroundColor: colors.primarySoft }]}><Feather name={icon} size={16} color={selected ? colors.primary : colors.mutedForeground} /><Text style={[styles.viewTabText, { color: selected ? colors.primary : colors.mutedForeground }]}>{label}</Text></Pressable>;
          })}
        </View>
        {staticFeedState.isLoading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
        ) : staticFeedState.isError ? (
          <View style={[styles.emptyCard, { backgroundColor: "transparent", borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("tabs.events.loadError")}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t("tabs.events.refreshHint")}</Text>
          </View>
        ) : activeView === "events" ? (
          <>
            <Pressable accessibilityRole="button" onPress={noop} style={[styles.networkLink, { backgroundColor: "transparent", borderColor: colors.border }]}>
              <View style={[styles.networkIcon, { backgroundColor: colors.primarySoft }]}><Feather name="users" size={18} color={colors.primary} /></View>
              <View style={styles.networkCopy}><Text style={[styles.networkTitle, { color: colors.text }]}>{t("tabs.events.networks")}</Text><Text style={[styles.networkDescription, { color: colors.mutedForeground }]}>Your existing groups, membership, and invites</Text></View>
              <Feather name="chevron-right" size={19} color={colors.mutedForeground} />
            </Pressable>
            {events.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: "transparent", borderColor: colors.border }]}>
                <Feather name="calendar" size={24} color={colors.primary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("tabs.events.empty")}</Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t("tabs.events.emptyBody")}</Text>
              </View>
            ) : <View style={styles.eventList}>
              {groups.map((group) => <View key={group.key} style={styles.eventDateGroup}>
                <Text accessibilityRole="header" style={[styles.eventDateHeading, { color: colors.primary, textAlign: "left" }]}>{group.label}</Text>
                {group.events.map((event) => {
                  const eventTypeLabel = event.eventType === "venue" ? t("tabs.events.venueEvent") : t("tabs.events.memberEvent");
                  const eventTimeLabel = new Date(event.startsAt).toLocaleString(lang);
                  return <View key={`${event.eventType}:${event.id}`} style={[styles.eventCard, { borderBottomColor: colors.border }]}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${event.title}. ${eventTypeLabel}. ${eventTimeLabel}. ${event.location ?? event.venueName ?? event.creatorName ?? ""}`} accessibilityHint={t("tabs.events.detailsView")} testID={`event-card-${event.eventType}-${event.id}`} onPress={noop}>
                      {event.imageUrl ? <Image source={{ uri: event.imageUrl }} style={styles.cover} resizeMode="cover" /> : null}
                      <View style={styles.eventBody}>
                        <View style={styles.badgeRow}><Text style={[styles.badge, { color: colors.primary, backgroundColor: "transparent" }]}>{eventTypeLabel}</Text>{event.visibility === "invite_only" ? <Text style={[styles.privateBadge, { color: colors.mutedForeground }]}>{t("tabs.events.inviteOnly")}</Text> : null}{event.verifiedExplorersOnly ? <Text style={[styles.privateBadge, { color: colors.primary }]}>{t("verifiedExplorer.eventOnly")}</Text> : null}</View>
                        <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
                        <Text style={[styles.eventMeta, { color: colors.mutedForeground }]}>{eventTimeLabel}</Text>
                        {(event.location || event.venueName || event.creatorName) ? <Text style={[styles.eventMeta, { color: colors.mutedForeground }]}>{event.location ?? event.venueName ?? event.creatorName}</Text> : null}
                        {event.description ? <Text style={[styles.description, { color: colors.text }]} numberOfLines={3}>{event.description}</Text> : null}
                        <View style={styles.detailsLink}><Text style={[styles.detailsLinkText, { color: colors.primary }]}>{t("tabs.events.detailsView")}</Text><Feather name="chevron-right" size={16} color={colors.primary} /></View>
                      </View>
                    </Pressable>
                    <View style={[styles.rsvpFooter, { borderTopColor: colors.border }]}><View style={styles.rsvpRow}>
                      <Text style={[styles.rsvpCount, { color: colors.mutedForeground }]}>{event.rsvpCount} · {t("tabs.events.going")}</Text>
                      {([["going", t("tabs.events.going")], ["maybe", t("tabs.events.interested")], ["not_going", t("tabs.events.notGoing")]] as const).map(([status, label]) => {
                        const selected = event.myRsvp === status;
                        return <Pressable key={status} accessibilityRole="button" accessibilityLabel={`${event.title}, ${label}`} accessibilityState={{ selected }} testID={`event-rsvp-${event.eventType}-${event.id}-${status}`} onPress={noop} style={[styles.rsvpButton, { backgroundColor: selected ? colors.primary : "transparent", borderColor: selected ? colors.primary : colors.border }]}><Text style={[styles.rsvpButtonText, { color: selected ? colors.primaryForeground : colors.text }]}>{label}</Text></Pressable>;
                      })}
                    </View></View>
                  </View>;
                })}
              </View>)}
            </View>}
          </>
        ) : <HangoutsNearbyPanel />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { fontFamily: "serif", fontSize: 31, fontWeight: "400", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  viewTabs: { flexDirection: "row", borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 4, gap: 4 },
  viewTab: { flex: 1, minHeight: 42, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 5 },
  viewTabText: { fontSize: 12, fontWeight: "700" },
  locationAction: { fontSize: 12, fontWeight: "700", marginTop: 6 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  networkLink: { borderWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  networkIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  networkCopy: { flex: 1 },
  networkTitle: { fontSize: 15, fontWeight: "700" },
  networkDescription: { fontSize: 12, marginTop: 3 },
  loading: { paddingVertical: 56, alignItems: "center" },
  emptyCard: { borderWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 24, paddingHorizontal: 12, alignItems: "center", gap: 8 },
  emptyTitle: { fontFamily: "serif", fontSize: 21, fontWeight: "400", marginTop: 4 },
  eventList: { gap: 0 },
  eventDateGroup: { gap: 0 },
  eventDateHeading: { fontFamily: "serif", fontSize: 20, fontWeight: "400", marginTop: 8, marginBottom: 10 },
  eventCard: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 18 },
  cover: { width: "100%", height: 170 },
  eventBody: { paddingTop: 13, paddingBottom: 8 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  badge: { fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", paddingHorizontal: 0, paddingVertical: 0 },
  privateBadge: { fontSize: 11, fontWeight: "600" },
  eventTitle: { fontFamily: "serif", fontSize: 22, fontWeight: "400", lineHeight: 28 },
  eventMeta: { fontSize: 13, marginTop: 5 },
  description: { fontSize: 14, lineHeight: 20, marginTop: 9 },
  detailsLink: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 2, marginTop: 10 },
  detailsLinkText: { fontSize: 12, fontWeight: "700" },
  rsvpFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, paddingBottom: 2 },
  rsvpRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rsvpCount: { flex: 1, fontSize: 12 },
  rsvpButton: { flex: 1, minWidth: 0, minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  rsvpButtonText: { fontSize: 11, fontWeight: "700", textAlign: "center" },
});

const hangoutStyles = StyleSheet.create({
  content: { gap: 14 },
  sortRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8 },
  sortLabel: { fontSize: 12, fontWeight: "600", marginRight: "auto" },
  sortChip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sortChipText: { fontSize: 12, fontWeight: "600" },
  locationHint: { fontSize: 12, fontWeight: "600" },
  clearFilters: { fontSize: 12, fontWeight: "700" },
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
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  titleCopy: { flex: 1 },
  creatorAvatar: { width: 42, height: 42, borderRadius: 21 },
  creatorAvatarFallback: { alignItems: "center", justifyContent: "center" },
  eventMeta: { fontSize: 13, marginTop: 5 },
  description: { fontSize: 14, lineHeight: 20, marginTop: 9 },
  detailsLink: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 2, marginTop: 10 },
  detailsLinkText: { fontSize: 12, fontWeight: "700" },
});
