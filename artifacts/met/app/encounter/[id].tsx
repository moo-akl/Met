import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SocialLinkRow } from "@/components/SocialLinkRow";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

function timeAgo(ts: number) {
  const diff = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function EncounterDetail() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { encounters, updateEncounterStatus } = useApp();

  const encounter = useMemo(
    () => encounters.find((e) => e.id === id),
    [encounters, id],
  );

  // Demo behavior: when a request is sent, simulate acceptance after 3 seconds.
  useEffect(() => {
    if (encounter?.status === "request_sent") {
      const t = setTimeout(() => {
        updateEncounterStatus(encounter.id, "connected");
      }, 3000);
      return () => clearTimeout(t);
    }
    return;
  }, [encounter?.status, encounter?.id, updateEncounterStatus]);

  if (!encounter) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, padding: 24 }}>
          This encounter is gone.
        </Text>
      </View>
    );
  }

  const revealed = encounter.status === "connected";
  const isRequestSent = encounter.status === "request_sent";
  const isRequestReceived = encounter.status === "request_received";

  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBot = Platform.OS === "web" ? 34 : 0;

  const handleSend = () => updateEncounterStatus(encounter.id, "request_sent");
  const handleAccept = () => updateEncounterStatus(encounter.id, "connected");
  const handleDecline = () => {
    updateEncounterStatus(encounter.id, "encounter");
    router.back();
  };

  const socialEntries = Object.entries(encounter.socials).filter(
    ([, v]) => v && v.trim(),
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + webBot + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          {revealed && encounter.photoUri ? (
            <Image
              source={{ uri: encounter.photoUri }}
              style={styles.heroImg}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={["#1F1F2A", "#0A0A0F"]}
              style={styles.heroImg}
            >
              <View style={styles.anonInner}>
                <Avatar revealed={false} size={120} />
              </View>
            </LinearGradient>
          )}
          <LinearGradient
            colors={["transparent", "rgba(10,10,15,0.95)"]}
            style={styles.heroFade}
          />

          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={[
              styles.backBtn,
              {
                top: insets.top + webTop + 12,
                backgroundColor: "rgba(0,0,0,0.45)",
              },
            ]}
          >
            <Feather name="chevron-left" size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={[styles.name, { color: colors.foreground }]}>
            {revealed ? encounter.realName : "Someone nearby"}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Feather name="map-pin" size={13} color={colors.mutedForeground} />
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {encounter.lastDistanceM}m · {encounter.lastLocation}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="clock" size={13} color={colors.mutedForeground} />
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {timeAgo(encounter.lastSeenAt)}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.crossPath,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.crossPathIcon,
                { backgroundColor: colors.secondary },
              ]}
            >
              <Feather name="git-merge" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.crossPathTitle, { color: colors.foreground }]}>
                Crossed paths {encounter.encounterCount}{" "}
                {encounter.encounterCount === 1 ? "time" : "times"}
              </Text>
              <Text style={[styles.crossPathSub, { color: colors.mutedForeground }]}>
                Most recent at {encounter.lastLocation.toLowerCase()}.
              </Text>
            </View>
          </View>

          {revealed ? (
            <View style={styles.connectedBlock}>
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  ABOUT
                </Text>
                <Text style={[styles.bio, { color: colors.foreground }]}>
                  {encounter.bio}
                </Text>
              </View>

              {socialEntries.length > 0 ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                    REACH OUT
                  </Text>
                  <View style={{ gap: 10 }}>
                    {socialEntries.map(([platform, handle]) => (
                      <SocialLinkRow
                        key={platform}
                        platform={platform as keyof typeof encounter.socials}
                        handle={handle as string}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.actionBlock}>
              {isRequestReceived ? (
                <View
                  style={[
                    styles.notice,
                    { backgroundColor: colors.card, borderColor: colors.primary },
                  ]}
                >
                  <Feather name="bell" size={16} color={colors.primary} />
                  <Text style={[styles.noticeText, { color: colors.foreground }]}>
                    This person revealed first. Accept to connect.
                  </Text>
                </View>
              ) : isRequestSent ? (
                <View
                  style={[
                    styles.notice,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Feather name="clock" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.noticeText, { color: colors.foreground }]}>
                    Request sent. Waiting for them to reveal back…
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.notice,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Feather name="eye-off" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.noticeText, { color: colors.foreground }]}>
                    Their photo, name, and socials stay private until you both
                    reveal.
                  </Text>
                </View>
              )}

              <View style={{ gap: 12 }}>
                {isRequestReceived ? (
                  <>
                    <PrimaryButton label="Accept reveal" onPress={handleAccept} />
                    <PrimaryButton
                      label="Not now"
                      variant="ghost"
                      onPress={handleDecline}
                    />
                  </>
                ) : isRequestSent ? (
                  <PrimaryButton
                    label="Waiting…"
                    onPress={() => {}}
                    disabled
                    loading
                  />
                ) : (
                  <PrimaryButton
                    label="Send reveal request"
                    onPress={handleSend}
                  />
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroWrap: {
    width: "100%",
    height: 380,
    position: "relative",
  },
  heroImg: {
    width: "100%",
    height: "100%",
  },
  anonInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 160,
  },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    paddingHorizontal: 24,
    marginTop: -40,
    gap: 22,
  },
  name: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: -8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  meta: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  crossPath: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  crossPathIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  crossPathTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  crossPathSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12.5,
    marginTop: 2,
  },
  actionBlock: { gap: 18 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  noticeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13.5,
    flex: 1,
    lineHeight: 19,
  },
  connectedBlock: { gap: 22 },
  section: { gap: 10 },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.4,
  },
  bio: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    lineHeight: 24,
  },
});
