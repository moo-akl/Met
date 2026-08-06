/**
 * Edit Venue Event screen.
 *
 * Receives event fields via router params (from the events list screen),
 * pre-fills the form, and updates via PUT /api/venue-owner/me/events/:id.
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { api, ApiError } from "@/lib/api/client";
import { useColors } from "@/hooks/useColors";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";
import { DateTimePicker } from "@/components/DateTimePicker";

function defaultStartsAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  return d;
}

export default function EditVenueEventScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    title?: string;
    description?: string;
    imageUrl?: string;
    startsAt?: string;
    endsAt?: string;
    capacityLimit?: string;
    isPublished?: string;
  }>();

  const eventId = Number(params.id);

  const [title, setTitle] = useState(params.title ?? "");
  const [description, setDescription] = useState(params.description ?? "");
  const [imageUrl, setImageUrl] = useState(params.imageUrl ?? "");
  const [startsAt, setStartsAt] = useState<Date>(() =>
    params.startsAt ? new Date(params.startsAt) : defaultStartsAt(),
  );
  const [endsAt, setEndsAt] = useState<Date | null>(() =>
    params.endsAt ? new Date(params.endsAt) : null,
  );
  const [capacityLimit, setCapacityLimit] = useState(
    params.capacityLimit && params.capacityLimit !== "null" ? params.capacityLimit : "",
  );
  const [isPublished, setIsPublished] = useState(params.isPublished === "true");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0;

  const handleSave = async () => {
    if (!authedUid || !canSubmit || submitting || !eventId) return;

    setSubmitting(true);
    try {
      await api.updateVenueEvent({ uid: authedUid }, eventId, {
        title: title.trim(),
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt ? endsAt.toISOString() : null,
        capacityLimit: capacityLimit.trim() ? Number(capacityLimit) : null,
        isPublished,
      });
      Alert.alert("Event updated!", undefined, [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Failed to update event");
    } finally {
      setSubmitting(false);
    }
  };

  // Default end time = startsAt + 3 h (used as picker seed when endsAt is null)
  const endsAtValue = endsAt ?? new Date(startsAt.getTime() + 3 * 60 * 60 * 1000);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: "#0F0F12" }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <VenueOwnerHeader title="Edit Event" onBack={() => router.back()} backLabel="Cancel" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Title *" value={title} onChangeText={setTitle} placeholder="Open Mic Night" colors={colors} />
        <Field label="Description" value={description} onChangeText={setDescription}
          placeholder="What's happening at the event?" multiline numberOfLines={4} colors={colors} />
        <Field label="Image URL (optional)" value={imageUrl} onChangeText={setImageUrl}
          placeholder="https://..." autoCapitalize="none" colors={colors} />

        <DateTimePicker
          label="Start Date & Time"
          mode="datetime"
          value={startsAt}
          onChange={setStartsAt}
          primaryColor={colors.primary}
        />

        <View>
          <View style={styles.optionalRow}>
            <Text style={styles.fieldLabel}>End Date & Time</Text>
            <Text style={styles.optionalBadge}>optional</Text>
            {endsAt !== null && (
              <Pressable onPress={() => setEndsAt(null)} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>Clear</Text>
              </Pressable>
            )}
          </View>
          <DateTimePicker
            label=""
            mode="datetime"
            value={endsAtValue}
            onChange={setEndsAt}
            primaryColor={colors.primary}
            optional
          />
        </View>

        <Field label="Capacity Limit (optional)" value={capacityLimit} onChangeText={setCapacityLimit}
          placeholder="100" colors={colors} />

        {/* Publish toggle */}
        <View style={[styles.toggleRow, { backgroundColor: "#1A1A1E", borderColor: colors.primary + "30" }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Published</Text>
            <Text style={styles.toggleSub}>Guests can see and RSVP to this event</Text>
          </View>
          <Switch
            value={isPublished}
            onValueChange={setIsPublished}
            trackColor={{ false: "#333", true: colors.primary + "80" }}
            thumbColor={isPublished ? colors.primary : "#888"}
          />
        </View>

        <Pressable
          style={[styles.saveBtn, { backgroundColor: canSubmit && !submitting ? colors.primary : "#333" }]}
          onPress={() => void handleSave()}
          disabled={!canSubmit || submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </Pressable>
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
  fieldInput: { backgroundColor: "#1A1A1E", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 15, fontFamily: "Inter_400Regular" },
  optionalRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  optionalBadge: { color: "rgba(255,255,255,0.3)", fontSize: 11, fontFamily: "Inter_400Regular" },
  clearBtn: { marginLeft: "auto" },
  clearBtnText: { color: "rgba(255,80,80,0.8)", fontSize: 12, fontFamily: "Inter_500Medium" },
  toggleRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, padding: 14 },
  toggleLabel: { color: "rgba(255,255,255,0.85)", fontSize: 15, fontFamily: "Inter_500Medium" },
  toggleSub: { color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
