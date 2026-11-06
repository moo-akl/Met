/**
 * Edit Venue Event screen.
 *
 * Aurora (dark):  deep #0A0518 bg, translucent glass inputs, white typography.
 * Signal (light): #FAFAF8 editorial bg, clean inputs, #0D0D0D typography.
 *
 * Receives event fields via router params (from the events list screen),
 * pre-fills the form, and updates via PUT /api/venue-owner/me/events/:id.
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { api, ApiError } from "@/lib/api/client";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";
import { DateTimePicker } from "@/components/DateTimePicker";
import { prepareVenueEventImage } from "@/lib/venueEventImage";

const GREEN = "#00E87A";

function defaultStartsAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  return d;
}

export default function EditVenueEventScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    title?: string;
    description?: string;
    imageUrl?: string;
    contactPhone?: string;
    websiteUrl?: string;
    publicEmail?: string;
    startsAt?: string;
    endsAt?: string;
    capacityLimit?: string;
    isPublished?: string;
    visibility?: string;
    invitePasscodeRequired?: string;
  }>();

  const eventId = Number(params.id);

  const [title, setTitle] = useState(params.title ?? "");
  const [description, setDescription] = useState(params.description ?? "");
  const [contactPhone, setContactPhone] = useState(params.contactPhone ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(params.websiteUrl ?? "");
  const [publicEmail, setPublicEmail] = useState(params.publicEmail ?? "");
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
  const [imageUploading, setImageUploading] = useState(false);
  const [isPublished, setIsPublished] = useState(params.isPublished === "true");
  const [visibility, setVisibility] = useState<"public" | "invite_only">(
    params.visibility === "invite_only" ? "invite_only" : "public",
  );
  const initiallyRequiresPasscode = params.invitePasscodeRequired === "true";
  const [requireInvitePasscode, setRequireInvitePasscode] = useState(initiallyRequiresPasscode);
  const [invitePasscode, setInvitePasscode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0 &&
    (visibility !== "invite_only" || !requireInvitePasscode ||
      invitePasscode.trim().length >= 6 || initiallyRequiresPasscode);

  // ── Venue theme tokens ──────────────────────────────────────────────────────
  const vBg          = isDark ? "#0A0518"                : "#FAFAF8";
  const vInput       = isDark ? "#1A1A1E"                : "rgba(0,0,0,0.04)";
  const vText        = isDark ? "#fff"                   : "#0D0D0D";
  const vMuted       = isDark ? "rgba(255,255,255,0.4)"  : "rgba(0,0,0,0.38)";
  const vLabel       = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)";
  const vPlaceholder = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)";
  const vToggleBg    = isDark ? "#1A1A1E"                : "rgba(0,0,0,0.04)";
  const vToggleBorder= isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const vToggleLabel = isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)";
  const vToggleSub   = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
  const vDisabledBtn = isDark ? "#333"                   : "rgba(0,0,0,0.1)";
  const accent       = isDark ? colors.primary           : GREEN;

  const pickImage = async () => {
    setImageUploading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const image = await prepareVenueEventImage(asset.uri, asset.width);
      const { url } = await api.uploadVenueEventImage(
        { uid: authedUid ?? "" },
        image,
      );
      setImageUrl(url);
    } catch (error) {
      Alert.alert(
        "Upload failed",
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Could not upload image. Please try again.",
      );
    } finally {
      setImageUploading(false);
    }
  };

  const handleSave = async () => {
    if (!authedUid || !canSubmit || submitting || !eventId) return;

    setSubmitting(true);
    try {
      await api.updateVenueEvent({ uid: authedUid }, eventId, {
        title: title.trim(),
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        contactPhone: contactPhone.trim() || null,
        websiteUrl: websiteUrl.trim()
          ? (/^https?:\/\//i.test(websiteUrl.trim()) ? websiteUrl.trim() : `https://${websiteUrl.trim()}`)
          : null,
        publicEmail: publicEmail.trim() || null,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt ? endsAt.toISOString() : null,
        capacityLimit: capacityLimit.trim() ? Number(capacityLimit) : null,
        isPublished,
        visibility,
        invitePasscode: visibility !== "invite_only"
          ? null
          : requireInvitePasscode
            ? invitePasscode.trim() || undefined
            : null,
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

  const endsAtValue = endsAt ?? new Date(startsAt.getTime() + 3 * 60 * 60 * 1000);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: vBg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <VenueOwnerHeader title="Edit Event" onBack={() => router.back()} backLabel="Cancel" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Title *" value={title} onChangeText={setTitle} placeholder="Open Mic Night"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />
        <Field label="Description" value={description} onChangeText={setDescription}
          placeholder="What's happening at the event?" multiline numberOfLines={4}
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />
        <Field label="Contact phone (optional)" value={contactPhone} onChangeText={setContactPhone}
          placeholder="+1 555 123 4567" keyboardType="phone-pad" autoCapitalize="none"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />
        <Field label="Website (optional)" value={websiteUrl} onChangeText={setWebsiteUrl}
          placeholder="https://example.com" keyboardType="url" autoCapitalize="none"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />
        <Field label="Contact email (optional)" value={publicEmail} onChangeText={setPublicEmail}
          placeholder="hello@example.com" keyboardType="email-address" autoCapitalize="none"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />

        {/* ── Cover Image ── */}
        <View>
          <Text style={[styles.fieldLabel, { color: vLabel }]}>Cover Image (optional)</Text>
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
              style={[styles.imagePickerBtn, { backgroundColor: vInput, borderColor: accent + "40" }]}
            >
              {imageUploading
                ? <ActivityIndicator color={accent} />
                : <Text style={[styles.imagePickerText, { color: vMuted }]}>＋ Add Cover Photo</Text>}
            </Pressable>
          )}
        </View>

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
            onChange={setEndsAt}
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
          placeholder="100"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />

        <View>
          <Text style={[styles.fieldLabel, { color: vLabel }]}>Who can see this event?</Text>
          <View style={styles.visibilityRow}>
            {(["public", "invite_only"] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected: visibility === option }}
                onPress={() => setVisibility(option)}
                style={[
                  styles.visibilityOption,
                  {
                    backgroundColor: visibility === option ? accent + "18" : vInput,
                    borderColor: visibility === option ? accent : accent + "35",
                  },
                ]}
              >
                <Text style={[styles.visibilityTitle, { color: vText }]}>
                  {option === "public" ? "Public" : "Invitation only"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {visibility === "invite_only" ? (
          <View>
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: vToggleLabel }]}>Protect link with a passcode</Text>
              <Switch
                value={requireInvitePasscode}
                onValueChange={setRequireInvitePasscode}
                trackColor={{ false: isDark ? "#333" : "rgba(0,0,0,0.12)", true: accent + "80" }}
                thumbColor={requireInvitePasscode ? accent : isDark ? "#888" : "#bbb"}
              />
            </View>
            {requireInvitePasscode ? (
              <>
                <Field
                  label="New passcode (leave blank to keep current)"
                  value={invitePasscode}
                  onChangeText={setInvitePasscode}
                  placeholder="6–64 characters"
                  autoCapitalize="none"
                  vInput={vInput}
                  vText={vText}
                  vLabel={vLabel}
                  vPlaceholder={vPlaceholder}
                  accent={accent}
                />
                <Text style={[styles.toggleSub, { color: vToggleSub }]}>
                  Send the passcode separately from the invitation link.
                </Text>
              </>
            ) : null}
          </View>
        ) : null}

        {/* Publish toggle */}
        <View style={[styles.toggleRow, { backgroundColor: vToggleBg, borderColor: vToggleBorder }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleLabel, { color: vToggleLabel }]}>Published</Text>
            <Text style={[styles.toggleSub, { color: vToggleSub }]}>Guests can see and RSVP to this event</Text>
          </View>
          <Switch
            value={isPublished}
            onValueChange={setIsPublished}
            trackColor={{ false: isDark ? "#333" : "rgba(0,0,0,0.12)", true: accent + "80" }}
            thumbColor={isPublished ? accent : isDark ? "#888" : "#bbb"}
          />
        </View>

        <Pressable
          style={[styles.saveBtn, { backgroundColor: canSubmit && !submitting ? accent : vDisabledBtn }]}
          onPress={() => void handleSave()}
          disabled={!canSubmit || submitting}
        >
          {submitting
            ? <ActivityIndicator color={isDark ? "#fff" : "#0D0D0D"} />
            : <Text style={[styles.saveBtnText, { color: isDark ? "#fff" : "#0D0D0D" }]}>Save Changes</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, value, onChangeText, placeholder, multiline, numberOfLines, autoCapitalize = "sentences", keyboardType = "default",
  vInput, vText, vLabel, vPlaceholder, accent,
}: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  multiline?: boolean; numberOfLines?: number; autoCapitalize?: "none" | "sentences";
  keyboardType?: "default" | "url" | "phone-pad" | "email-address";
  vInput: string; vText: string; vLabel: string; vPlaceholder: string; accent: string;
}) {
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: vLabel }]}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={vPlaceholder} multiline={multiline}
        numberOfLines={numberOfLines} autoCapitalize={autoCapitalize} keyboardType={keyboardType}
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
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  fieldInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
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
  toggleRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, padding: 14 },
  toggleLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  toggleSub: { fontSize: 12, marginTop: 2 },
  visibilityRow: { gap: 9 },
  visibilityOption: { borderWidth: 1, borderRadius: 12, padding: 12 },
  visibilityTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
