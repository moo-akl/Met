/**
 * New Venue Event screen
 *
 * Aurora (dark):  deep #0A0518 bg, translucent glass inputs, white typography.
 * Signal (light): #FAFAF8 editorial bg, clean inputs, #0D0D0D typography.
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
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { api, ApiError } from "@/lib/api/client";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";
import { DateTimePicker } from "@/components/DateTimePicker";
import { useGetVenueOwnerMeGuests } from "@workspace/api-client-react";

const GREEN = "#00E87A";

function defaultStartsAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  return d;
}

export default function NewVenueEventScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const { isDark } = useTheme();
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
  const [visibility, setVisibility] = useState<"public" | "invite_only">("public");
  const [inviteeUids, setInviteeUids] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const guestsQuery = useGetVenueOwnerMeGuests(
    { period: "all", limit: 100, offset: 0 },
    { query: { enabled: visibility === "invite_only", staleTime: 30_000 } },
  );

  // ── Venue theme tokens ──────────────────────────────────────────────────────
  const vBg          = isDark ? "#0A0518"                : "#FAFAF8";
  const vInput       = isDark ? "#1A1A1E"                : "rgba(0,0,0,0.04)";
  const vText        = isDark ? "#fff"                   : "#0D0D0D";
  const vMuted       = isDark ? "rgba(255,255,255,0.4)"  : "rgba(0,0,0,0.38)";
  const vLabel       = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)";
  const vPlaceholder = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)";
  const vToggleLabel = isDark ? "rgba(255,255,255,0.7)"  : "rgba(0,0,0,0.65)";
  const vDisabledBtn = isDark ? "#333"                   : "rgba(0,0,0,0.1)";
  const accent       = isDark ? colors.primary           : GREEN;

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
    const MAX_BYTES = 5 * 1024 * 1024;
    const byteSize = asset.fileSize ?? Math.floor(asset.base64.length * 3 / 4);
    if (byteSize > MAX_BYTES) {
      Alert.alert("Image too large", "Please choose an image under 5 MB.");
      return;
    }
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

  const canSubmit = title.trim().length > 0 &&
    (visibility === "public" || inviteeUids.length > 0);

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
        visibility,
        inviteeUids: visibility === "invite_only" ? inviteeUids : [],
      });
      Alert.alert("Event created!", undefined, [{ text: "Done", onPress: () => router.back() }]);
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Failed to create event");
    } finally {
      setSubmitting(false);
    }
  };

  const endsAtValue = endsAt ?? new Date(startsAt.getTime() + 3 * 60 * 60 * 1000);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: vBg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <VenueOwnerHeader title="New Event" onBack={() => router.back()} backLabel="Cancel" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Title *" value={title} onChangeText={setTitle} placeholder="Friday Night Quiz"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />
        <Field label="Description" value={description} onChangeText={setDescription}
          placeholder="Details about the event..." multiline numberOfLines={3}
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />

        {/* ── Cover Image ── */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: vLabel }]}>Cover Image (optional)</Text>
          {imageUrl ? (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: imageUrl }} style={styles.imagePreview} resizeMode="cover" />
              <Pressable onPress={() => setImageUrl("")} style={styles.imageRemoveBtn}>
                <Text style={styles.imageRemoveText}>✕ Remove</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={pickImage}
              disabled={imageUploading}
              style={[styles.imagePickerBtn, { backgroundColor: vInput, borderColor: accent + "40" }]}
            >
              {imageUploading
                ? <ActivityIndicator color={accent} />
                : <Text style={[styles.imagePickerText, { color: vMuted }]}>＋ Add Cover Photo</Text>}
            </Pressable>
          )}
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: vLabel }]}>Who can see this event?</Text>
          <View style={styles.visibilityRow}>
            {(["public", "invite_only"] as const).map((option) => {
              const selected = visibility === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setVisibility(option)}
                  style={[
                    styles.visibilityOption,
                    {
                      backgroundColor: selected ? accent + "18" : vInput,
                      borderColor: selected ? accent : accent + "35",
                    },
                  ]}
                >
                  <Text style={[styles.visibilityTitle, { color: vText }]}>
                    {option === "public" ? "Public" : "Invitation only"}
                  </Text>
                  <Text style={[styles.visibilityDescription, { color: vMuted }]}>
                    {option === "public" ? "Anyone can find this event." : "Only selected venue visitors can see it."}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {visibility === "invite_only" ? (
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: vLabel }]}>Invite visitors</Text>
            <Text style={[styles.visibilityDescription, { color: vMuted }]}>
              Choose people who have checked in at your venue.
            </Text>
            {guestsQuery.isLoading ? (
              <ActivityIndicator color={accent} style={styles.guestLoading} />
            ) : guestsQuery.isError ? (
              <Text style={[styles.visibilityDescription, { color: colors.destructive }]}>
                Could not load your visitor list. Try again.
              </Text>
            ) : (guestsQuery.data?.guests ?? []).length === 0 ? (
              <Text style={[styles.visibilityDescription, { color: vMuted }]}>
                No checked-in visitors are available to invite yet.
              </Text>
            ) : (guestsQuery.data?.guests ?? []).map((guest) => {
              const selected = inviteeUids.includes(guest.uid);
              return (
                <Pressable
                  key={guest.uid}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setInviteeUids((current) => selected
                    ? current.filter((uid) => uid !== guest.uid)
                    : [...current, guest.uid])}
                  style={[styles.guestRow, { borderBottomColor: accent + "25" }]}
                >
                  <Text style={[styles.guestName, { color: vText }]}>
                    {guest.displayName} · {guest.checkinCount}
                  </Text>
                  <Feather name={selected ? "check-square" : "square"} size={20} color={accent} />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <DateTimePicker
          label="Start Date & Time"
          mode="datetime"
          value={startsAt}
          onChange={setStartsAt}
          primaryColor={accent}
          labelColor={vLabel}
          rowBg={vInput}
          valueColor={vText}
          chevronColor={vMuted}
          isDark={isDark}
        />

        <View>
          <View style={styles.optionalRow}>
            <Text style={[styles.fieldLabel, { color: vLabel }]}>End Date & Time</Text>
            <Text style={[styles.optionalBadge, { color: vMuted }]}>optional</Text>
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
            primaryColor={accent}
            labelColor={vLabel}
            rowBg={vInput}
            valueColor={vText}
            chevronColor={vMuted}
            isDark={isDark}
            optional
          />
        </View>

        <Field label="Capacity Limit (optional)" value={capacityLimit} onChangeText={setCapacityLimit}
          placeholder="50" keyboardType="number-pad"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />

        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: vToggleLabel }]}>Publish immediately</Text>
          <Switch
            value={isPublished}
            onValueChange={setIsPublished}
            trackColor={{ false: isDark ? "#333" : "rgba(0,0,0,0.12)", true: accent + "80" }}
            thumbColor={isPublished ? accent : isDark ? "#888" : "#bbb"}
          />
        </View>

        <Pressable
          style={[styles.submitBtn, { backgroundColor: canSubmit && !submitting ? accent : vDisabledBtn }]}
          onPress={handleCreate}
          disabled={!canSubmit || submitting}
        >
          {submitting
            ? <ActivityIndicator color={isDark ? "#fff" : "#0D0D0D"} />
            : <Text style={[styles.submitBtnText, { color: isDark ? "#fff" : "#0D0D0D" }]}>Create Event</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, value, onChangeText, placeholder, multiline, numberOfLines,
  keyboardType = "default", autoCapitalize = "sentences",
  vInput, vText, vLabel, vPlaceholder, accent,
}: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  multiline?: boolean; numberOfLines?: number;
  keyboardType?: "default" | "url" | "number-pad";
  autoCapitalize?: "none" | "sentences";
  vInput: string; vText: string; vLabel: string; vPlaceholder: string; accent: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: vLabel }]}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={vPlaceholder} multiline={multiline}
        numberOfLines={numberOfLines} keyboardType={keyboardType} autoCapitalize={autoCapitalize}
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
  content: { padding: 24, gap: 18 },
  field: {},
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  fieldInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  imagePickerBtn: { borderWidth: 1, borderStyle: "dashed", borderRadius: 10, paddingVertical: 20, alignItems: "center", justifyContent: "center" },
  imagePickerText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  imagePreviewWrap: { borderRadius: 10, overflow: "hidden", position: "relative" },
  imagePreview: { width: "100%", height: 160, borderRadius: 10 },
  imageRemoveBtn: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  imageRemoveText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  optionalRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  optionalBadge: { fontSize: 11, fontFamily: "Inter_400Regular" },
  clearBtn: { marginLeft: "auto" },
  clearBtnText: { color: "rgba(255,80,80,0.8)", fontSize: 12, fontFamily: "Inter_500Medium" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  visibilityRow: { gap: 9 },
  visibilityOption: { borderWidth: 1, borderRadius: 12, padding: 12 },
  visibilityTitle: { fontSize: 14, fontWeight: "700" },
  visibilityDescription: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  guestLoading: { paddingVertical: 16 },
  guestRow: { minHeight: 46, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  guestName: { fontSize: 13, fontWeight: "500" },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  submitBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
