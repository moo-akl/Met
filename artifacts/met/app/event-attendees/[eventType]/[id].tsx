import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api/client";
import {
  getGetEventAttendeesQueryOptions,
  useGetEventCheckinQr,
} from "@workspace/api-client-react";

type EventType = "venue" | "member";
const EVENT_POSTER_THEMES = [
  { id: "garden", label: "Garden", background: "#f8f7ef", border: "#dce8df", text: "#183c2f", accent: "#26735a", muted: "#557066" },
  { id: "studio", label: "Studio", background: "#f5eee3", border: "#e2d0b8", text: "#253b35", accent: "#b46b43", muted: "#78644f" },
  { id: "after-hours", label: "After hours", background: "#0f0f13", border: "#51452b", text: "#f8f5ef", accent: "#d7a449", muted: "#d7bd7d" },
] as const;
type EventPosterTheme = (typeof EVENT_POSTER_THEMES)[number]["id"];
type EventPosterSettings = { theme: EventPosterTheme; message: string };
const DEFAULT_EVENT_POSTER_SETTINGS: EventPosterSettings = {
  theme: "garden",
  message: "Scan to check in with Met",
};

export default function EventAttendeesScreen() {
  const params = useLocalSearchParams<{ eventType?: string; id?: string; title?: string }>();
  const eventType = params.eventType === "venue" ? "venue" : "member";
  const eventId = Number(params.id);
  const validRoute =
    (params.eventType === "venue" || params.eventType === "member") &&
    Number.isSafeInteger(eventId) &&
    eventId > 0;

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { authedUid } = useApp();
  const attendeesQuery = useQuery({
    ...getGetEventAttendeesQueryOptions(eventType, validRoute ? eventId : 0),
    enabled: validRoute,
    staleTime: 30_000,
  });
  const qrMutation = useGetEventCheckinQr();
  const posterRef = useRef<View | null>(null);
  const posterKey = `${eventType}:${eventId}`;
  const [posterSettingsByEvent, setPosterSettingsByEvent] = useState<Record<string, EventPosterSettings>>({});
  const [qrUrl, setQrUrl] = useState("");
  const [qrError, setQrError] = useState("");
  const [posterPending, setPosterPending] = useState(false);
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [requestedUids, setRequestedUids] = useState<string[]>([]);

  const loadQr = async (rotate = false) => {
    if (!validRoute) return;
    setQrError("");
    try {
      const result = await qrMutation.mutateAsync({
        eventType: eventType as EventType,
        eventId,
        data: { rotate },
      });
      setQrUrl(result.url);
    } catch (error) {
      setQrError(error instanceof Error ? error.message : "Could not load the event QR code.");
    }
  };

  const rotateQr = () => {
    Alert.alert(
      "Replace this QR code?",
      "The previous code will stop working immediately.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Replace code", onPress: () => void loadQr(true) },
      ],
    );
  };

  const sendConnectionRequest = async (recipientUid: string, eventTitle: string) => {
    if (!authedUid || pendingUid) return;
    setPendingUid(recipientUid);
    try {
      await api.sendReveal(
        { uid: authedUid },
        {
          recipientUid,
          message: `We were both at ${eventTitle}. Would you like to connect?`,
        },
      );
      setRequestedUids((current) => [...new Set([...current, recipientUid])]);
    } catch (error) {
      Alert.alert(
        "Request not sent",
        error instanceof Error ? error.message : "Could not send the connection request.",
      );
    } finally {
      setPendingUid(null);
    }
  };

  const attendees = attendeesQuery.data?.attendees ?? [];
  const eventTitle = typeof params.title === "string" && params.title.trim()
    ? params.title.trim()
    : "this event";
  const posterSettings = posterSettingsByEvent[posterKey] ?? DEFAULT_EVENT_POSTER_SETTINGS;
  const posterTheme = EVENT_POSTER_THEMES.find((theme) => theme.id === posterSettings.theme) ?? EVENT_POSTER_THEMES[0];
  const updatePosterSettings = (patch: Partial<EventPosterSettings>) => {
    setPosterSettingsByEvent((current) => ({
      ...current,
      [posterKey]: {
        ...(current[posterKey] ?? DEFAULT_EVENT_POSTER_SETTINGS),
        ...patch,
      },
    }));
  };

  const savePoster = async () => {
    if (!qrUrl || posterPending) return;
    if (!posterRef.current) {
      Alert.alert("Poster not ready", "Show the event QR code, then try again.");
      return;
    }

    setPosterPending(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Sharing is not available on this device.");
      }
      const uri = await captureRef(posterRef.current, {
        format: "png",
        quality: 1,
        result: "tmpfile",
        width: 1260,
        height: 1782,
      });
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: `${eventTitle} — Check-in poster`,
        UTI: "public.png",
      });
    } catch (error) {
      Alert.alert(
        "Couldn't create poster",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setPosterPending(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="button-back-event-attendance"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Event attendance</Text>
        <View style={styles.headerButton} />
      </View>

      {attendeesQuery.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : attendeesQuery.isError ? (
        <View style={styles.loading}>
          <Feather name="lock" size={28} color={colors.mutedForeground} />
          <Text style={[styles.stateText, { color: colors.text }]}>
            Only this event’s creator can view its attendance.
          </Text>
          <Pressable
            accessibilityRole="button"
            testID="button-retry-event-attendees"
            onPress={() => void attendeesQuery.refetch()}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAwareScrollViewCompat
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 28 },
          ]}
          bottomOffset={20}
          keyboardDismissMode="on-drag"
        >
          <View style={[styles.qrCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeading}>
              <View style={[styles.iconBox, { backgroundColor: colors.primarySoft }]}>
                <Feather name="maximize" size={18} color={colors.primary} />
              </View>
              <View style={styles.headingCopy}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Event check-in QR</Text>
                <Text style={[styles.caption, { color: colors.mutedForeground }]}>
                  Guests scan this code in Met to record attendance.
                </Text>
              </View>
            </View>
            {qrUrl ? (
              <View
                ref={posterRef}
                collapsable={false}
                testID="event-checkin-poster-preview"
                style={[
                  styles.posterPreview,
                  { backgroundColor: posterTheme.background, borderColor: posterTheme.border },
                ]}
              >
                <View style={styles.posterBrand}>
                  <View style={[styles.posterMark, { backgroundColor: posterTheme.accent }]}>
                    <Text style={styles.posterMarkText}>m</Text>
                  </View>
                  <Text style={[styles.posterBrandLabel, { color: posterTheme.muted }]}>MET · EVENT CHECK-IN</Text>
                </View>
                <View style={styles.posterHeading}>
                  <Text style={[styles.posterEyebrow, { color: posterTheme.muted }]}>EVENT CHECK-IN</Text>
                  <Text style={[styles.posterTitle, { color: posterTheme.text }]}>{eventTitle}</Text>
                  {posterSettings.message.trim() ? (
                    <Text style={[styles.posterInstruction, { color: posterTheme.accent }]}>
                      {posterSettings.message.trim()}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.posterCodeFrame, { borderColor: posterTheme.border }]}>
                  <QRCode value={qrUrl} size={176} color="black" backgroundColor="white" />
                </View>
                <Text style={[styles.posterFooter, { color: posterTheme.muted, borderTopColor: posterTheme.border }]}>
                  Open Met to record your attendance
                </Text>
              </View>
            ) : (
              <View style={[styles.qrPlaceholder, { borderColor: colors.border }]}>
                {qrMutation.isPending ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={[styles.caption, { color: colors.mutedForeground }]}>
                    Create the event-specific code to display at the event.
                  </Text>
                )}
              </View>
            )}
            {qrUrl ? (
              <View style={styles.posterCustomizer}>
                <View style={styles.posterThemeHeading}>
                  <Text style={[styles.posterControlLabel, { color: colors.text }]}>Poster theme</Text>
                  <Text style={[styles.caption, { color: colors.mutedForeground }]}>QR stays black on white.</Text>
                </View>
                <View style={styles.posterThemeOptions}>
                  {EVENT_POSTER_THEMES.map((theme) => {
                    const selected = posterSettings.theme === theme.id;
                    return (
                      <Pressable
                        key={theme.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        testID={`button-event-poster-theme-${theme.id}`}
                        onPress={() => updatePosterSettings({ theme: theme.id })}
                        style={[
                          styles.posterThemeOption,
                          {
                            borderColor: selected ? colors.primary : colors.border,
                            backgroundColor: selected ? colors.primarySoft : colors.card,
                          },
                        ]}
                      >
                        <View style={[styles.posterThemeSwatch, { backgroundColor: theme.background, borderColor: theme.border }]}>
                          <View style={[styles.posterThemeSwatchAccent, { backgroundColor: theme.accent }]} />
                        </View>
                        <Text style={[styles.posterThemeName, { color: colors.text }]}>{theme.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[styles.posterControlLabel, { color: colors.text }]}>Supporting message (optional)</Text>
                <TextInput
                  accessibilityLabel="Poster supporting message"
                  testID="input-event-poster-message"
                  value={posterSettings.message}
                  onChangeText={(message) => updatePosterSettings({ message })}
                  maxLength={80}
                  multiline
                  placeholder="Add a short check-in instruction"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.posterMessageInput,
                    { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
                  ]}
                />
                <View style={styles.posterCustomizerFooter}>
                  <Text style={[styles.caption, { color: colors.mutedForeground }]}>
                    Poster-only settings; the event title and QR link are unchanged.
                  </Text>
                  <Text style={[styles.caption, { color: colors.mutedForeground }]}>
                    {posterSettings.message.length}/80
                  </Text>
                </View>
              </View>
            ) : null}
            {qrError ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>
                {qrError}
              </Text>
            ) : null}
            <View style={styles.qrActions}>
              <Pressable
                accessibilityRole="button"
                testID="button-show-event-qr"
                disabled={qrMutation.isPending}
                onPress={() => void loadQr(false)}
                style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: qrMutation.isPending ? 0.6 : 1 }]}
              >
                <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                  {qrUrl ? "Refresh QR" : "Show QR"}
                </Text>
              </Pressable>
              {qrUrl ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    testID="button-share-event-qr-link"
                    onPress={() => void Share.share({ message: qrUrl, url: qrUrl })}
                    style={[styles.secondaryButton, { borderColor: colors.border }]}
                  >
                    <Feather name="share-2" size={15} color={colors.text} />
                    <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Share link</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: posterPending }}
                    testID="button-save-event-checkin-poster"
                    disabled={posterPending}
                    onPress={() => void savePoster()}
                    style={[styles.secondaryButton, { borderColor: colors.border, opacity: posterPending ? 0.6 : 1 }]}
                  >
                    {posterPending ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Feather name="printer" size={15} color={colors.text} />
                    )}
                    <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                      {posterPending ? "Preparing poster…" : "Save / print poster"}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    testID="button-rotate-event-qr"
                    onPress={rotateQr}
                    style={[styles.secondaryButton, { borderColor: colors.border }]}
                  >
                    <Feather name="refresh-cw" size={15} color={colors.text} />
                    <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Replace code</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>

          <View style={styles.attendeeSection}>
            <View style={styles.listHeading}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Checked-in attendees</Text>
                <Text style={[styles.caption, { color: colors.mutedForeground }]}>
                  {attendees.length} verified {attendees.length === 1 ? "check-in" : "check-ins"} · RSVPs are not included
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Refresh checked-in attendees"
                testID="button-refresh-event-attendees"
                onPress={() => void attendeesQuery.refetch()}
                style={styles.refreshButton}
              >
                <Feather name="refresh-cw" size={17} color={colors.primary} />
              </Pressable>
            </View>
            {attendees.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="users" size={23} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Verified check-ins will appear here after guests arrive.
                </Text>
              </View>
            ) : (
              attendees.map((attendee) => {
                const sent = requestedUids.includes(attendee.uid);
                const isSelf = attendee.uid === authedUid;
                return (
                  <View
                    key={attendee.uid}
                    testID={`row-event-attendee-${attendee.uid}`}
                    style={[styles.attendeeRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    {attendee.photoUrl ? (
                      <Image source={{ uri: attendee.photoUrl }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatarFallback, { backgroundColor: colors.primarySoft }]}>
                        <Feather name="user" size={17} color={colors.primary} />
                      </View>
                    )}
                    <View style={styles.attendeeCopy}>
                      <Text style={[styles.attendeeName, { color: colors.text }]} numberOfLines={1}>
                        {attendee.displayName}
                      </Text>
                      <Text style={[styles.caption, { color: colors.mutedForeground }]}>
                        {attendee.checkInMethod === "qr" ? "QR check-in" : "Location check-in"} ·{" "}
                        {new Date(attendee.checkedInAt).toLocaleString()}
                      </Text>
                    </View>
                    {!isSelf ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: sent || pendingUid === attendee.uid }}
                        testID={`button-connect-event-attendee-${attendee.uid}`}
                        disabled={sent || pendingUid !== null}
                        onPress={() => void sendConnectionRequest(attendee.uid, eventTitle)}
                        style={[
                          styles.connectButton,
                          { backgroundColor: sent ? colors.muted : colors.primarySoft },
                        ]}
                      >
                        {pendingUid === attendee.uid ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Text style={[styles.connectText, { color: colors.primary }]}>
                            {sent ? "Sent" : "Connect"}
                          </Text>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </KeyboardAwareScrollViewCompat>
      )}
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
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  stateText: { textAlign: "center", fontSize: 14, lineHeight: 20 },
  content: { padding: 16, gap: 22 },
  qrCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 14 },
  cardHeading: { flexDirection: "row", alignItems: "center", gap: 11 },
  iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headingCopy: { flex: 1, gap: 3 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  caption: { fontSize: 12, lineHeight: 17 },
  qrPlaceholder: { minHeight: 150, borderWidth: 1, borderStyle: "dashed", borderRadius: 16, alignItems: "center", justifyContent: "center", padding: 18 },
  qrActions: { gap: 8 },
  posterPreview: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 210 / 297,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dce8df",
    borderRadius: 16,
    backgroundColor: "white",
  },
  posterBrand: { flexDirection: "row", alignItems: "center", gap: 8 },
  posterMark: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#0d7659" },
  posterMarkText: { color: "white", fontSize: 16, fontStyle: "italic", fontWeight: "700" },
  posterBrandLabel: { color: "#557066", fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  posterHeading: { width: "100%", alignItems: "center", gap: 4 },
  posterEyebrow: { color: "#658273", fontSize: 10, fontWeight: "600", letterSpacing: 1.6, textAlign: "center" },
  posterTitle: { color: "#1c2521", fontSize: 21, fontWeight: "700", lineHeight: 26, textAlign: "center" },
  posterInstruction: { color: "#0d7659", maxWidth: 290, fontSize: 13, fontWeight: "700", lineHeight: 17, textAlign: "center" },
  posterCodeFrame: {
    width: 200,
    aspectRatio: 1,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dce8df",
    borderRadius: 14,
    backgroundColor: "white",
  },
  posterFooter: {
    width: "100%",
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: "#e4ebe2",
    color: "#708178",
    fontSize: 11,
    textAlign: "center",
  },
  posterCustomizer: { gap: 9 },
  posterThemeHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  posterControlLabel: { fontSize: 12, fontWeight: "700" },
  posterThemeOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  posterThemeOption: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, borderWidth: 1, borderRadius: 10 },
  posterThemeSwatch: { width: 18, height: 18, borderWidth: 1, borderRadius: 6, overflow: "hidden", justifyContent: "flex-end" },
  posterThemeSwatchAccent: { height: 4, width: "100%" },
  posterThemeName: { fontSize: 12, fontWeight: "600" },
  posterMessageInput: { minHeight: 60, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, fontSize: 13, lineHeight: 18, textAlignVertical: "top" },
  posterCustomizerFooter: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  primaryButton: { minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  primaryButtonText: { fontSize: 13, fontWeight: "700" },
  secondaryButton: { minHeight: 42, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryButtonText: { fontSize: 13, fontWeight: "600" },
  error: { fontSize: 13, lineHeight: 19 },
  attendeeSection: { gap: 10 },
  listHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  refreshButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  emptyCard: { minHeight: 100, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 9, padding: 16 },
  emptyText: { textAlign: "center", fontSize: 13, lineHeight: 19 },
  attendeeRow: { borderWidth: 1, borderRadius: 15, padding: 11, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  attendeeCopy: { flex: 1, gap: 3 },
  attendeeName: { fontSize: 14, fontWeight: "700" },
  connectButton: { minWidth: 72, minHeight: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  connectText: { fontSize: 12, fontWeight: "700" },
});
