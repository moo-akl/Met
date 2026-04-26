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
import { useSubscription } from "@/lib/revenuecat";
import type { OpeningMessage, SocialPlatform } from "@/lib/types";
import {
  PLUS_OPENING_MESSAGES_PER_DAY,
  PRO_OPENING_MESSAGES_PER_DAY,
  getOpeningMessagesRemaining,
  tryConsumeOpeningMessage,
} from "@/lib/usage";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return "Today";
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ConnectionScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const {
    allEncounters,
    removeEncounter,
    setBlocked,
    sendOpeningMessage,
  } = useApp();
  const { tier, isPlusSubscriber, isProSubscriber, isSubscriptionReady } =
    useSubscription();

  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [openingsRemaining, setOpeningsRemaining] = useState<number | null>(
    null,
  );

  const openingPerDay = isProSubscriber
    ? PRO_OPENING_MESSAGES_PER_DAY
    : PLUS_OPENING_MESSAGES_PER_DAY;

  useEffect(() => {
    let cancelled = false;
    getOpeningMessagesRemaining(openingPerDay).then((o) => {
      if (cancelled) return;
      setOpeningsRemaining(o);
    });
    return () => {
      cancelled = true;
    };
  }, [openingPerDay]);

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
          This conversation is gone.
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

  const hasPendingMessage =
    !!encounter.openingMessage && !encounter.openingMessage.reply;

  const handleSendMessage = async () => {
    if (sendingMsg || !isSubscriptionReady) return;
    if (!isPlusSubscriber) {
      router.push("/paywall");
      return;
    }
    const text = draft.trim();
    if (!text) return;
    setSendingMsg(true);
    try {
      const consumed = await tryConsumeOpeningMessage(openingPerDay);
      if (consumed === null) {
        setOpeningsRemaining(0);
        return;
      }
      await sendOpeningMessage(encounter.id, text);
      setDraft("");
      setOpeningsRemaining(await getOpeningMessagesRemaining(openingPerDay));
    } finally {
      setSendingMsg(false);
    }
  };

  const socialEntries = (
    Object.entries(encounter.socials) as [SocialPlatform, string][]
  ).filter(([, v]) => v && v.trim());

  const om = encounter.openingMessage;
  const lastActivity =
    om?.reply?.receivedAt ?? om?.sentAt ?? encounter.lastSeenAt;

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
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
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
              Met {encounter.encounterCount}{" "}
              {encounter.encounterCount === 1 ? "time" : "times"}
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
          paddingBottom: insets.bottom + webBot + 140,
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
                  Met {encounter.encounterCount}{" "}
                  {encounter.encounterCount === 1 ? "time" : "times"}
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
                Socials
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
        </View>

        {/* Conversation — secondary section. */}
        <View style={styles.thread}>
          <View style={styles.threadHeader}>
            <Text
              style={[styles.sectionLabel, { color: colors.mutedForeground }]}
            >
              Conversation
            </Text>
            <View
              style={[styles.threadDivider, { backgroundColor: colors.border }]}
            />
          </View>
          <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
            {formatDateLabel(lastActivity)}
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
                You&rsquo;re connected with {encounter.realName}
              </Text>
              <Text
                style={[styles.startSub, { color: colors.mutedForeground }]}
              >
                Break the ice — your first message kicks off the conversation.
              </Text>
            </View>
          ) : (
            <ChatBubbles
              colors={colors}
              encounterName={encounter.realName}
              message={om}
            />
          )}
        </View>
      </ScrollView>

      {/* Composer / paywall / quota states */}
      <View
        style={[
          styles.composerWrap,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + webBot + 10,
          },
        ]}
      >
        {!isPlusSubscriber ? (
          <Pressable
            onPress={() => router.push("/paywall")}
            style={({ pressed }) => [
              styles.upgradeMsgCard,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="lock" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.upgradeMsgTitle, { color: colors.foreground }]}
              >
                Send opening messages
              </Text>
              <Text
                style={[
                  styles.upgradeMsgSub,
                  { color: colors.mutedForeground },
                ]}
              >
                Unlock with Met Plus or Pro
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
        ) : openingsRemaining !== null &&
          openingsRemaining <= 0 &&
          !hasPendingMessage ? (
          <View
            style={[
              styles.composerHelp,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="clock" size={16} color={colors.mutedForeground} />
            <Text
              style={[
                styles.composerHelpText,
                { color: colors.mutedForeground },
              ]}
            >
              You&rsquo;ve used your {openingPerDay} opening{" "}
              {openingPerDay === 1 ? "message" : "messages"} for today.
              {isProSubscriber
                ? " Resets at midnight."
                : " Upgrade to Met Pro for more."}
            </Text>
          </View>
        ) : hasPendingMessage ? (
          <View
            style={[
              styles.composerHelp,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="clock" size={16} color={colors.mutedForeground} />
            <Text
              style={[
                styles.composerHelpText,
                { color: colors.mutedForeground },
              ]}
            >
              Wait for {encounter.realName} to reply before sending another
              message.
            </Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.composer,
                { backgroundColor: colors.muted, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={
                  om?.reply
                    ? "Send another message…"
                    : `Say hi to ${encounter.realName}…`
                }
                placeholderTextColor={colors.mutedForeground}
                style={[styles.composerInput, { color: colors.foreground }]}
                multiline
                maxLength={240}
                editable={!sendingMsg}
              />
              <Pressable
                onPress={handleSendMessage}
                disabled={!draft.trim() || sendingMsg}
                style={({ pressed }) => [
                  styles.composerSend,
                  {
                    backgroundColor: colors.primary,
                    opacity:
                      !draft.trim() || sendingMsg
                        ? 0.5
                        : pressed
                          ? 0.85
                          : 1,
                  },
                ]}
              >
                <Feather name="send" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
            {openingsRemaining !== null ? (
              <Text
                style={[
                  styles.composerCounter,
                  { color: colors.mutedForeground },
                ]}
              >
                {openingsRemaining} of {openingPerDay} opening{" "}
                {openingPerDay === 1 ? "message" : "messages"} left today
                {tier === "plus" ? " · Pro gets 2/day" : ""}
              </Text>
            ) : null}
          </>
        )}
      </View>

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={encounter.realName}
        actions={[
          {
            label: "Remove connection",
            icon: "trash-2",
            destructive: true,
            onPress: handleRemove,
          },
          {
            label: "Block",
            icon: "slash",
            destructive: true,
            onPress: handleBlock,
          },
        ]}
      />
    </View>
  );
}

function ChatBubbles({
  colors,
  encounterName,
  message,
}: {
  colors: ReturnType<typeof useColors>;
  encounterName: string;
  message: OpeningMessage;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.bubbleSelfRow}>
        <View
          style={[
            styles.bubble,
            styles.bubbleSelf,
            { backgroundColor: colors.primary },
          ]}
        >
          <Text style={styles.bubbleSelfText}>{message.text}</Text>
        </View>
        <Text style={[styles.bubbleMeta, { color: colors.mutedForeground }]}>
          You · {formatTime(message.sentAt)}
        </Text>
      </View>
      {message.reply ? (
        <View style={styles.bubbleOtherRow}>
          <View
            style={[
              styles.bubble,
              styles.bubbleOther,
              { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.bubbleOtherText, { color: colors.foreground }]}>
              {message.reply.text}
            </Text>
          </View>
          <Text style={[styles.bubbleMeta, { color: colors.mutedForeground }]}>
            {encounterName} · {formatTime(message.reply.receivedAt)}
          </Text>
        </View>
      ) : (
        <View style={styles.bubbleOtherRow}>
          <View
            style={[
              styles.bubble,
              styles.bubbleOther,
              { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.typingText, { color: colors.mutedForeground }]}>
              {encounterName} is typing…
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 6,
  },
  headerBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
  },
  headerName: { fontFamily: "Inter_700Bold", fontSize: 16 },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 },
  detailsPanel: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  detailsHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  detailsAvatar: { width: 64, height: 64, borderRadius: 32 },
  detailsName: { fontFamily: "Inter_700Bold", fontSize: 18 },
  detailsMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailsMeta: { fontFamily: "Inter_500Medium", fontSize: 13 },
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
    fontSize: 13,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  socialsBlock: {
    gap: 8,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  thread: {
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 12,
  },
  threadHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  threadDivider: {
    flex: 1,
    height: 1,
  },
  dateLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  startCard: {
    alignItems: "center",
    gap: 8,
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 4,
  },
  startTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    textAlign: "center",
    marginTop: 2,
  },
  startSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  bubbleSelfRow: {
    alignItems: "flex-end",
    gap: 4,
  },
  bubbleOtherRow: {
    alignItems: "flex-start",
    gap: 4,
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleSelf: {
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleSelfText: {
    color: "#FFFFFF",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 19,
  },
  bubbleOtherText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 19,
  },
  bubbleMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  typingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    fontStyle: "italic",
  },
  composerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 6,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 6,
    borderRadius: 22,
    borderWidth: 1,
  },
  composerInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    maxHeight: 110,
  },
  composerSend: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  composerCounter: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    paddingHorizontal: 6,
  },
  composerHelp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  composerHelpText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  upgradeMsgCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  upgradeMsgTitle: { fontFamily: "Inter_700Bold", fontSize: 14 },
  upgradeMsgSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
});
