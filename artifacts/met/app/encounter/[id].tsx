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
import { PrimaryButton } from "@/components/PrimaryButton";
import { SocialChip } from "@/components/SocialChip";
import { TierBadge } from "@/components/TierBadge";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/lib/revenuecat";
import type { SocialPlatform } from "@/lib/types";
import {
  FREE_REVEALS_PER_DAY,
  PLUS_OPENING_MESSAGES_PER_DAY,
  PRO_OPENING_MESSAGES_PER_DAY,
  getOpeningMessagesRemaining,
  getRevealsRemaining,
  tryConsumeFreeReveal,
  tryConsumeOpeningMessage,
} from "@/lib/usage";

function formatDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EncounterDetail() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    allEncounters,
    updateEncounterStatus,
    removeEncounter,
    setBlocked,
    sendOpeningMessage,
  } = useApp();
  const {
    tier,
    isSubscribed,
    isPlusSubscriber,
    isProSubscriber,
    isSubscriptionReady,
  } = useSubscription();

  const [menuOpen, setMenuOpen] = useState(false);
  const [revealsRemaining, setRevealsRemaining] = useState<number | null>(null);
  const [openingsRemaining, setOpeningsRemaining] = useState<number | null>(null);

  const openingPerDay = isProSubscriber
    ? PRO_OPENING_MESSAGES_PER_DAY
    : PLUS_OPENING_MESSAGES_PER_DAY;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getRevealsRemaining(),
      getOpeningMessagesRemaining(openingPerDay),
    ]).then(([r, o]) => {
      if (cancelled) return;
      setRevealsRemaining(r);
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

  useEffect(() => {
    if (encounter?.status === "request_sent") {
      const t = setTimeout(() => {
        updateEncounterStatus(encounter.id, "connected");
      }, 3000);
      return () => clearTimeout(t);
    }
    return;
  }, [encounter?.status, encounter?.id, updateEncounterStatus]);

  const [draft, setDraft] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  if (!encounter) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, padding: 24 }}>
          This encounter is gone.
        </Text>
      </View>
    );
  }

  const isConnected = encounter.status === "connected";
  const isRequestSent = encounter.status === "request_sent";
  const isRequestReceived = encounter.status === "request_received";

  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBot = Platform.OS === "web" ? 34 : 0;

  const [sending, setSending] = useState(false);
  const handleSend = async () => {
    if (sending) return;
    if (!isSubscriptionReady) return;
    setSending(true);
    try {
      if (!isSubscribed) {
        const consumed = await tryConsumeFreeReveal();
        if (consumed === null) {
          router.push("/paywall");
          return;
        }
        setRevealsRemaining(await getRevealsRemaining());
      }
      await updateEncounterStatus(encounter.id, "request_sent");
    } finally {
      setSending(false);
    }
  };
  const handleAccept = () => updateEncounterStatus(encounter.id, "connected");
  const handleDecline = () => {
    updateEncounterStatus(encounter.id, "encounter");
    router.back();
  };

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
    const url = `https://www.google.com/maps/search/?api=1&query=${q}`;
    Linking.openURL(url).catch(() => {});
  };

  const handleSendOpeningMessage = async () => {
    if (sendingMsg) return;
    if (!isSubscriptionReady) return;
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
        // Quota hit between render and tap.
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

  const hasPendingMessage =
    !!encounter.openingMessage && !encounter.openingMessage.reply;

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + webBot + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: encounter.photoUri }}
            style={styles.heroImg}
            contentFit="cover"
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.5)", "transparent", "rgba(0,0,0,0.65)"]}
            locations={[0, 0.4, 1]}
            style={styles.heroFade}
          />

          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={[
              styles.iconBtn,
              {
                top: insets.top + webTop + 12,
                left: 16,
              },
            ]}
          >
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>

          <Pressable
            hitSlop={12}
            onPress={() => setMenuOpen(true)}
            style={[
              styles.iconBtn,
              {
                top: insets.top + webTop + 12,
                right: 16,
              },
            ]}
          >
            <Feather name="more-vertical" size={22} color="#fff" />
          </Pressable>

          <Text style={styles.heroName}>{encounter.realName}</Text>
        </View>

        <View
          style={[
            styles.body,
            {
              backgroundColor: colors.card,
            },
          ]}
        >
          <View style={styles.metaRow}>
            <Feather name="repeat" size={16} color={colors.primary} />
            <Text style={[styles.metaPrimary, { color: colors.primary }]}>
              Met {encounter.encounterCount}{" "}
              {encounter.encounterCount === 1 ? "time" : "times"}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Feather name="calendar" size={16} color={colors.mutedForeground} />
            <Text style={[styles.metaMuted, { color: colors.mutedForeground }]}>
              First met on {formatDate(encounter.firstSeenAt)}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Bio
            </Text>
            <Text style={[styles.bioText, { color: colors.foreground }]}>
              {encounter.bio || "—"}
            </Text>
          </View>

          {encounter.lastLocation ? (
            <View style={styles.section}>
              <Text
                style={[styles.sectionLabel, { color: colors.mutedForeground }]}
              >
                Meeting Spot
              </Text>
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
                  <View style={styles.mapIconWrap}>
                    <Feather name="map-pin" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mapLocation} numberOfLines={1}>
                      {encounter.lastLocation}
                    </Text>
                    <Text style={styles.mapCta}>Tap to view on Maps</Text>
                  </View>
                  <Feather name="external-link" size={18} color="#FFFFFF" />
                </LinearGradient>
              </Pressable>
            </View>
          ) : null}

          {isConnected ? (
            <>
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  Social Links
                </Text>
                {socialEntries.length === 0 ? (
                  <Text style={[styles.bioText, { color: colors.mutedForeground }]}>
                    No social handles shared.
                  </Text>
                ) : (
                  <View style={styles.chipsRow}>
                    {socialEntries.map(([platform, handle]) => (
                      <SocialChip
                        key={platform}
                        platform={platform}
                        handle={handle}
                      />
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  Opening Message
                </Text>
                <OpeningMessageThread
                  colors={colors}
                  encounterName={encounter.realName}
                  message={encounter.openingMessage}
                />

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
                        style={[styles.upgradeMsgSub, { color: colors.mutedForeground }]}
                      >
                        Unlock with Met Plus or Pro
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </Pressable>
                ) : openingsRemaining !== null && openingsRemaining <= 0 && !encounter.openingMessage ? (
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
                    <Text style={[styles.composerHelpText, { color: colors.mutedForeground }]}>
                      You&rsquo;ve used your {openingPerDay} opening{" "}
                      {openingPerDay === 1 ? "message" : "messages"} for today.
                      {isProSubscriber ? " Resets at midnight." : " Upgrade to Met Pro for more."}
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
                    <Text style={[styles.composerHelpText, { color: colors.mutedForeground }]}>
                      Wait for {encounter.realName} to reply before sending another message.
                    </Text>
                  </View>
                ) : (
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
                        encounter.openingMessage?.reply
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
                      onPress={handleSendOpeningMessage}
                      disabled={!draft.trim() || sendingMsg}
                      style={({ pressed }) => [
                        styles.composerSend,
                        {
                          backgroundColor: colors.primary,
                          opacity: !draft.trim() || sendingMsg
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
                )}

                {isPlusSubscriber && openingsRemaining !== null ? (
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
              </View>
            </>
          ) : (
            <View
              style={[
                styles.lockCard,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                },
              ]}
            >
              {isRequestReceived ? (
                <>
                  <Feather name="bell" size={28} color={colors.primary} />
                  <Text style={[styles.lockTitle, { color: colors.foreground }]}>
                    Wants to share socials
                  </Text>
                  <Text style={[styles.lockSub, { color: colors.mutedForeground }]}>
                    {encounter.realName} sent you a reveal request.
                  </Text>
                  <View style={{ width: "100%", gap: 10, marginTop: 6 }}>
                    <PrimaryButton
                      label="ACCEPT REVEAL"
                      onPress={handleAccept}
                    />
                    <PrimaryButton
                      label="Not now"
                      variant="ghost"
                      onPress={handleDecline}
                    />
                  </View>
                </>
              ) : isRequestSent ? (
                <>
                  <Feather name="clock" size={28} color={colors.mutedForeground} />
                  <Text style={[styles.lockTitle, { color: colors.foreground }]}>
                    Request sent
                  </Text>
                  <Text style={[styles.lockSub, { color: colors.mutedForeground }]}>
                    Waiting for {encounter.realName} to reveal back…
                  </Text>
                  <View style={{ width: "100%", marginTop: 6 }}>
                    <PrimaryButton
                      label="WAITING…"
                      onPress={() => {}}
                      loading
                      disabled
                    />
                  </View>
                </>
              ) : (
                <>
                  <Feather name="lock" size={28} color={colors.mutedForeground} />
                  <Text style={[styles.lockTitle, { color: colors.foreground }]}>
                    Socials are hidden
                  </Text>
                  <View style={{ width: "100%", marginTop: 6 }}>
                    <PrimaryButton
                      label="SEND REVEAL REQUEST"
                      onPress={handleSend}
                      disabled={!isSubscriptionReady || sending}
                      loading={sending}
                    />
                  </View>
                  {isSubscriptionReady && !isSubscribed && revealsRemaining !== null ? (
                    <Text
                      style={[
                        styles.lockSub,
                        { color: colors.mutedForeground, marginTop: 8 },
                      ]}
                    >
                      {revealsRemaining > 0
                        ? `${revealsRemaining} of ${FREE_REVEALS_PER_DAY} free reveals left today`
                        : `Free limit reached — Met Plus unlocks unlimited reveals`}
                    </Text>
                  ) : null}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={encounter.realName}
        actions={[
          {
            label: isConnected ? "Remove connection" : "Remove encounter",
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

function OpeningMessageThread({
  colors,
  encounterName,
  message,
}: {
  colors: ReturnType<typeof useColors>;
  encounterName: string;
  message: import("@/lib/types").OpeningMessage | undefined;
}) {
  if (!message) {
    return (
      <Text style={[styles.threadEmpty, { color: colors.mutedForeground }]}>
        Break the ice — your first message kicks off the conversation.
      </Text>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <View style={[styles.bubbleSelfRow]}>
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
        <View style={[styles.bubbleOtherRow]}>
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
        <View style={[styles.bubbleOtherRow]}>
          <View
            style={[
              styles.bubble,
              styles.bubbleOther,
              { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            <TierBadge tier="free" />
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
  heroWrap: {
    width: "100%",
    height: 480,
    position: "relative",
  },
  heroImg: { width: "100%", height: "100%" },
  heroFade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  iconBtn: {
    position: "absolute",
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  heroName: {
    position: "absolute",
    left: 24,
    bottom: 24,
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 22,
    gap: 14,
    marginTop: -16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metaPrimary: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  metaMuted: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  section: { gap: 8, marginTop: 8 },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  bioText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  lockCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  lockTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    marginTop: 4,
  },
  lockSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
  },
  mapCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  mapIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapLocation: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  mapCta: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  composerInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 6,
    minHeight: 36,
    maxHeight: 96,
  },
  composerSend: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  composerHelp: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  composerHelpText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  composerCounter: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 2,
  },
  upgradeMsgCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  upgradeMsgTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  upgradeMsgSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  threadEmpty: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  bubbleSelfRow: { alignItems: "flex-end", gap: 4 },
  bubbleOtherRow: { alignItems: "flex-start", gap: 4 },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: "85%",
  },
  bubbleSelf: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleSelfText: {
    color: "#FFFFFF",
    fontFamily: "Inter_400Regular",
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
});
