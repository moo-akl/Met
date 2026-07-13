import { Feather } from "@expo/vector-icons";
import { Image } from "@/components/MetImage";

import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { ReputationRadar } from "@/components/ReputationRadar";
import { Avatar } from "@/components/Avatar";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { SocialChip } from "@/components/SocialChip";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { type ReportReason, submitReport } from "@/lib/reports";
import type { SocialPlatform } from "@/lib/types";

export default function ConnectionScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const {
    allEncounters,
    authedUid,
    removeEncounter,
    setBlocked,
    setNote,
    setTags,
    profile,
  } = useApp();

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [reportConfirmation, setReportConfirmation] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [liveInterests, setLiveInterests] = useState<string[] | undefined>(undefined);
  const [mutualCount, setMutualCount] = useState(0);
  const [mutualNames, setMutualNames] = useState<string[]>([]);
  const [reviewSummary, setReviewSummary] = useState<{
    count: number;
    hasEnough: boolean;
    averageCourtesy?: number;
    averageCommunication?: number;
    averageReliability?: number;
    communityStanding?: number;
  } | null>(null);

  const encounter = useMemo(
    () => allEncounters.find((e) => e.id === id),
    [allEncounters, id],
  );

  // If we land here with a non-connected encounter (race conditions, deep
  // links, etc.) bounce to the encounter screen so the right CTAs show.
  useEffect(() => {
    if (!encounter) return;
    if (encounter.status !== "connected") {
      router.replace(`/encounter/${encounter.id}`);
    }
  }, [encounter, router]);

  // Fetch the peer's live profile so interests are always up-to-date,
  // even if the cached encounter pre-dates the peer adding interests.
  useEffect(() => {
    if (!encounter || !profile?.id) return;
    const ctrl = new AbortController();
    api
      .getProfile({ uid: profile.id, signal: ctrl.signal }, encounter.id)
      .then((p) => {
        if (p.interests && p.interests.length > 0) {
          setLiveInterests(p.interests);
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [encounter?.id, profile?.id]);

  // Fetch mutual connections — people both the viewer and this user know.
  useEffect(() => {
    if (!encounter || !authedUid) return;
    const ctrl = new AbortController();
    api
      .getMutualConnections({ uid: authedUid, signal: ctrl.signal }, encounter.id)
      .then((r) => {
        setMutualCount(r.count);
        setMutualNames(r.names);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [encounter?.id, authedUid]);

  // Fetch this connection's review summary (community standing).
  useEffect(() => {
    if (!encounter || !authedUid) return;
    const ctrl = new AbortController();
    api
      .getReviewSummary({ uid: authedUid, signal: ctrl.signal }, encounter.id)
      .then(setReviewSummary)
      .catch(() => {});
    return () => ctrl.abort();
  }, [encounter?.id, authedUid]);

  if (!encounter) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top + 24 },
        ]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: colors.foreground, padding: 24 }}>
          {t("connection.gone")}
        </Text>
      </View>
    );
  }

  const handleRemove = async () => {
    await removeEncounter(encounter.id);
    router.back();
  };

  const handleBlock = async () => {
    await setBlocked(encounter.id, true);
    router.back();
  };

  const handleReport = async (reason: ReportReason) => {
    setReportSheetOpen(false);
    await submitReport({
      encounterId: encounter.id,
      reason,
      revealMessage: encounter.revealMessage,
      reporterUid: profile?.id ?? null,
      reportedUid: null,
    });
    await setBlocked(encounter.id, true);
    setReportConfirmation(true);
    setTimeout(() => {
      router.back();
    }, 1500);
  };

  const socialEntries = (
    Object.entries(encounter.socials) as [SocialPlatform, string][]
  ).filter(([, v]) => v && v.trim());

  const metTimesText = t(
    encounter.encounterCount === 1
      ? "connection.metTimes_one"
      : "connection.metTimes_other",
    { count: encounter.encounterCount },
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header bar */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 10,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityLabel={t("common.back")}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Avatar uri={encounter.photoUri} size={36} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[styles.headerName, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {encounter.realName}
            </Text>
            <Text
              style={[styles.headerSub, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {metTimesText}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push(`/chat/${encounter.id}`)}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityLabel={t("chat.messageBtn")}
        >
          <Feather name="message-circle" size={22} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={12}
          style={styles.headerBtn}
        >
          <Feather name="more-vertical" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Scrollable content: profile info */}
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 24,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile / info */}
        <View
          style={[
            styles.detailsPanel,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.detailsHeroRow}>
            {encounter.photoUri ? (
              <Pressable
                onPress={() => setLightboxOpen(true)}
                accessibilityLabel="View full-screen photo"
                accessibilityRole="button"
              >
                <Image
                  source={{ uri: encounter.photoUri }}
                  style={styles.detailsAvatar}
                  contentFit="cover"
                />
              </Pressable>
            ) : (
              <View
                style={[
                  styles.detailsAvatar,
                  styles.detailsAvatarPlaceholder,
                  { backgroundColor: colors.muted },
                ]}
              >
                <Text
                  style={[
                    styles.detailsAvatarInitial,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {encounter.realName?.trim().charAt(0).toUpperCase() || "?"}
                </Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.detailsName, { color: colors.foreground }]}>
                {encounter.realName}
              </Text>
              <View style={styles.detailsMetaRow}>
                <Feather name="repeat" size={14} color={colors.primary} />
                <Text style={[styles.detailsMeta, { color: colors.primary }]}>
                  {metTimesText}
                </Text>
              </View>
            </View>
          </View>

          {encounter.bio ? (
            <Text style={[styles.bio, { color: colors.foreground }]}>
              {encounter.bio}
            </Text>
          ) : null}

          {(liveInterests ?? encounter.interests)?.length ? (
            <View style={styles.interestsBlock}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                {t("connection.interestsLabel")}
              </Text>
              <View style={styles.chipsRow}>
                {(liveInterests ?? encounter.interests)!.map((tag) => (
                  <View
                    key={tag}
                    style={[
                      styles.interestChip,
                      { backgroundColor: colors.muted, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.interestChipText, { color: colors.foreground }]}>
                      {t(`interestLabels.${tag.toLowerCase()}`)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {mutualCount > 0 ? (
            <View style={styles.mutualBlock}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                People you both know
              </Text>
              <View
                style={[
                  styles.mutualRow,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                ]}
              >
                <Text style={styles.mutualEmoji}>🤝</Text>
                <Text style={[styles.mutualText, { color: colors.foreground }]}>
                  {mutualCount === 1 && mutualNames.length >= 1
                    ? `${mutualNames[0]} in common`
                    : mutualNames.length >= 2
                      ? `${mutualNames.slice(0, 2).join(", ")}${mutualCount > 2 ? ` +${mutualCount - 2} more` : ""}`
                      : `${mutualCount} ${mutualCount === 1 ? "person" : "people"} in common`}
                </Text>
              </View>
            </View>
          ) : null}

          {encounter.lastLocation ? (
            <View style={styles.metAtRow}>
              <Feather name="map-pin" size={15} color={colors.primary} />
              <Text
                style={[styles.metAtText, { color: colors.mutedForeground }]}
                numberOfLines={2}
              >
                {encounter.lastLocation}
              </Text>
            </View>
          ) : null}

          {socialEntries.length > 0 ? (
            <View style={styles.socialsBlock}>
              <Text
                style={[styles.sectionLabel, { color: colors.mutedForeground }]}
              >
                {t("connection.socialsLabel")}
              </Text>
              <View style={styles.chipsRow}>
                {socialEntries.map(([platform, handle]) => (
                  <SocialChip
                    key={platform}
                    platform={platform}
                    handle={handle}
                  />
                ))}
              </View>
              <View style={[styles.socialHint, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="send" size={14} color={colors.mutedForeground} />
                <Text style={[styles.socialHintText, { color: colors.mutedForeground }]}>
                  {t("connection.socialHint")}
                </Text>
              </View>
            </View>
          ) : null}

          <NoteEditor
            colors={colors}
            value={encounter.note ?? ""}
            onSave={(next) => setNote(encounter.id, next)}
          />

          <TagsEditor
            colors={colors}
            tags={encounter.tags ?? []}
            onChange={(next) => setTags(encounter.id, next)}
          />
        </View>

        <ReputationRadar summary={reviewSummary} />
      </ScrollView>

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={encounter.realName}
        actions={[
          {
            label: t("encounter.reportAction"),
            icon: "flag",
            destructive: true,
            onPress: () => {
              setMenuOpen(false);
              setTimeout(() => setReportSheetOpen(true), 250);
            },
          },
          {
            label: t("connection.blockAction"),
            icon: "slash",
            destructive: true,
            onPress: handleBlock,
          },
          {
            label: t("connection.removeConnectionAction"),
            icon: "trash-2",
            destructive: true,
            onPress: handleRemove,
          },
        ]}
      />

      <ActionSheet
        visible={reportSheetOpen}
        onClose={() => setReportSheetOpen(false)}
        title={t("encounter.reportSheet.title")}
        message={t("encounter.reportSheet.subtitle")}
        actions={[
          {
            label: t("encounter.reportSheet.reasonInappropriate"),
            icon: "alert-octagon",
            onPress: () => handleReport("inappropriate"),
          },
          {
            label: t("encounter.reportSheet.reasonHarassment"),
            icon: "user-x",
            onPress: () => handleReport("harassment"),
          },
          {
            label: t("encounter.reportSheet.reasonSpam"),
            icon: "shield-off",
            onPress: () => handleReport("spam"),
          },
          {
            label: t("encounter.reportSheet.reasonUnderage"),
            icon: "alert-triangle",
            onPress: () => handleReport("underage"),
          },
          {
            label: t("encounter.reportSheet.reasonOther"),
            icon: "more-horizontal",
            onPress: () => handleReport("other"),
          },
        ]}
      />

      {reportConfirmation ? (
        <View style={styles.reportToastWrap} pointerEvents="none">
          <View
            style={[styles.reportToast, { backgroundColor: colors.foreground }]}
          >
            <Feather name="check-circle" size={18} color={colors.card} />
            <Text style={[styles.reportToastText, { color: colors.card }]}>
              {t("encounter.reported")}
            </Text>
          </View>
        </View>
      ) : null}

      {encounter.photoUri ? (
        <PhotoLightbox
          uri={encounter.photoUri}
          visible={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TAG_SUGGESTIONS = ["coffee", "work", "gym", "friends", "event", "neighbor"];

function NoteEditor({
  colors,
  value,
  onSave,
}: {
  colors: ReturnType<typeof useColors>;
  value: string;
  onSave: (next: string) => void;
}) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value.trim()) onSave(draft);
  };

  return (
    <View style={styles.editorBlock}>
      <View style={styles.editorHeader}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {t("connection.privateNote")}
        </Text>
        {!editing ? (
          <Pressable
            onPress={() => setEditing(true)}
            hitSlop={8}
            accessibilityLabel={
              value ? t("connection.editNoteA11y") : t("connection.addNoteA11y")
            }
          >
            <Feather
              name={value ? "edit-2" : "plus"}
              size={14}
              color={colors.primary}
            />
          </Pressable>
        ) : null}
      </View>
      {editing ? (
        <>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t("connection.notePlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={280}
            autoFocus
            style={[
              styles.noteInput,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
          />
          <View style={styles.editorActions}>
            <Pressable
              onPress={() => {
                setEditing(false);
                setDraft(value);
              }}
              style={({ pressed }) => [
                styles.editorBtn,
                { backgroundColor: colors.muted, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.editorBtnText, { color: colors.foreground }]}>
                {t("common.cancel")}
              </Text>
            </Pressable>
            <Pressable
              onPress={commit}
              style={({ pressed }) => [
                styles.editorBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.editorBtnText, { color: "#FFFFFF" }]}>
                {t("common.save")}
              </Text>
            </Pressable>
          </View>
        </>
      ) : value ? (
        <Text style={[styles.noteText, { color: colors.foreground }]}>{value}</Text>
      ) : (
        <Pressable onPress={() => setEditing(true)}>
          <Text style={[styles.notePlaceholder, { color: colors.mutedForeground }]}>
            {t("connection.addNoteEmpty")}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function TagsEditor({
  colors,
  tags,
  onChange,
}: {
  colors: ReturnType<typeof useColors>;
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState("");

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (!tag) return;
    if (tags.includes(tag)) { setDraft(""); return; }
    onChange([...tags, tag]);
    setDraft("");
  };

  const removeTag = (tag: string) => onChange(tags.filter((x) => x !== tag));

  const suggestions = TAG_SUGGESTIONS.filter((s) => !tags.includes(s));

  return (
    <View style={styles.editorBlock}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t("connection.tagsLabel")}
      </Text>
      {tags.length > 0 ? (
        <View style={styles.chipsRow}>
          {tags.map((tag) => (
            <Pressable
              key={tag}
              onPress={() => removeTag(tag)}
              accessibilityLabel={t("connection.removeTagA11y", { tag })}
              style={({ pressed }) => [
                styles.tagChip,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={styles.tagChipText}>#{tag}</Text>
              <Feather name="x" size={12} color="#FFFFFF" />
            </Pressable>
          ))}
        </View>
      ) : null}
      <View
        style={[
          styles.tagInputRow,
          { backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      >
        <Feather name="hash" size={14} color={colors.mutedForeground} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t("connection.addTagPlaceholder")}
          placeholderTextColor={colors.mutedForeground}
          autoCorrect={false}
          autoCapitalize="none"
          maxLength={24}
          onSubmitEditing={() => addTag(draft)}
          returnKeyType="done"
          style={[styles.tagInput, { color: colors.foreground }]}
        />
        {draft.trim().length > 0 ? (
          <Pressable onPress={() => addTag(draft)} hitSlop={8}>
            <Feather name="check" size={16} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      {suggestions.length > 0 ? (
        <View style={styles.chipsRow}>
          {suggestions.map((s) => (
            <Pressable
              key={s}
              onPress={() => addTag(s)}
              style={({ pressed }) => [
                styles.suggestChip,
                { borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.suggestChipText, { color: colors.mutedForeground }]}>
                #{s}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  headerName: { fontFamily: "Inter_700Bold", fontSize: 16 },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },

  // Profile details
  detailsPanel: {
    paddingHorizontal: 22,
    paddingVertical: 18,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailsHeroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  detailsAvatar: { width: 64, height: 64, borderRadius: 32 },
  detailsAvatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  detailsAvatarInitial: { fontFamily: "Inter_700Bold", fontSize: 26 },
  detailsName: { fontFamily: "Inter_700Bold", fontSize: 22 },
  detailsMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailsMeta: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  bio: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
  metAtRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metAtText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  interestsBlock: { gap: 8 },
  socialHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  socialHintText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    fontStyle: "italic",
  },
  interestChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  interestChipText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  socialsBlock: { gap: 8 },

  // Shared section label
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  mutualBlock: { marginTop: 16, gap: 6 },
  mutualRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  mutualEmoji: { fontSize: 18 },
  mutualText: { fontFamily: "Inter_400Regular", fontSize: 14, flex: 1 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  // Note + tag editors
  editorBlock: { gap: 8, marginTop: 4 },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  noteText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
  notePlaceholder: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    fontStyle: "italic",
  },
  noteInput: {
    minHeight: 70,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: "top",
  },
  editorActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  editorBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  editorBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tagChipText: { color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  tagInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
  },
  tagInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    paddingVertical: 0,
  },
  suggestChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  suggestChipText: { fontFamily: "Inter_500Medium", fontSize: 12 },

  // Report toast
  reportToastWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 110,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  reportToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    maxWidth: 380,
  },
  reportToastText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    flexShrink: 1,
  },
});
