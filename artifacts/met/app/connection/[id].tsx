import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Linking,
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
import { Avatar } from "@/components/Avatar";
import { SocialChip } from "@/components/SocialChip";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import type { OpeningMessage, SocialPlatform } from "@/lib/types";

function formatTime(ts: number, lang: string) {
  return new Date(ts).toLocaleTimeString(lang, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateLabel(ts: number, lang: string, t: (k: string) => string) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return t("common.today");
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return t("common.yesterday");
  return d.toLocaleDateString(lang, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ConnectionScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang } = useT();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const {
    allEncounters,
    removeEncounter,
    setBlocked,
    setNote,
    setTags,
  } = useApp();

  const [menuOpen, setMenuOpen] = useState(false);

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

  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBot = Platform.OS === "web" ? 34 : 0;

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

  const openMap = () => {
    if (!encounter.lastLocation) return;
    const q = encodeURIComponent(encounter.lastLocation);
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${q}`,
    ).catch(() => {});
  };

  const socialEntries = (
    Object.entries(encounter.socials) as [SocialPlatform, string][]
  ).filter(([, v]) => v && v.trim());

  const om = encounter.openingMessage;
  const lastActivity =
    om?.reply?.receivedAt ?? om?.sentAt ?? encounter.lastSeenAt;

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
            paddingTop: insets.top + webTop + 10,
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
          onPress={() => setMenuOpen(true)}
          hitSlop={12}
          style={styles.headerBtn}
        >
          <Feather name="more-vertical" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + webBot + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile / info — always front and center. The chat below is a
            secondary "introduce yourself / remind them where we met" surface. */}
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
            <Image
              source={{ uri: encounter.photoUri }}
              style={styles.detailsAvatar}
              contentFit="cover"
            />
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
          {encounter.lastLocation ? (
            <Pressable
              onPress={openMap}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <LinearGradient
                colors={[colors.primary, "#2BA535"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.mapCard}
              >
                <Feather name="map-pin" size={18} color="#FFFFFF" />
                <Text style={styles.mapText} numberOfLines={1}>
                  {encounter.lastLocation}
                </Text>
                <Feather name="external-link" size={16} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          ) : null}
          {socialEntries.length > 0 ? (
            <View style={styles.socialsBlock}>
              <Text
                style={[
                  styles.sectionLabel,
                  { color: colors.mutedForeground },
                ]}
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

        {/* Conversation — secondary section. Composer was removed; we still
            render any existing thread so prior exchanges remain visible. */}
        <View style={styles.thread}>
          <View style={styles.threadHeader}>
            <Text
              style={[styles.sectionLabel, { color: colors.mutedForeground }]}
            >
              {t("connection.conversation")}
            </Text>
            <View
              style={[styles.threadDivider, { backgroundColor: colors.border }]}
            />
          </View>
          <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
            {formatDateLabel(lastActivity, lang, t)}
          </Text>

          {!om ? (
            <View
              style={[
                styles.startCard,
                { backgroundColor: colors.muted, borderColor: colors.border },
              ]}
            >
              <Feather name="message-circle" size={24} color={colors.primary} />
              <Text style={[styles.startTitle, { color: colors.foreground }]}>
                {t("connection.connectedWith", { name: encounter.realName })}
              </Text>
              <Text
                style={[styles.startSub, { color: colors.mutedForeground }]}
              >
                {t("connection.breakIce")}
              </Text>
            </View>
          ) : (
            <ChatBubbles
              colors={colors}
              encounterName={encounter.realName}
              message={om}
              lang={lang}
            />
          )}
        </View>
      </ScrollView>

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={encounter.realName}
        actions={[
          {
            label: t("connection.removeConnectionAction"),
            icon: "trash-2",
            destructive: true,
            onPress: handleRemove,
          },
          {
            label: t("connection.blockAction"),
            icon: "slash",
            destructive: true,
            onPress: handleBlock,
          },
        ]}
      />
    </View>
  );
}

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

  // Re-sync if the underlying note changes (e.g. from another surface).
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
        <Text
          style={[styles.sectionLabel, { color: colors.mutedForeground }]}
        >
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
        <Text style={[styles.noteText, { color: colors.foreground }]}>
          {value}
        </Text>
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
    if (tags.includes(tag)) {
      setDraft("");
      return;
    }
    onChange([...tags, tag]);
    setDraft("");
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((x) => x !== tag));
  };

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
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
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
          <Pressable
            onPress={() => addTag(draft)}
            hitSlop={8}
            accessibilityLabel={t("common.save")}
          >
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
                {
                  borderColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[styles.suggestChipText, { color: colors.mutedForeground }]}
              >
                #{s}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ChatBubbles({
  colors,
  encounterName,
  message,
  lang,
}: {
  colors: ReturnType<typeof useColors>;
  encounterName: string;
  message: OpeningMessage;
  lang: string;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.bubbleRowRight}>
        <View style={[styles.bubble, styles.bubbleMe, { backgroundColor: colors.primary }]}>
          <Text style={[styles.bubbleText, { color: "#FFFFFF" }]}>
            {message.text}
          </Text>
          <Text style={[styles.bubbleTime, { color: "rgba(255,255,255,0.75)" }]}>
            {formatTime(message.sentAt, lang)}
          </Text>
        </View>
      </View>
      {message.reply ? (
        <View style={styles.bubbleRowLeft}>
          <Avatar uri={undefined} size={26} fallbackText={encounterName} />
          <View style={[styles.bubble, styles.bubbleThem, { backgroundColor: colors.muted }]}>
            <Text style={[styles.bubbleText, { color: colors.foreground }]}>
              {message.reply.text}
            </Text>
            <Text style={[styles.bubbleTime, { color: colors.mutedForeground }]}>
              {formatTime(message.reply.receivedAt, lang)}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  detailsPanel: {
    paddingHorizontal: 22,
    paddingVertical: 18,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailsHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  detailsAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  detailsName: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  detailsMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailsMeta: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  bio: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  mapCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  mapText: {
    flex: 1,
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  socialsBlock: { gap: 8 },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  thread: {
    paddingHorizontal: 22,
    paddingTop: 16,
    gap: 12,
  },
  threadHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  threadDivider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dateLabel: {
    alignSelf: "center",
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  startCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: "center",
    gap: 6,
  },
  startTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    marginTop: 4,
    textAlign: "center",
  },
  startSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  bubbleRowRight: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  bubbleRowLeft: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    gap: 8,
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 4,
  },
  bubbleMe: {
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    alignSelf: "flex-end",
  },
  editorBlock: {
    gap: 8,
    marginTop: 4,
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  noteText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
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
  editorActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  editorBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  editorBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tagChipText: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
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
  suggestChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
});
