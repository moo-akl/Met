/**
 * Venue Owner Profile Editor
 *
 * Aurora (dark):  deep #0A0518 bg, translucent glass inputs, white typography.
 * Signal (light): #FAFAF8 editorial bg, clean inputs, #0D0D0D typography.
 *
 * Allows venue owners to update their business name, tagline, description,
 * cover photo, logo, contact details, and opening hours.
 */
import React, { useCallback, useEffect, useState } from "react";
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
import { useTheme } from "@/contexts/ThemeContext";
import { useVenueOwner } from "@/hooks/useVenueOwner";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";

const GREEN = "#00E87A";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type Day = (typeof DAYS)[number];

type DayHours = { open: string; close: string } | null;

function dayLabel(d: Day): string {
  return d.charAt(0).toUpperCase() + d.slice(1);
}

/** Clamp a freeform time string to HH:MM, stripping non-digits. */
function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export default function VenueOwnerProfileEditScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile: application, isLoading: ownerLoading } = useVenueOwner();

  const [businessName, setBusinessName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [coverPhotoUrl, setCoverPhotoUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Contact fields
  const [phone, setPhone] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  // Opening hours keyed by day name; null value = closed
  const [openingHours, setOpeningHours] = useState<Record<Day, DayHours>>(
    () => Object.fromEntries(DAYS.map((d) => [d, null])) as Record<Day, DayHours>,
  );

  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // ── Venue theme tokens ──────────────────────────────────────────────────────
  const vBg           = isDark ? "#0A0518"                : "#FAFAF8";
  const vInput        = isDark ? "#1A1A1E"                : "rgba(0,0,0,0.04)";
  const vText         = isDark ? "#fff"                   : "#0D0D0D";
  const vMuted        = isDark ? "rgba(255,255,255,0.4)"  : "rgba(0,0,0,0.38)";
  const vLabel        = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)";
  const vPlaceholder  = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)";
  const vPickerBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
  const vPickerBg     = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
  const vGroupHeader  = isDark ? "rgba(255,255,255,0.85)" : "#0D0D0D";
  const vGroupBorder  = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const vDayName      = isDark ? "rgba(255,255,255,0.7)"  : "rgba(0,0,0,0.65)";
  const vClosedLabel  = isDark ? "rgba(255,255,255,0.3)"  : "rgba(0,0,0,0.3)";
  const vTimeSep      = isDark ? "rgba(255,255,255,0.4)"  : "rgba(0,0,0,0.4)";
  const vHoursCard    = isDark ? "rgba(255,255,255,0.06)" : "#fff";
  const vHoursCardBorder= isDark ? "rgba(255,255,255,0.08)": "rgba(0,0,0,0.08)";
  const vDisabledBtn  = isDark ? "#333"                   : "rgba(0,0,0,0.1)";
  const accent        = isDark ? colors.primary           : GREEN;

  // Pre-fill form from the owner profile once it loads
  useEffect(() => {
    if (!ownerLoading && application && !initialized) {
      setBusinessName(application.businessName ?? "");
      setTagline(application.tagline ?? "");
      setDescription(application.description ?? "");
      setCoverPhotoUrl(application.coverPhotoUrl ?? "");
      setLogoUrl(application.logoUrl ?? "");
      setPhone(application.phone ?? "");
      setPublicEmail(application.publicEmail ?? "");
      setWebsiteUrl(application.websiteUrl ?? "");

      if (application.openingHours) {
        const stored = application.openingHours as Record<string, { open: string; close: string } | null>;
        setOpeningHours(
          Object.fromEntries(
            DAYS.map((d) => [d, stored[d] ?? null]),
          ) as Record<Day, DayHours>,
        );
      }

      setInitialized(true);
    }
  }, [ownerLoading, application, initialized]);

  const setDayOpen = useCallback((day: Day, isOpen: boolean) => {
    setOpeningHours((prev) => ({
      ...prev,
      [day]: isOpen ? { open: "09:00", close: "17:00" } : null,
    }));
  }, []);

  const setDayTime = useCallback((day: Day, field: "open" | "close", value: string) => {
    setOpeningHours((prev) => {
      const existing = prev[day];
      if (!existing) return prev;
      return { ...prev, [day]: { ...existing, [field]: formatTimeInput(value) } };
    });
  }, []);

  const pickAndUpload = useCallback(
    async (photoType: "cover" | "logo") => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow photo library access to upload images.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        base64: true,
        allowsEditing: true,
        aspect: photoType === "logo" ? [1, 1] : [16, 9],
      });
      if (result.canceled || !result.assets[0]?.base64) return;

      const asset = result.assets[0];
      const MAX_BYTES = 5 * 1024 * 1024;
      const byteSize = asset.fileSize ?? Math.floor(asset.base64!.length * 3 / 4);
      if (byteSize > MAX_BYTES) {
        Alert.alert("Image too large", "Please choose an image under 5 MB.");
        return;
      }
      if (photoType === "cover") setUploadingCover(true);
      else setUploadingLogo(true);

      try {
        const { url } = await api.uploadVenueProfilePhoto(
          { uid: authedUid ?? "" },
          { base64: asset.base64!, contentType: asset.mimeType ?? "image/jpeg", photoType },
        );
        if (photoType === "cover") setCoverPhotoUrl(url);
        else setLogoUrl(url);
      } catch {
        Alert.alert("Upload failed", "Could not upload the photo. Please try again.");
      } finally {
        if (photoType === "cover") setUploadingCover(false);
        else setUploadingLogo(false);
      }
    },
    [authedUid],
  );

  const handleSave = async () => {
    if (!authedUid || submitting) return;
    if (!businessName.trim()) {
      Alert.alert("Business name required");
      return;
    }

    for (const day of DAYS) {
      const hours = openingHours[day];
      if (!hours) continue;
      const timeRe = /^\d{2}:\d{2}$/;
      if (!timeRe.test(hours.open) || !timeRe.test(hours.close)) {
        Alert.alert("Invalid hours", `Check the opening hours for ${dayLabel(day)}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await api.updateMyVenueOwnerProfile({ uid: authedUid }, {
        businessName: businessName.trim(),
        tagline: tagline.trim() || null,
        description: description.trim() || null,
        coverPhotoUrl: coverPhotoUrl.trim() || null,
        logoUrl: logoUrl.trim() || null,
        phone: phone.trim() || null,
        publicEmail: publicEmail.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        openingHours: Object.fromEntries(
          DAYS.map((d) => [d, openingHours[d]]),
        ),
      });
      Alert.alert("Profile updated!", undefined, [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Failed to save profile");
    } finally {
      setSubmitting(false);
    }
  };

  if (ownerLoading || !initialized) {
    return (
      <View style={[styles.root, { backgroundColor: vBg }]}>
        <VenueOwnerHeader title="Edit Profile" />
        <View style={styles.center}>
          <ActivityIndicator color={accent} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: vBg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <VenueOwnerHeader title="Edit Profile" onBack={() => router.back()} backLabel="Cancel" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cover Photo */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: vLabel }]}>Cover Photo</Text>
          <Pressable
            onPress={() => void pickAndUpload("cover")}
            disabled={uploadingCover}
            style={({ pressed }) => [
              styles.photoPicker,
              {
                borderColor: coverPhotoUrl ? accent + "60" : vPickerBorder,
                backgroundColor: vPickerBg,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            {uploadingCover ? (
              <ActivityIndicator color={accent} />
            ) : coverPhotoUrl ? (
              <>
                <Image source={{ uri: coverPhotoUrl }} style={styles.coverPreview} resizeMode="cover" />
                <Text style={[styles.changeLabel, { color: accent }]}>Tap to change</Text>
              </>
            ) : (
              <Text style={[styles.pickerHint, { color: vMuted }]}>📷  Tap to upload a cover photo (16:9)</Text>
            )}
          </Pressable>
        </View>

        {/* Logo */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: vLabel }]}>Logo / Icon</Text>
          <View style={styles.logoRow}>
            <Pressable
              onPress={() => void pickAndUpload("logo")}
              disabled={uploadingLogo}
              style={({ pressed }) => [
                styles.logoPicker,
                {
                  borderColor: logoUrl ? accent + "60" : vPickerBorder,
                  backgroundColor: vPickerBg,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              {uploadingLogo ? (
                <ActivityIndicator color={accent} size="small" />
              ) : logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logoPreview} resizeMode="cover" />
              ) : (
                <Text style={styles.logoPlaceholder}>🏷️</Text>
              )}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.logoHint, { color: isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.65)" }]}>Square image works best.</Text>
              <Text style={[styles.logoHintSub, { color: vMuted }]}>Shown on the map and in search results.</Text>
            </View>
          </View>
        </View>

        {/* Business Name */}
        <Field label="Business Name *" value={businessName} onChangeText={setBusinessName}
          placeholder="The Fox & Hound"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />

        {/* Tagline */}
        <Field label="Tagline" value={tagline} onChangeText={setTagline}
          placeholder="Your neighbourhood craft cocktail bar" maxLength={120}
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />

        {/* Description */}
        <Field label="Description" value={description} onChangeText={setDescription}
          placeholder="Tell guests what makes your venue special..."
          multiline numberOfLines={5} maxLength={800}
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />

        {/* ── Contact & Hours ── */}
        <View style={[styles.groupHeader, { borderBottomColor: vGroupBorder }]}>
          <Text style={[styles.groupHeaderText, { color: vGroupHeader }]}>Contact & Hours</Text>
        </View>

        <Field label="Phone" value={phone} onChangeText={setPhone}
          placeholder="+1 555 123 4567" keyboardType="phone-pad"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />

        <Field label="Public Email" value={publicEmail} onChangeText={setPublicEmail}
          placeholder="hello@myvenue.com" keyboardType="email-address" autoCapitalize="none"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />

        <Field label="Website" value={websiteUrl} onChangeText={setWebsiteUrl}
          placeholder="https://myvenue.com" keyboardType="url" autoCapitalize="none"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />

        {/* Opening Hours */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: vLabel }]}>Opening Hours</Text>
          <View style={[styles.hoursCard, { borderColor: vHoursCardBorder, backgroundColor: vHoursCard }]}>
            {DAYS.map((day, idx) => {
              const hours = openingHours[day];
              const isOpen = hours !== null;
              return (
                <View
                  key={day}
                  style={[
                    styles.dayRow,
                    idx < DAYS.length - 1 && styles.dayRowBorder,
                    { borderBottomColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)" },
                  ]}
                >
                  <View style={styles.dayLeft}>
                    <Text style={[styles.dayName, { color: vDayName }]}>{dayLabel(day)}</Text>
                    <Switch
                      value={isOpen}
                      onValueChange={(v) => setDayOpen(day, v)}
                      trackColor={{ false: isDark ? "#2A2A2F" : "rgba(0,0,0,0.1)", true: accent + "80" }}
                      thumbColor={isOpen ? accent : isDark ? "#666" : "#bbb"}
                      ios_backgroundColor={isDark ? "#2A2A2F" : "rgba(0,0,0,0.1)"}
                    />
                  </View>

                  {isOpen && hours ? (
                    <View style={styles.timeRow}>
                      <TimeInput
                        value={hours.open}
                        onChangeText={(v) => setDayTime(day, "open", v)}
                        vInput={vInput}
                        vText={vText}
                        vPlaceholder={vPlaceholder}
                        accent={accent}
                      />
                      <Text style={[styles.timeSep, { color: vTimeSep }]}>–</Text>
                      <TimeInput
                        value={hours.close}
                        onChangeText={(v) => setDayTime(day, "close", v)}
                        vInput={vInput}
                        vText={vText}
                        vPlaceholder={vPlaceholder}
                        accent={accent}
                      />
                    </View>
                  ) : (
                    <Text style={[styles.closedLabel, { color: vClosedLabel }]}>Closed</Text>
                  )}
                </View>
              );
            })}
          </View>
          <Text style={[styles.hoursHint, { color: vMuted }]}>Use 24-hour format, e.g. 09:00 – 22:30</Text>
        </View>

        <Pressable
          style={[
            styles.saveBtn,
            { backgroundColor: !submitting ? accent : vDisabledBtn },
          ]}
          onPress={() => void handleSave()}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={isDark ? "#fff" : "#0D0D0D"} />
          ) : (
            <Text style={[styles.saveBtnText, { color: isDark ? "#fff" : "#0D0D0D" }]}>Save Changes</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, value, onChangeText, placeholder, multiline, numberOfLines, maxLength,
  keyboardType, autoCapitalize,
  vInput, vText, vLabel, vPlaceholder, accent,
}: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  multiline?: boolean; numberOfLines?: number; maxLength?: number;
  keyboardType?: "default" | "phone-pad" | "email-address" | "url";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  vInput: string; vText: string; vLabel: string; vPlaceholder: string; accent: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: vLabel }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={vPlaceholder}
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        style={[
          styles.fieldInput,
          multiline && { height: (numberOfLines ?? 1) * 24 + 24, textAlignVertical: "top" },
          { backgroundColor: vInput, borderColor: accent + "40", color: vText },
        ]}
      />
    </View>
  );
}

function TimeInput({
  value, onChangeText,
  vInput, vText, vPlaceholder, accent,
}: {
  value: string;
  onChangeText: (v: string) => void;
  vInput: string; vText: string; vPlaceholder: string; accent: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder="HH:MM"
      placeholderTextColor={vPlaceholder}
      keyboardType="numbers-and-punctuation"
      maxLength={5}
      style={[styles.timeInput, { backgroundColor: vInput, borderColor: accent + "40", color: vText }]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 20 },
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  photoPicker: {
    borderWidth: 1.5,
    borderRadius: 12,
    borderStyle: "dashed",
    overflow: "hidden",
    minHeight: 130,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  coverPreview: { width: "100%", height: 160 },
  changeLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", paddingBottom: 8 },
  pickerHint: { fontSize: 14, fontFamily: "Inter_400Regular" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  logoPicker: {
    width: 72,
    height: 72,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  logoPreview: { width: 72, height: 72 },
  logoPlaceholder: { fontSize: 28 },
  logoHint: { fontSize: 13, fontFamily: "Inter_500Medium" },
  logoHintSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  groupHeader: {
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: -4,
  },
  groupHeaderText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  hoursCard: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  dayRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  dayRowBorder: { borderBottomWidth: 1 },
  dayLeft: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeSep: { fontSize: 14, fontFamily: "Inter_400Regular" },
  timeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  closedLabel: { fontSize: 13, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  hoursHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
