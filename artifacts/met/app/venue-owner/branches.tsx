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
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { useVenueOwner } from "@/hooks/useVenueOwner";
import { useT } from "@/lib/i18n";
import type { VenueApplicationStatus } from "@/lib/api/client";

const STATUS_TRANSLATIONS: Record<VenueApplicationStatus, string> = {
  draft: "venueBranchesStatusDraft",
  submitted: "venueBranchesStatusSubmitted",
  under_review: "venueBranchesStatusUnderReview",
  changes_requested: "venueBranchesStatusChangesRequested",
  rejected: "venueBranchesStatusRejected",
  resubmitted: "venueBranchesStatusResubmitted",
  approved: "venueBranchesApproved",
  withdrawn: "venueBranchesStatusWithdrawn",
  expired: "venueBranchesStatusExpired",
};

export default function VenueOwnerBranchesScreen() {
  const { t } = useT();
  const { isDark } = useTheme();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    branches,
    branchApplications,
    activeBusinessId,
    isLoading,
    error,
    branchError,
    refetch,
    selectBranch,
  } = useVenueOwner();

  const palette = {
    background: colors.background,
    card: colors.card,
    border: colors.border,
    text: colors.foreground,
    muted: colors.mutedForeground,
    accent: colors.primary,
    buttonText: colors.primaryForeground,
    selected: colors.secondary,
    warning: isDark ? colors.primary : colors.secondaryForeground,
    radius: colors.radius,
  };
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const openApplication = () =>
    router.push("/venue-owner/setup?branch=1" as never);

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={19} color={palette.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: palette.text }]}>
            {t("venueBranchesTitle")}
          </Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            {t("venueBranchesSubtitle")}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : error || branchError ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: palette.text }]}>
            {error ?? branchError}
          </Text>
          <Pressable
            accessibilityRole="button"
            testID="venue-branches-retry"
            onPress={refetch}
            style={[
              styles.retryButton,
              { borderColor: palette.border, borderRadius: palette.radius },
            ]}
          >
            <Text style={{ color: palette.accent, fontWeight: "700" }}>
              {t("common.retry")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: bottomInset + 28 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.sectionTitle, { color: palette.muted }]}>
            {t("venueBranchesYourVenues")}
          </Text>
          {branches.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                  borderRadius: palette.radius,
                },
              ]}
            >
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                {t("venueBranchesEmpty")}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {branches.map((branch) => {
                const selected = branch.businessId === activeBusinessId;
                return (
                  <Pressable
                    key={`${branch.businessId}:${branch.profile.id}`}
                    accessibilityRole="button"
                    testID={`venue-branch-${branch.businessId}`}
                    accessibilityState={{ selected }}
                    onPress={async () => {
                      await selectBranch(branch.businessId);
                      router.replace("/venue-owner/dashboard" as never);
                    }}
                    style={({ pressed }) => [
                      styles.branchCard,
                      {
                        backgroundColor: selected ? palette.selected : palette.card,
                        borderColor: selected ? palette.accent : palette.border,
                        borderRadius: palette.radius + 4,
                        opacity: pressed ? 0.78 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.venueMark, { backgroundColor: palette.selected }]}>
                      <Feather name="map-pin" size={18} color={palette.accent} />
                    </View>
                    <View style={styles.branchCopy}>
                      <Text
                        style={[styles.branchName, { color: palette.text }]}
                        numberOfLines={1}
                      >
                        {branch.profile.businessName}
                      </Text>
                      <Text
                        style={[styles.branchPlace, { color: palette.muted }]}
                        numberOfLines={1}
                      >
                        {branch.profile.placeName}
                      </Text>
                    </View>
                    <View style={styles.branchTrailing}>
                      <Text style={[styles.approved, { color: palette.accent }]}>
                        {t("venueBranchesApproved")}
                      </Text>
                      {selected ? (
                        <Feather name="check-circle" size={19} color={palette.accent} />
                      ) : (
                        <Feather name="chevron-right" size={19} color={palette.muted} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.muted }]}>
              {t("venueBranchesApplications")}
            </Text>
            {branchApplications.length > 0 && (
              <View style={[styles.countPill, { backgroundColor: palette.selected }]}>
                <Text style={[styles.countText, { color: palette.accent }]}>
                  {branchApplications.length}
                </Text>
              </View>
            )}
          </View>
          {branchApplications.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                  borderRadius: palette.radius,
                },
              ]}
            >
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                {t("venueBranchesNoApplications")}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {branchApplications.map((application) => {
                const statusColor =
                  application.applicationStatus === "rejected" ||
                  application.applicationStatus === "changes_requested"
                    ? palette.warning
                    : palette.accent;
                return (
                  <View
                    key={application.id}
                    style={[
                      styles.applicationCard,
                      {
                        backgroundColor: palette.card,
                        borderColor: palette.border,
                        borderRadius: palette.radius,
                      },
                    ]}
                  >
                    <View style={styles.applicationTop}>
                      <View style={styles.branchCopy}>
                        <Text
                          style={[styles.branchName, { color: palette.text }]}
                          numberOfLines={1}
                        >
                          {application.businessName}
                        </Text>
                        <Text
                          style={[styles.branchPlace, { color: palette.muted }]}
                          numberOfLines={1}
                        >
                          {application.placeName}
                        </Text>
                      </View>
                      <Text style={[styles.status, { color: statusColor }]}>
                        {t(STATUS_TRANSLATIONS[application.applicationStatus])}
                      </Text>
                    </View>
                    {application.rejectionReason ? (
                      <Text style={[styles.reason, { color: palette.muted }]}>
                        {application.rejectionReason}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            testID="venue-branch-apply"
            onPress={openApplication}
            style={({ pressed }) => [
              styles.addButton,
              {
                backgroundColor: palette.accent,
                borderRadius: palette.radius + 3,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather name="plus" size={18} color={palette.buttonText} />
            <Text
              style={[styles.addButtonText, { color: palette.buttonText }]}
            >
              {t("venueBranchesAdd")}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, paddingTop: 2 },
  title: { fontSize: 25, fontFamily: "Inter_700Bold", letterSpacing: -0.6 },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    fontFamily: "Inter_400Regular",
  },
  content: { paddingHorizontal: 18, gap: 10 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.7,
    textTransform: "uppercase",
  },
  list: { gap: 9 },
  branchCard: {
    minHeight: 86,
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  venueMark: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  branchCopy: { flex: 1, minWidth: 0 },
  branchName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  branchPlace: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: "Inter_400Regular",
  },
  branchTrailing: { alignItems: "flex-end", gap: 8 },
  approved: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  countPill: {
    minWidth: 23,
    height: 23,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  emptyCard: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 16,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  applicationCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
  applicationTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  status: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "right",
    maxWidth: 120,
  },
  reason: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    fontFamily: "Inter_400Regular",
  },
  addButton: {
    minHeight: 52,
    borderRadius: 15,
    marginTop: 15,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  addButtonText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  centered: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  errorText: { textAlign: "center", fontSize: 14, lineHeight: 20 },
  retryButton: { paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1, borderRadius: 10 },
});