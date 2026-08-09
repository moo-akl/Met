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
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";
import { DateTimePicker } from "@/components/DateTimePicker";

type RewardType = "free_drink" | "discount" | "experience" | "custom";

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

export default function NewVenueRewardScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prizeDescription, setPrizeDescription] = useState("");
  const [rewardType, setRewardType] = useState<RewardType>("custom");
  const [startDate, setStartDate] = useState<Date>(startOfToday);
  const [endDate, setEndDate] = useState<Date>(thirtyDaysFromNow);
  const [venueTimezone, setVenueTimezone] = useState("UTC");
  const [activateNow, setActivateNow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    title.trim().length > 0 &&
    prizeDescription.trim().length > 0;

  const handleCreate = async () => {
    if (!authedUid || !canSubmit || submitting) return;

    if (endDate <= startDate) {
      Alert.alert("Invalid dates", "End date must be after start date.");
      return;
    }

    setSubmitting(true);
    try {
      await api.createVenueReward({ uid: authedUid }, {
        title: title.trim(),
        description: description.trim() || null,
        prizeDescription: prizeDescription.trim(),
        rewardType,
        status: activateNow ? "active" : "draft",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
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
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <VenueOwnerHeader title="New Reward" onBack={() => router.back()} backLabel="Cancel" />

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

        <Field label="Title *" value={title} onChangeText={setTitle} placeholder="August Check-in Champion" colors={colors} />
        <Field label="Prize Description *" value={prizeDescription} onChangeText={setPrizeDescription} placeholder="Free cocktail of your choice" colors={colors} />
        <Field label="Campaign Details" value={description} onChangeText={setDescription} placeholder="More info about the campaign..." multiline numberOfLines={3} colors={colors} />

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

        <Field label="Venue Timezone (e.g. America/New_York)" value={venueTimezone} onChangeText={setVenueTimezone} placeholder="UTC" autoCapitalize="none" colors={colors} />

        {/* Activate now toggle */}
        <Pressable
          onPress={() => setActivateNow(!activateNow)}
          style={[
            styles.activateToggle,
            { borderColor: activateNow ? colors.primary : colors.border, backgroundColor: colors.card },
          ]}
        >
          <View style={[
            styles.activateCheck,
            { backgroundColor: activateNow ? colors.primary : "transparent", borderColor: activateNow ? colors.primary : colors.mutedForeground },
          ]}>
            {activateNow && <Text style={[styles.activateCheckMark, { color: colors.primaryForeground }]}>✓</Text>}
          </View>
          <Text style={[styles.activateLabel, { color: activateNow ? colors.foreground : colors.mutedForeground }]}>
            Activate immediately
          </Text>
        </Pressable>

        <Pressable
          style={[styles.submitBtn, { backgroundColor: canSubmit && !submitting ? colors.primary : colors.secondary }]}
          onPress={handleCreate}
          disabled={!canSubmit || submitting}
        >
          {submitting ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>{activateNow ? "Create & Activate" : "Save as Draft"}</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, numberOfLines, autoCapitalize = "sentences", colors }: {
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
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  fieldInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 0 },
  typeBtn: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: "center", gap: 3 },
  typeIcon: { fontSize: 20 },
  typeLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  activateToggle: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 10, padding: 14 },
  activateCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  activateCheckMark: { fontSize: 13, fontFamily: "Inter_700Bold" },
  activateLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  submitBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
