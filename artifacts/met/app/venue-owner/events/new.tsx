/**
 * New Venue Event screen
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
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

export default function NewVenueEventScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [startsAt, setStartsAt] = useState<Date>(defaultStartsAt);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [capacityLimit, setCapacityLimit] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // endsAt defaults to 3 h after startsAt the first time it's expanded
  function handleEndsAtChange(date: Date) {
    setEndsAt(date);
  }

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Please allow photo access in Settings to add a cover image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) { Alert.alert("Error", "Could not read image data."); return; }
    setImageUploading(true);
    try {
      const { url } = await api.uploadVenueEventImage(
        { uid: authedUid ?? "" },
        { base64: asset.base64, contentType: asset.mimeType ?? "image/jpeg" },
      );
      setImageUrl(url);
    } catch {
      Alert.alert("Upload failed", "Could not upload image. Please try again.");
    } finally {
      setImageUploading(false);
    }
  };

  const canSubmit = title.trim().length > 0;

  const handleCreate = async () => {
    if (!authedUid || !canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await api.createVenueEvent({ uid: authedUid }, {
        title: title.trim(),
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt ? endsAt.toISOString() : null,
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

  // Default end time = startsAt + 3 h
  const endsAtValue = endsAt ?? new Date(startsAt.getTime() + 3 * 60 * 60 * 1000);

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

        {/* ── Cover Image ────────────────────────────────────────────────── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Cover Image (optional)</Text>
          {imageUrl ? (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: imageUrl }} style={styles.imagePreview} resizeMode="cover" />
              <Pressable
                onPress={() => setImageUrl("")}
                style={styles.imageRemoveBtn}
                accessibilityLabel="Remove cover image"
              >
                <Text style={styles.imageRemoveText}>✕ Remove</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={pickImage}
              disabled={imageUploading}
              style={[styles.imagePickerBtn, { borderColor: colors.primary + "40" }]}
            >
              {imageUploading
                ? <ActivityIndicator color={colors.primary} />
                : <Text style={styles.imagePickerText}>＋ Add Cover Photo</Text>}
            </Pressable>
          )}
        </View>

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
            onChange={handleEndsAtChange}
            primaryColor={colors.primary}
            optional
          />
        </View>

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
  scroll: { flex: 1 },
  content: { padding: 24, gap: 18 },
  field: {},
  fieldLabel: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  fieldInput: { backgroundColor: "#1A1A1E", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 15 },
  imagePickerBtn: { backgroundColor: "#1A1A1E", borderWidth: 1, borderStyle: "dashed", borderRadius: 10, paddingVertical: 20, alignItems: "center", justifyContent: "center" },
  imagePickerText: { color: "rgba(255,255,255,0.45)", fontSize: 14, fontFamily: "Inter_500Medium" },
  imagePreviewWrap: { borderRadius: 10, overflow: "hidden", position: "relative" },
  imagePreview: { width: "100%", height: 160, borderRadius: 10 },
  imageRemoveBtn: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  imageRemoveText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  optionalRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  optionalBadge: { color: "rgba(255,255,255,0.3)", fontSize: 11, fontFamily: "Inter_400Regular" },
  clearBtn: { marginLeft: "auto" },
  clearBtnText: { color: "rgba(255,80,80,0.8)", fontSize: 12, fontFamily: "Inter_500Medium" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleLabel: { color: "rgba(255,255,255,0.7)", fontSize: 15, fontFamily: "Inter_500Medium" },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  submitBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
