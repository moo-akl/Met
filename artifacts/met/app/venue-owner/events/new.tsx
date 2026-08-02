/**
 * New Venue Event screen
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
  Switch,
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

export default function NewVenueEventScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [capacityLimit, setCapacityLimit] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0 && startsAt.trim().length > 0;

  const handleCreate = async () => {
    if (!authedUid || !canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await api.createVenueEvent({ uid: authedUid }, {
        title: title.trim(),
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt.trim() ? new Date(endsAt).toISOString() : null,
        capacityLimit: capacityLimit.trim() ? parseInt(capacityLimit, 10) : null,
        isPublished,
      });
      Alert.alert("Event created!", undefined, [{ text: "Done", onPress: () => router.back() }]);
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Failed to create event");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: "#0F0F12" }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <VenueOwnerHeader title="New Event" onBack={() => router.back()} backLabel="Cancel" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Title *" value={title} onChangeText={setTitle} placeholder="Friday Night Quiz" colors={colors} />
        <Field label="Description" value={description} onChangeText={setDescription} placeholder="Details about the event..." multiline numberOfLines={3} colors={colors} />
        <Field label="Cover Image URL" value={imageUrl} onChangeText={setImageUrl} placeholder="https://..." autoCapitalize="none" keyboardType="url" colors={colors} />
        <Field label="Start Date/Time * (YYYY-MM-DD HH:MM)" value={startsAt} onChangeText={setStartsAt} placeholder="2026-08-15 19:00" colors={colors} />
        <Field label="End Date/Time (optional)" value={endsAt} onChangeText={setEndsAt} placeholder="2026-08-15 22:00" colors={colors} />
        <Field label="Capacity Limit (optional)" value={capacityLimit} onChangeText={setCapacityLimit} placeholder="50" keyboardType="number-pad" colors={colors} />

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Publish immediately</Text>
          <Switch
            value={isPublished}
            onValueChange={setIsPublished}
            trackColor={{ false: "#333", true: colors.primary + "80" }}
            thumbColor={isPublished ? colors.primary : "#888"}
          />
        </View>

        <Pressable
          style={[styles.submitBtn, { backgroundColor: canSubmit && !submitting ? colors.primary : "#333" }]}
          onPress={handleCreate}
          disabled={!canSubmit || submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Event</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, numberOfLines, keyboardType = "default", autoCapitalize = "sentences", colors }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  multiline?: boolean; numberOfLines?: number; keyboardType?: "default" | "url" | "number-pad";
  autoCapitalize?: "none" | "sentences"; colors: { primary: string };
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.25)" multiline={multiline}
        numberOfLines={numberOfLines} keyboardType={keyboardType} autoCapitalize={autoCapitalize}
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
  field: {},
  fieldLabel: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  fieldInput: { backgroundColor: "#1A1A1E", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 15 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleLabel: { color: "rgba(255,255,255,0.7)", fontSize: 15, fontFamily: "Inter_500Medium" },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  submitBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
