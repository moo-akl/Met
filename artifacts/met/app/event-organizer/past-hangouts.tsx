import { Feather } from "@expo/vector-icons";
import { useGetHostPastHangouts } from "@workspace/api-client-react";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";

export default function HostPastHangoutsScreen() {
  const params = useLocalSearchParams<{ hostUid?: string | string[]; hostName?: string | string[] }>();
  const hostUid = Array.isArray(params.hostUid) ? params.hostUid[0] : params.hostUid;
  const hostName = Array.isArray(params.hostName) ? params.hostName[0] : params.hostName;
  const { authedUid } = useApp();
  const { t, lang } = useT();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const query = useGetHostPastHangouts(hostUid ?? "", {
    query: { enabled: !!authedUid && !!hostUid, staleTime: 30_000 },
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t("tabs.events.pastHangoutsTitle")}
        </Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
      >
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {t("tabs.events.pastHangoutsByHost", { name: hostName ?? "" })}
        </Text>
        {query.isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 30 }} />
        ) : query.isError ? (
          <View style={styles.emptyState}>
            <Feather name="alert-circle" size={24} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {t("tabs.events.reviewsLoadError")}
            </Text>
          </View>
        ) : query.data?.events.length ? (
          query.data.events.map((event) => {
            const photos = event.galleryPhotos.length
              ? event.galleryPhotos
              : event.imageUrl
                ? [event.imageUrl]
                : [];
            return (
              <View
                key={event.id}
                testID={`host-past-hangout-${event.id}`}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                {photos.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {photos.map((photo, index) => (
                      <Image
                        key={`${photo}-${index}`}
                        source={{ uri: photo }}
                        contentFit="cover"
                        style={styles.eventPhoto}
                      />
                    ))}
                  </ScrollView>
                ) : null}
                <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
                <Text style={[styles.eventDate, { color: colors.mutedForeground }]}>
                  {new Date(event.startsAt).toLocaleString(lang)}
                </Text>
                <View style={styles.ratingRow}>
                  <Feather name="star" size={15} color={colors.primary} />
                  <Text style={[styles.ratingText, { color: colors.text }]}>
                    {event.averageRating == null
                      ? t("tabs.events.noReviews")
                      : `${event.averageRating.toFixed(1)} · ${event.reviewCount}`}
                  </Text>
                </View>
                {event.reviews.length ? (
                  <View style={{ gap: 12 }}>
                    {event.reviews.map((review, index) => (
                      <View
                        key={`${review.createdAt}-${index}`}
                        style={[styles.review, { borderTopColor: colors.border }]}
                      >
                        <View style={styles.reviewHeader}>
                          <Text style={[styles.reviewerName, { color: colors.text }]}>
                            {review.reviewerName}
                          </Text>
                          <Text style={{ color: colors.primary }}>
                            {"★".repeat(review.rating)}
                          </Text>
                        </View>
                        {review.reviewText ? (
                          <Text style={[styles.reviewText, { color: colors.mutedForeground }]}>
                            {review.reviewText}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.eventDate, { color: colors.mutedForeground }]}>
                    {t("tabs.events.noReviews")}
                  </Text>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Feather name="archive" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {t("tabs.events.noPastHangouts")}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  content: { padding: 18, gap: 14 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 3 },
  emptyState: { alignItems: "center", justifyContent: "center", gap: 10, padding: 30 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  card: { gap: 12, borderWidth: 1, borderRadius: 18, padding: 15 },
  eventPhoto: { width: 250, height: 150, borderRadius: 13 },
  eventTitle: { fontSize: 17, fontWeight: "700" },
  eventDate: { fontSize: 13, lineHeight: 18 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratingText: { fontSize: 13, fontWeight: "600" },
  review: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 4 },
  reviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  reviewerName: { fontSize: 13, fontWeight: "600" },
  reviewText: { fontSize: 13, lineHeight: 19 },
});
