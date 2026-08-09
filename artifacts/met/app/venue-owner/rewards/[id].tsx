/**
 * Edit Venue Reward screen.
 *
 * Receives reward fields via router params (from the rewards list screen),
 * pre-fills the form, and updates via PUT /api/venue-owner/me/rewards/:id.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { api, ApiError } from "@/lib/api/client";
import { useColors } from "@/hooks/useColors";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";
import { DateTimePicker } from "@/components/DateTimePicker";

type RewardType = "free_drink" | "discount" | "experience" | "custom";
type RewardStatus = "draft" | "active" | "cancelled";

const REWARD_TYPES: Array<{ value: RewardType; label: string; icon: string }> = [
  { value: "free_drink", label: "Free Drink", icon: "🍹" },
  { value: "discount", label: "Discount", icon: "💸" },
  { value: "experience", label: "Experience", icon: "✨" },
  { value: "custom", label: "Custom", icon: "🎁" },
];

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function thirtyDaysFromNow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  d.setHours(23, 59, 0, 0);
  return d;
}

export default function EditVenueRewardScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    title?: string;
    description?: string;
    prizeDescription?: string;
    rewardType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    venueTimezone?: string;
  }>();

  const rewardId = Number(params.id);

  const [title, setTitle] = useState(params.title ?? "");
  const [description, setDescription] = useState(params.description ?? "");
  const [prizeDescription, setPrizeDescription] = useState(params.prizeDescription ?? "");
  const [rewardType, setRewardType] = useState<RewardType>(
    (params.rewardType as RewardType) ?? "custom",
  );
  const [startDate, setStartDate] = useState<Date>(() =>
    params.startDate ? new Date(params.startDate) : startOfToday(),
  );
  const [endDate, setEndDate] = useState<Date>(() =>
    params.endDate ? new Date(params.endDate) : thirtyDaysFromNow(),
  );
  const [venueTimezone, setVenueTimezone] = useState(params.venueTimezone ?? "UTC");
  const [submitting, setSubmitting] = useState(false);

  const currentStatus = (params.status ?? "draft") as RewardStatus;
  const canSubmit = title.trim().length > 0 && prizeDescription.trim().length > 0;

  const handleSave = async (newStatus?: RewardStatus) => {
    if (!authedUid || !canSubmit || submitting || !rewardId) return;

    if (endDate <= startDate) {
      Alert.alert("Invalid dates", "End date must be after start date.");
      return;
    }

    setSubmitting(true);
    try {
      await api.updateVenueReward({ uid: authedUid }, rewardId, {
        title: title.trim(),
        description: description.trim() || null,
        prizeDescription: prizeDescription.trim(),
        rewardType,
        status: newStatus ?? currentStatus,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        venueTimezone: venueTimezone.trim() || "UTC",
      });
      Alert.alert("Reward updated!", undefined, [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Failed to update reward");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <VenueOwnerHeader title="Edit Reward" onBack={() => router.back()} backLabel="Cancel" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Reward type selector */}
        <View>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Reward Type</Text>
          <View style={styles.typeRow}>
            {REWARD_TYPES.map((rt) => (
              <Pressable
                key={rt.value}
                onPress={() => setRewardType(rt.value)}
                style={[
                  styles.typeBtn,
                  {
                    backgroundColor: rewardType === rt.value ? colors.primary + "20" : colors.card,
                    borderColor: rewardType === rt.value ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={styles.typeIcon}>{rt.icon}</Text>
                <Text style={[styles.typeLabel, { color: rewardType === rt.value ? colors.primary : colors.mutedForeground }]}>
                  {rt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Field label="Campaign Title *" value={title} onChangeText={setTitle} placeholder="Summer Night Giveaway" colors={colors} />
        <Field label="Description (optional)" value={description} onChangeText={setDescription}
          placeholder="Brief description of this campaign" multiline numberOfLines={3} colors={colors} />
        <Field label="Prize Description *" value={prizeDescription} onChangeText={setPrizeDescription}
          placeholder="2 cocktails of your choice" colors={colors} />

        <DateTimePicker
          label="Start Date"
          mode="date"
          value={startDate}
          onChange={setStartDate}
          primaryColor={colors.primary}
        />

        <DateTimePicker
          label="End Date"
          mode="date"
          value={endDate}
          onChange={setEndDate}
          primaryColor={colors.primary}
        />

        <Field label="Timezone" value={venueTimezone} onChangeText={setVenueTimezone}
          placeholder="Europe/London" autoCapitalize="none" colors={colors} />

        {/* Action buttons */}
        <View style={styles.btnRow}>
          {currentStatus === "draft" && (
            <Pressable
              style={[styles.activateBtn, { borderColor: "#34C759" }]}
              onPress={() => void handleSave("active")}
              disabled={!canSubmit || submitting}
            >
              <Text style={[styles.activateBtnText, { color: "#34C759" }]}>Activate</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.saveBtn, { flex: 1, backgroundColor: canSubmit && !submitting ? colors.primary : colors.secondary }]}
            onPress={() => void handleSave()}
            disabled={!canSubmit || submitting}
          >
            {submitting ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save Changes</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, value, onChangeText, placeholder, multiline, numberOfLines, autoCapitalize = "sentences", colors,
}: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  multiline?: boolean; numberOfLines?: number; autoCapitalize?: "none" | "sentences";
  colors: { primary: string; foreground: string; card: string; mutedForeground: string; border: string };
}) {
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground} multiline={multiline}
        numberOfLines={numberOfLines} autoCapitalize={autoCapitalize}
        style={[
          styles.fieldInput,
          multiline && { height: (numberOfLines ?? 1) * 24 + 20, textAlignVertical: "top" },
          { borderColor: colors.primary + "40", backgroundColor: colors.card, color: colors.foreground },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 24, gap: 18 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  fieldInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: "center", gap: 3 },
  typeIcon: { fontSize: 20 },
  typeLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  btnRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  activateBtn: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center" },
  activateBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
