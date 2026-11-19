import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
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
import {
  getGetMyPastHangoutsQueryKey,
  useGetMyPastHangouts,
} from "@workspace/api-client-react";

export default function PastHangoutsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useT();
  const { authedUid } = useApp();
  const pastHangouts = useGetMyPastHangouts({
    query: {
      enabled: !!authedUid,
      staleTime: 30_000,
      refetchOnMount: "always",
      queryKey: [...getGetMyPastHangoutsQueryKey(), authedUid ?? "signed-out"],
    },
  });
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          testID="past-hangouts-back"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>
          {t("plans.pastHangoutsTitle")}
        </Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomInset + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!authedUid || pastHangouts.isLoading ? (
          <View style={styles.state} testID="past-hangouts-loading">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : pastHangouts.isError ? (
          <Pressable
            accessibilityRole="button"
            testID="past-hangouts-retry"
            onPress={() => void pastHangouts.refetch()}
            style={[
              styles.empty,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="refresh-cw" size={22} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t("plans.screenLoadError")}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              {t("plans.retry")}
            </Text>
          </Pressable>
        ) : (pastHangouts.data?.events.length ?? 0) === 0 ? (
          <View
            style={[
              styles.empty,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            testID="past-hangouts-empty"
          >
            <View
              style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}
            >
              <Feather name="archive" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t("plans.pastHangoutsTitle")}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              {t("plans.pastHangoutsEmpty")}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {pastHangouts.data?.events.map((event) => (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                accessibilityLabel={event.title}
                testID={`past-hangout-${event.id}`}
                onPress={() =>
                  router.push(`/event-details/member/${event.id}` as never)
                }
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <View
                  style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}
                >
                  <Feather name="calendar" size={17} color={colors.primary} />
                </View>
                <View style={styles.rowCopy}>
                  <Text
                    style={[styles.rowTitle, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {event.title}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
                    {new Date(event.startsAt).toLocaleDateString(lang)} ·{" "}
                    {event.creatorName ?? t("tabs.events.planHost")}
                  </Text>
                  <Text style={[styles.rowAction, { color: colors.primary }]}>
                    {event.myRating == null
                      ? t("plans.rateHost")
                      : `${t("plans.updateHostRating")} · ${event.myRating}/5`}
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerButton: { width: 38, height: 42, justifyContent: "center" },
  title: { flex: 1, fontFamily: "serif", fontSize: 30 },
  content: { paddingHorizontal: 20, paddingTop: 6 },
  state: { minHeight: 200, alignItems: "center", justifyContent: "center" },
  empty: {
    minHeight: 210,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 32,
    borderBottomRightRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  emptyBody: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  list: { gap: 9 },
  row: {
    minHeight: 82,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 24,
    borderBottomRightRadius: 20,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 14, lineHeight: 19, fontWeight: "700" },
  rowMeta: { fontSize: 11, lineHeight: 16 },
  rowAction: { fontSize: 12, fontWeight: "700", marginTop: 2 },
});
