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

type RewardType = "free_drink" | "discount" | "experience" | "custom";
type RewardStatus = "draft" | "active" | "cancelled";

const REWARD_TYPES: Array<{ value: RewardType; label: string; icon: string }> = [
  { value: "free_drink", label: "Free Drink", icon: "🍹" },
  { value: "discount", label: "Discount", icon: "💸" },
  { value: "experience", label: "Experience", icon: "✨" },
  { value: "custom", label: "Custom", icon: "🎁" },
];

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
  const [startDate, setStartDate] = useState(
    params.startDate ? params.startDate.slice(0, 10) : "",
  );
  const [endDate, setEndDate] = useState(
    params.endDate ? params.endDate.slice(0, 10) : "",
  );
  const [venueTimezone, setVenueTimezone] = useState(params.venueTimezone ?? "UTC");
  const [submitting, setSubmitting] = useState(false);

  const currentStatus = (params.status ?? "draft") as RewardStatus;
  const canSubmit = title.trim().length > 0 && prizeDescription.trim().length > 0 &&
    startDate.trim().length > 0 && endDate.trim().length > 0;

  const handleSave = async (newStatus?: RewardStatus) => {
    if (!authedUid || !canSubmit || submitting || !rewardId) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      Alert.alert("Invalid dates", "Please enter valid start and end dates (YYYY-MM-DD).");
      return;
    }
    if (end <= start) {
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
        startDate: start.toISOString(),
        endDate: end.toISOString(),
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
      style={[styles.root, { backgroundColor: "#0F0F12" }]}
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
          <Text style={styles.fieldLabel}>Reward Type</Text>
          <View style={styles.typeRow}>
            {REWARD_TYPES.map((rt) => (
              <Pressable
                key={rt.value}
                onPress={() => setRewardType(rt.value)}
                style={[
                  styles.typeBtn,
                  {
                    backgroundColor: rewardType === rt.value ? colors.primary + "20" : "#1A1A1E",
                    borderColor: rewardType === rt.value ? colors.primary : "rgba(255,255,255,0.1)",
                  },
                ]}
              >
                <Text style={styles.typeIcon}>{rt.icon}</Text>
                <Text style={[styles.typeLabel, { color: rewardType === rt.value ? colors.primary : "rgba(255,255,255,0.5)" }]}>
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

        {/* Date range */}
        <View>
          <Text style={styles.fieldLabel}>Start Date *</Text>
          <Text style={styles.fieldHint}>Format: YYYY-MM-DD</Text>
          <TextInput
            value={startDate} onChangeText={setStartDate} placeholder="2026-09-01"
            placeholderTextColor="rgba(255,255,255,0.25)" autoCapitalize="none"
            style={[styles.fieldInput, { borderColor: colors.primary + "40" }]}
          />
        </View>

        <View>
          <Text style={styles.fieldLabel}>End Date *</Text>
          <TextInput
            value={endDate} onChangeText={setEndDate} placeholder="2026-09-30"
            placeholderTextColor="rgba(255,255,255,0.25)" autoCapitalize="none"
            style={[styles.fieldInput, { borderColor: colors.primary + "40" }]}
          />
        </View>

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
            style={[styles.saveBtn, { flex: 1, backgroundColor: canSubmit && !submitting ? colors.primary : "#333" }]}
            onPress={() => void handleSave()}
            disabled={!canSubmit || submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
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
  colors: { primary: string };
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.25)" multiline={multiline}
        numberOfLines={numberOfLines} autoCapitalize={autoCapitalize}
        style={[styles.fieldInput, multiline && { height: (numberOfLines ?? 1) * 24 + 20, textAlignVertical: "top" }, { borderColor: colors.primary + "40" }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 24, gap: 18 },
  fieldLabel: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  fieldHint: { color: "rgba(255,255,255,0.3)", fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 6 },
  fieldInput: { backgroundColor: "#1A1A1E", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 15, fontFamily: "Inter_400Regular" },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: "center", gap: 3 },
  typeIcon: { fontSize: 20 },
  typeLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  btnRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  activateBtn: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center" },
  activateBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
