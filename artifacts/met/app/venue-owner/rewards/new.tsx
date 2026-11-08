/**
 * New Venue Reward screen
 *
 * Aurora (dark):  deep #0A0518 bg, translucent glass inputs, white typography.
 * Signal (light): #FAFAF8 editorial bg, clean inputs, #0D0D0D typography.
 */
import React, { useState } from "react";
import { Feather } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
import { useTheme } from "@/contexts/ThemeContext";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";
import { DateTimePicker } from "@/components/DateTimePicker";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

type RewardType = "free_drink" | "discount" | "experience" | "custom";

const REWARD_TYPES: Array<{
  value: RewardType;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}> = [
  { value: "free_drink", label: "Free Drink", icon: "coffee" },
  { value: "discount", label: "Discount", icon: "percent" },
  { value: "experience", label: "Experience", icon: "star" },
  { value: "custom", label: "Custom", icon: "gift" },
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
  const { isDark } = useTheme();
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

  const vBg = colors.background;
  const vInput = colors.card;
  const vTypeCard = colors.card;
  const vTypeBorder = colors.border;
  const vText = colors.text;
  const vMuted = colors.mutedForeground;
  const vLabel = colors.mutedForeground;
  const vPlaceholder = colors.mutedForeground;
  const vDisabledBtn = colors.muted;
  const vToggleBg = colors.card;
  const vToggleBorder = colors.border;
  const accent = colors.primary;

  const canSubmit = title.trim().length > 0 && prizeDescription.trim().length > 0;

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
    <View style={[styles.root, { backgroundColor: vBg }]}>
      <VenueOwnerHeader title="New Reward" onBack={() => router.back()} backLabel="Cancel" />

      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        {/* Reward type selector */}
        <View>
          <Text style={[styles.fieldLabel, { color: vLabel }]}>Reward Type</Text>
          <View style={styles.typeRow}>
            {REWARD_TYPES.map((rt) => (
              <Pressable
                key={rt.value}
                onPress={() => setRewardType(rt.value)}
                style={[
                  styles.typeBtn,
                  {
                    backgroundColor: rewardType === rt.value ? colors.primarySoft : vTypeCard,
                    borderColor: rewardType === rt.value ? accent : vTypeBorder,
                  },
                ]}
              >
                <Feather
                  name={rt.icon}
                  size={20}
                  color={rewardType === rt.value ? accent : vMuted}
                  style={styles.typeIcon}
                />
                <Text style={[styles.typeLabel, { color: rewardType === rt.value ? accent : vMuted }]}>
                  {rt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Field label="Title *" value={title} onChangeText={setTitle} placeholder="August Check-in Champion"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />
        <Field label="Prize Description *" value={prizeDescription} onChangeText={setPrizeDescription}
          placeholder="Free cocktail of your choice"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />
        <Field label="Campaign Details" value={description} onChangeText={setDescription}
          placeholder="More info about the campaign..." multiline numberOfLines={3}
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />

        <DateTimePicker
          label="Start Date"
          mode="date"
          value={startDate}
          onChange={setStartDate}
          primaryColor={accent}
          labelColor={vLabel}
          rowBg={vInput}
          valueColor={vText}
          chevronColor={vMuted}
          isDark={isDark}
        />

        <DateTimePicker
          label="End Date"
          mode="date"
          value={endDate}
          onChange={setEndDate}
          primaryColor={accent}
          labelColor={vLabel}
          rowBg={vInput}
          valueColor={vText}
          chevronColor={vMuted}
          isDark={isDark}
        />

        <Field label="Venue Timezone (e.g. America/New_York)" value={venueTimezone} onChangeText={setVenueTimezone}
          placeholder="UTC" autoCapitalize="none"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />

        {/* Activate now toggle */}
        <Pressable
          onPress={() => setActivateNow(!activateNow)}
          style={[
            styles.activateToggle,
            { borderColor: activateNow ? accent : vToggleBorder, backgroundColor: activateNow ? accent + "10" : vToggleBg },
          ]}
        >
          <View style={[
            styles.activateCheck,
            { backgroundColor: activateNow ? accent : "transparent", borderColor: activateNow ? accent : vMuted },
          ]}>
            {activateNow && <Feather name="check" size={13} color={colors.primaryForeground} />}
          </View>
          <Text style={[styles.activateLabel, { color: activateNow ? (isDark ? "#fff" : "#0D0D0D") : vMuted }]}>
            Activate immediately
          </Text>
        </Pressable>

        <Pressable
          style={[styles.submitBtn, { backgroundColor: canSubmit && !submitting ? accent : vDisabledBtn }]}
          onPress={handleCreate}
          disabled={!canSubmit || submitting}
        >
          {submitting
            ? <ActivityIndicator color={canSubmit ? colors.primaryForeground : colors.mutedForeground} />
            : <Text style={[styles.submitBtnText, { color: canSubmit ? colors.primaryForeground : colors.mutedForeground }]}>
                {activateNow ? "Create & Activate" : "Save as Draft"}
              </Text>}
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function Field({
  label, value, onChangeText, placeholder, multiline, numberOfLines, autoCapitalize = "sentences",
  vInput, vText, vLabel, vPlaceholder, accent,
}: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  multiline?: boolean; numberOfLines?: number; autoCapitalize?: "none" | "sentences";
  vInput: string; vText: string; vLabel: string; vPlaceholder: string; accent: string;
}) {
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: vLabel }]}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={vPlaceholder} multiline={multiline}
        numberOfLines={numberOfLines} autoCapitalize={autoCapitalize}
        style={[
          styles.fieldInput,
          multiline && { height: (numberOfLines ?? 1) * 24 + 20, textAlignVertical: "top" },
          { backgroundColor: vInput, borderColor: accent + "40", color: vText },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 20 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  fieldInput: { minHeight: 50, borderWidth: 1, borderTopLeftRadius: 22, borderBottomRightRadius: 16, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 0 },
  typeBtn: { flex: 1, minHeight: 64, borderWidth: 1.5, borderTopLeftRadius: 24, borderBottomRightRadius: 18, paddingVertical: 12, alignItems: "center", gap: 3 },
  typeIcon: { fontSize: 20 },
  typeLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  activateToggle: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderTopLeftRadius: 26, borderBottomRightRadius: 18, padding: 16 },
  activateCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  activateCheckMark: { fontSize: 13, fontFamily: "Inter_700Bold" },
  activateLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  submitBtn: { minHeight: 50, borderTopLeftRadius: 26, borderBottomRightRadius: 18, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  submitBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
