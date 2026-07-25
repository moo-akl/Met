/**
 * New Venue Reward screen
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
import { useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { api, ApiError } from "@/lib/api/client";
import { useColors } from "@/hooks/useColors";

type RewardType = "free_drink" | "discount" | "experience" | "custom";

const REWARD_TYPES: Array<{ value: RewardType; label: string; icon: string }> = [
  { value: "free_drink", label: "Free Drink", icon: "🍹" },
  { value: "discount", label: "Discount", icon: "💸" },
  { value: "experience", label: "Experience", icon: "✨" },
  { value: "custom", label: "Custom", icon: "🎁" },
];

export default function NewVenueRewardScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prizeDescription, setPrizeDescription] = useState("");
  const [rewardType, setRewardType] = useState<RewardType>("custom");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [venueTimezone, setVenueTimezone] = useState("UTC");
  const [activateNow, setActivateNow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    title.trim().length > 0 &&
    prizeDescription.trim().length > 0 &&
    startDate.trim().length > 0 &&
    endDate.trim().length > 0;

  const handleCreate = async () => {
    if (!authedUid || !canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await api.createVenueReward({ uid: authedUid }, {
        title: title.trim(),
        description: description.trim() || null,
        prizeDescription: prizeDescription.trim(),
        rewardType,
        status: activateNow ? "active" : "draft",
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        venueTimezone: venueTimezone.trim() || "UTC",
      });
      Alert.alert("Reward created!", undefined, [{ text: "Done", onPress: () => router.back() }]);
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Failed to create reward");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: "#0F0F12" }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backText}>← Cancel</Text>
        </Pressable>
        <Text style={styles.title}>New Reward</Text>
        <View style={{ width: 70 }} />
      </View>

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

        <Field label="Title *" value={title} onChangeText={setTitle} placeholder="August Check-in Champion" colors={colors} />
        <Field label="Prize Description *" value={prizeDescription} onChangeText={setPrizeDescription} placeholder="Free cocktail of your choice" colors={colors} />
        <Field label="Campaign Details" value={description} onChangeText={setDescription} placeholder="More info about the campaign..." multiline numberOfLines={3} colors={colors} />
        <Field label="Start Date * (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} placeholder="2026-08-01" colors={colors} />
        <Field label="End Date * (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} placeholder="2026-08-31" colors={colors} />
        <Field label="Venue Timezone (e.g. America/New_York)" value={venueTimezone} onChangeText={setVenueTimezone} placeholder="UTC" autoCapitalize="none" colors={colors} />

        {/* Activate now toggle */}
        <Pressable
          onPress={() => setActivateNow(!activateNow)}
          style={[styles.activateToggle, { borderColor: activateNow ? colors.primary : "rgba(255,255,255,0.1)" }]}
        >
          <View style={[styles.activateCheck, { backgroundColor: activateNow ? colors.primary : "transparent", borderColor: activateNow ? colors.primary : "rgba(255,255,255,0.3)" }]}>
            {activateNow && <Text style={styles.activateCheckMark}>✓</Text>}
          </View>
          <Text style={[styles.activateLabel, { color: activateNow ? "#fff" : "rgba(255,255,255,0.6)" }]}>
            Activate immediately
          </Text>
        </Pressable>

        <Pressable
          style={[styles.submitBtn, { backgroundColor: canSubmit && !submitting ? colors.primary : "#333" }]}
          onPress={handleCreate}
          disabled={!canSubmit || submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{activateNow ? "Create & Activate" : "Save as Draft"}</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, numberOfLines, autoCapitalize = "sentences", colors }: {
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  backText: { color: "rgba(255,255,255,0.55)", fontSize: 15 },
  title: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  content: { padding: 24, gap: 18 },
  fieldLabel: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  fieldInput: { backgroundColor: "#1A1A1E", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 15 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 0 },
  typeBtn: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: "center", gap: 3 },
  typeIcon: { fontSize: 20 },
  typeLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  activateToggle: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 10, padding: 14, backgroundColor: "#1A1A1E" },
  activateCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  activateCheckMark: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  activateLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  submitBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
