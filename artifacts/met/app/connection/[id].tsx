import { Feather } from "@expo/vector-icons";
import { Image } from "@/components/MetImage";
import { LinearGradient } from "@/components/MetGradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
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
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { SocialChip } from "@/components/SocialChip";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { type ReportReason, submitReport } from "@/lib/reports";
import type { SocialPlatform } from "@/lib/types";
import {
  type ChatMessage,
  subscribeToMessages,
  sendMessage,
  markChatRead,
} from "@/lib/firestore/chat";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function ConnectionScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const {
    allEncounters,
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

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

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

  // Subscribe to real-time chat messages; mark as read on open
  useEffect(() => {
    if (!profile?.id || !encounter?.id) return;
    const myUid = profile.id;
    const peerUid = encounter.id;
    let unsub: (() => void) | null = null;

    subscribeToMessages(myUid, peerUid, (msgs) => {
      setMessages(msgs);
    }).then((fn) => {
      unsub = fn;
    });

    markChatRead(myUid, peerUid).catch(() => {});

    return () => {
      unsub?.();
    };
  }, [profile?.id, encounter?.id]);

  // Auto-scroll to newest message whenever the list grows
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

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

  const openMap = () => {
    if (!encounter.lastLocation) return;
    const q = encodeURIComponent(encounter.lastLocation);
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${q}`,
    ).catch(() => {});
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSend = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatSending || !profile?.id) return;
    setChatInput("");
    setChatSending(true);
    try {
      await sendMessage(profile.id, encounter.id, text);
    } catch {
      setChatInput(text); // restore on failure so user doesn't lose their message
    } finally {
      setChatSending(false);
    }
  }, [chatInput, chatSending, profile?.id, encounter?.id]);

  const socialEntries = (
    Object.entries(encounter.socials) as [SocialPlatform, string][]
  ).filter(([, v]) => v && v.trim());

  const metTimesText = t(
    encounter.encounterCount === 1
      ? "connection.metTimes_one"
      : "connection.metTimes_other",
    { count: encounter.encounterCount },
  );

  const myUid = profile?.id ?? "";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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

        {/* Scrollable content: profile info + conversation */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            paddingBottom: insets.bottom + webBot + 90,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile / info — always front and center */}
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

            {encounter.interests && encounter.interests.length > 0 ? (
              <View style={styles.interestsBlock}>
                <View style={styles.chipsRow}>
                  {encounter.interests.map((tag) => (
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

          {/* Conversation / chat */}
          <View style={[styles.chatSection, { borderTopColor: colors.border }]}>
            <Text
              style={[
                styles.sectionLabel,
                {
                  color: colors.mutedForeground,
                  paddingHorizontal: 20,
                  paddingTop: 18,
                  paddingBottom: 4,
                },
              ]}
            >
              {t("connection.conversation")}
            </Text>

            {messages.length === 0 ? (
              <View style={styles.chatEmpty}>
                <Feather
                  name="message-circle"
                  size={32}
                  color={colors.mutedForeground}
                  style={{ opacity: 0.45 }}
                />
                <Text style={[styles.chatEmptyTitle, { color: colors.foreground }]}>
                  {t("connection.chatEmptyTitle")}
                </Text>
                <Text style={[styles.chatEmptySub, { color: colors.mutedForeground }]}>
                  {t("connection.chatEmptySub")}
                </Text>
              </View>
            ) : (
              <View style={styles.chatMessages}>
                {messages.map((msg) => {
                  const isMe = msg.from === myUid;
                  return (
                    <View
                      key={msg.id}
                      style={[
                        styles.bubbleRow,
                        isMe ? styles.bubbleRowMe : styles.bubbleRowThem,
                      ]}
                    >
                      {!isMe ? <Avatar uri={encounter.photoUri} size={28} /> : null}
                      <View style={[styles.bubbleGroup, isMe && { alignItems: "flex-end" }]}>
                        <View
                          style={[
                            styles.bubble,
                            isMe
                              ? [styles.bubbleMe, { backgroundColor: colors.primary }]
                              : [
                                  styles.bubbleThem,
                                  {
                                    backgroundColor: colors.muted,
                                    borderColor: colors.border,
                                  },
                                ],
                          ]}
                        >
                          <Text
                            style={[
                              styles.bubbleText,
                              { color: isMe ? "#FFFFFF" : colors.foreground },
                            ]}
                          >
                            {msg.text}
                          </Text>
                        </View>
                        <Text
                          style={[styles.bubbleTime, { color: colors.mutedForeground }]}
                        >
                          {formatTime(msg.sentAt)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Chat input — pinned above the keyboard */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + webBot + 8,
            },
          ]}
        >
          <TextInput
            value={chatInput}
            onChangeText={setChatInput}
            placeholder={t("connection.chatPlaceholder", { name: encounter.realName })}
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.inputField,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            blurOnSubmit={false}
            maxLength={1000}
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={chatSending || !chatInput.trim()}
            accessibilityLabel={t("connection.chatSendA11y")}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: colors.primary,
                opacity:
                  pressed || chatSending || !chatInput.trim() ? 0.45 : 1,
              },
            ]}
          >
            <Feather name="send" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

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
    </KeyboardAvoidingView>
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
  interestsBlock: { gap: 6 },
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

  // Chat section
  chatSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
  },
  chatEmpty: {
    alignItems: "center",
    paddingVertical: 36,
    gap: 8,
    paddingHorizontal: 32,
  },
  chatEmptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    textAlign: "center",
  },
  chatEmptySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  chatMessages: {
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 4,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 2,
  },
  bubbleRowMe: { justifyContent: "flex-end" },
  bubbleRowThem: { justifyContent: "flex-start" },
  bubbleGroup: { maxWidth: "72%", gap: 3 },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleThem: {
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    opacity: 0.55,
    paddingHorizontal: 2,
  },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputField: {
    flex: 1,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

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
