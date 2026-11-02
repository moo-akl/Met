import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateTimePicker } from "@/components/DateTimePicker";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { getGetEventsFeedQueryKey, useCreateCommunityEvent } from "@workspace/api-client-react";

function defaultStart(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(19, 0, 0, 0);
  return date;
}

export default function CreateEventScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useT();
  const { encounters } = useApp();
  const matches = useMemo(() => encounters.filter((encounter) => encounter.status === "connected"), [encounters]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState<Date>(defaultStart);
  const [visibility, setVisibility] = useState<"public" | "invite_only">("public");
  const [inviteeUids, setInviteeUids] = useState<string[]>([]);
  const [formError, setFormError] = useState("");

  const createEvent = useCreateCommunityEvent({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getGetEventsFeedQueryKey() });
        router.replace("/(tabs)/events" as never);
      },
      onError: (error) => {
        setFormError(error instanceof Error ? error.message : "Could not create the event.");
      },
    },
  });

  const toggleInvitee = (uid: string) => {
    setInviteeUids((current) => current.includes(uid)
      ? current.filter((item) => item !== uid)
      : [...current, uid]);
  };

  const submit = () => {
    setFormError("");
    if (!title.trim()) {
      setFormError(t("tabs.events.eventNameRequired"));
      return;
    }
    if (visibility === "invite_only" && inviteeUids.length === 0) {
      setFormError(t("tabs.events.noMatches"));
      return;
    }
    createEvent.mutate({
      data: {
        title: title.trim(),
        description: description.trim() || null,
        startsAt: startsAt.toISOString(),
        location: location.trim() || null,
        visibility,
        inviteeUids: visibility === "invite_only" ? inviteeUids : [],
      },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("tabs.events.create")}</Text>
        <View style={styles.back} />
      </View>
      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 24 }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.label, { color: colors.text }]}>{t("tabs.events.eventName")}</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t("tabs.events.eventName")}
          placeholderTextColor={colors.mutedForeground}
          maxLength={120}
          style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
        />
        <Text style={[styles.label, { color: colors.text }]}>{t("tabs.events.details")}</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t("tabs.events.details")}
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={2000}
          style={[styles.input, styles.multiline, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
        />
        <Text style={[styles.label, { color: colors.text }]}>{t("tabs.events.location")}</Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder={t("tabs.events.location")}
          placeholderTextColor={colors.mutedForeground}
          maxLength={200}
          style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
        />
        <DateTimePicker label={t("tabs.events.starts")} mode="datetime" value={startsAt} onChange={setStartsAt} primaryColor={colors.primary} labelColor={colors.mutedForeground} rowBg={colors.card} />

        <Text style={[styles.label, { color: colors.text }]}>{t("tabs.events.visibility")}</Text>
        <View style={styles.visibilityRow}>
          {(["public", "invite_only"] as const).map((value) => {
            const selected = visibility === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setVisibility(value)}
                style={[styles.visibilityOption, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.card }]}
              >
                <Text style={[styles.visibilityTitle, { color: colors.text }]}>{value === "public" ? t("tabs.events.public") : t("tabs.events.inviteOnly")}</Text>
                <Text style={[styles.visibilityText, { color: colors.mutedForeground }]}>
                  {value === "public" ? t("tabs.events.publicDescription") : t("tabs.events.invitedOnlyNotice")}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {visibility === "invite_only" ? (
          <View style={styles.matchesSection}>
            <Text style={[styles.label, { color: colors.text }]}>{t("tabs.events.inviteMatches")}</Text>
            {matches.length === 0 ? (
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>{t("tabs.events.noMatches")}</Text>
            ) : matches.map((match) => {
              const selected = inviteeUids.includes(match.id);
              return (
                <Pressable
                  key={match.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggleInvitee(match.id)}
                  style={[styles.matchRow, { borderBottomColor: colors.border }]}
                >
                  <Text style={[styles.matchName, { color: colors.text }]}>{match.realName}</Text>
                  <Feather name={selected ? "check-square" : "square"} size={21} color={selected ? colors.primary : colors.mutedForeground} />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {formError ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{formError}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={createEvent.isPending}
          onPress={submit}
          style={[styles.submit, { backgroundColor: colors.primary, opacity: createEvent.isPending ? 0.7 : 1 }]}
        >
          {createEvent.isPending ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.submitText, { color: colors.primaryForeground }]}>{t("tabs.events.submit")}</Text>}
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  scroll: { flex: 1 },
  form: { padding: 18, gap: 10 },
  label: { fontSize: 14, fontWeight: "700", marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 94, textAlignVertical: "top" },
  visibilityRow: { gap: 10 },
  visibilityOption: { borderWidth: 1, borderRadius: 14, padding: 13 },
  visibilityTitle: { fontSize: 14, fontWeight: "700" },
  visibilityText: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  matchesSection: { marginTop: 6 },
  helper: { fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  matchRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  matchName: { fontSize: 14, fontWeight: "500" },
  error: { fontSize: 13, fontWeight: "600", marginTop: 6 },
  submit: { minHeight: 48, borderRadius: 13, alignItems: "center", justifyContent: "center", marginTop: 10 },
  submitText: { fontSize: 15, fontWeight: "700" },
});
