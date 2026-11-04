import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { setPendingEventInvite } from "../_layout";
import {
  getGetEventsFeedQueryKey,
  useResolveEventInvite,
  useRsvpToEventInvite,
  type EventInviteSummary,
} from "@workspace/api-client-react";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

export default function EventInviteScreen() {
  const { token: rawToken } = useLocalSearchParams<{ token?: string }>();
  const token = typeof rawToken === "string" ? rawToken : "";
  const tokenIsValid = TOKEN_PATTERN.test(token);
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { t } = useT();
  const { authedUid } = useApp();
  const resolveMutation = useResolveEventInvite();
  const rsvpMutation = useRsvpToEventInvite();
  const [event, setEvent] = useState<EventInviteSummary | null>(null);
  const [requiresPasscode, setRequiresPasscode] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const resolve = useCallback(
    async (enteredPasscode?: string) => {
      if (!tokenIsValid) return;
      setLoading(true);
      setError("");
      try {
        const result = await resolveMutation.mutateAsync({
          data: {
            token,
            ...(enteredPasscode?.trim()
              ? { passcode: enteredPasscode.trim() }
              : {}),
          },
        });
        setRequiresPasscode(result.requiresPasscode);
        setEvent(result.event);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message.toLowerCase() : "";
        setError(
          message.includes("passcode")
            ? t("tabs.events.passcodeIncorrect")
            : t("tabs.events.inviteCouldNotLoad"),
        );
      } finally {
        setLoading(false);
      }
    },
    [resolveMutation.mutateAsync, t, token, tokenIsValid],
  );

  useEffect(() => {
    void resolve();
  }, [resolve]);

  const submitRsvp = async (status: "going" | "maybe" | "not_going") => {
    if (!event || !authedUid) return;
    setError("");
    try {
      await rsvpMutation.mutateAsync({
        data: {
          token,
          status,
          ...(requiresPasscode ? { passcode: passcode.trim() } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetEventsFeedQueryKey() });
      router.replace(`/event-details/member/${event.id}` as never);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("tabs.events.rsvpCouldNotSave"),
      );
    }
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t("tabs.events.eventInvitation")}
        </Text>
        <View style={styles.back} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {!tokenIsValid ? (
          <Text style={[styles.message, { color: colors.mutedForeground }]}>
            {t("tabs.events.inviteUnavailable")}
          </Text>
        ) : loading && !event ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : event ? (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {event.imageUrl ? (
              <Image source={{ uri: event.imageUrl }} style={styles.image} />
            ) : null}
            <View style={styles.eventContent}>
              <Text style={[styles.title, { color: colors.text }]}>{event.title}</Text>
              {event.creatorName ? (
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                  {t("tabs.events.createdBy")} {event.creatorName}
                </Text>
              ) : null}
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {new Date(event.startsAt).toLocaleString()}
              </Text>
              {event.location ? (
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                  {event.location}
                </Text>
              ) : null}
              {event.description ? (
                <Text style={[styles.description, { color: colors.text }]}>
                  {event.description}
                </Text>
              ) : null}
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {event.rsvpCount} · {t("tabs.events.going")}
              </Text>
              {authedUid ? (
                <View style={styles.actions}>
                  {(
                    [
                      ["going", "check-circle", t("tabs.events.going")],
                      ["maybe", "help-circle", t("tabs.events.maybe")],
                      ["not_going", "x-circle", t("tabs.events.notGoing")],
                    ] as const
                  ).map(([status, icon, label]) => (
                    <Pressable
                      key={status}
                      accessibilityRole="button"
                      disabled={rsvpMutation.isPending}
                      onPress={() => void submitRsvp(status)}
                      style={[
                        styles.action,
                        {
                          borderColor: colors.border,
                          backgroundColor: status === "going" ? colors.primary : colors.card,
                          opacity: rsvpMutation.isPending ? 0.65 : 1,
                        },
                      ]}
                    >
                      <Feather
                        name={icon}
                        size={18}
                        color={status === "going" ? colors.primaryForeground : colors.text}
                      />
                      <Text
                        style={[
                          styles.actionText,
                          {
                            color:
                              status === "going"
                                ? colors.primaryForeground
                                : colors.text,
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.signInBox}>
                  <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                    {t("tabs.events.signInToRsvp")}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setPendingEventInvite(token);
                      router.push("/onboarding" as never);
                    }}
                    style={[styles.action, { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.actionText, { color: colors.primaryForeground }]}>
                      {t("tabs.events.signIn")}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        ) : requiresPasscode ? (
          <View
            style={[
              styles.passcodeBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="lock" size={28} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>
              {t("tabs.events.passcodeProtected")}
            </Text>
            <Text style={[styles.helper, { color: colors.mutedForeground }]}>
              {t("tabs.events.enterInvitePasscode")}
            </Text>
            <TextInput
              accessibilityLabel={t("tabs.events.passcodeLabel")}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setPasscode}
              onSubmitEditing={() => void resolve(passcode)}
              placeholder={t("tabs.events.passcodeLabel")}
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="go"
              secureTextEntry
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
              value={passcode}
            />
            <Pressable
              accessibilityRole="button"
              disabled={loading || !passcode.trim()}
              onPress={() => void resolve(passcode)}
              style={[
                styles.action,
                {
                  backgroundColor: colors.primary,
                  opacity: loading || !passcode.trim() ? 0.6 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.actionText, { color: colors.primaryForeground }]}>
                  {t("tabs.events.unlockInvite")}
                </Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Text style={[styles.message, { color: colors.mutedForeground }]}>
            {t("tabs.events.inviteUnavailable")}
          </Text>
        )}

        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  content: { padding: 18, gap: 14, flexGrow: 1, justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: 18, overflow: "hidden" },
  image: { width: "100%", height: 210, resizeMode: "cover" },
  eventContent: { padding: 18, gap: 12 },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  meta: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  description: { fontSize: 15, lineHeight: 22, marginTop: 4 },
  actions: { gap: 8, marginTop: 8 },
  action: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionText: { fontSize: 15, fontWeight: "700" },
  signInBox: { alignItems: "center", gap: 10, marginTop: 8 },
  passcodeBox: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
    gap: 14,
    alignItems: "center",
  },
  helper: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  input: {
    width: "100%",
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  message: { fontSize: 15, textAlign: "center", padding: 18 },
  error: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});
