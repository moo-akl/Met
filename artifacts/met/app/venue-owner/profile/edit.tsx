/**
 * Venue Owner Profile Editor
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
import { useVenueOwner } from "@/hooks/useVenueOwner";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";

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

      // Merge stored hours into our day map (unknown days default to null/closed)
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
      const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
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

    // Validate time ranges for open days
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
      <View style={[styles.root, { backgroundColor: "#0F0F12" }]}>
        <VenueOwnerHeader title="Edit Profile" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: "#0F0F12" }]}
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
          <Text style={styles.sectionLabel}>Cover Photo</Text>
          <Pressable
            onPress={() => void pickAndUpload("cover")}
            disabled={uploadingCover}
            style={({ pressed }) => [
              styles.photoPicker,
              { borderColor: coverPhotoUrl ? colors.primary + "60" : "rgba(255,255,255,0.12)", opacity: pressed ? 0.75 : 1 },
            ]}
          >
            {uploadingCover ? (
              <ActivityIndicator color={colors.primary} />
            ) : coverPhotoUrl ? (
              <>
                <Image source={{ uri: coverPhotoUrl }} style={styles.coverPreview} resizeMode="cover" />
                <Text style={[styles.changeLabel, { color: colors.primary }]}>Tap to change</Text>
              </>
            ) : (
              <Text style={styles.pickerHint}>📷  Tap to upload a cover photo (16:9)</Text>
            )}
          </Pressable>
        </View>

        {/* Logo */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Logo / Icon</Text>
          <View style={styles.logoRow}>
            <Pressable
              onPress={() => void pickAndUpload("logo")}
              disabled={uploadingLogo}
              style={({ pressed }) => [
                styles.logoPicker,
                { borderColor: logoUrl ? colors.primary + "60" : "rgba(255,255,255,0.12)", opacity: pressed ? 0.75 : 1 },
              ]}
            >
              {uploadingLogo ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logoPreview} resizeMode="cover" />
              ) : (
                <Text style={styles.logoPlaceholder}>🏷️</Text>
              )}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.logoHint}>Square image works best.</Text>
              <Text style={styles.logoHintSub}>Shown on the map and in search results.</Text>
            </View>
          </View>
        </View>

        {/* Business Name */}
        <Field label="Business Name *" value={businessName} onChangeText={setBusinessName}
          placeholder="The Fox & Hound" colors={colors} />

        {/* Tagline */}
        <Field label="Tagline" value={tagline} onChangeText={setTagline}
          placeholder="Your neighbourhood craft cocktail bar" colors={colors} maxLength={120} />

        {/* Description */}
        <Field label="Description" value={description} onChangeText={setDescription}
          placeholder="Tell guests what makes your venue special..."
          multiline numberOfLines={5} maxLength={800} colors={colors} />

        {/* ── Contact & Hours ── */}
        <View style={styles.groupHeader}>
          <Text style={styles.groupHeaderText}>Contact & Hours</Text>
        </View>

        <Field label="Phone" value={phone} onChangeText={setPhone}
          placeholder="+1 555 123 4567" colors={colors} keyboardType="phone-pad" />

        <Field label="Public Email" value={publicEmail} onChangeText={setPublicEmail}
          placeholder="hello@myvenue.com" colors={colors} keyboardType="email-address"
          autoCapitalize="none" />

        <Field label="Website" value={websiteUrl} onChangeText={setWebsiteUrl}
          placeholder="https://myvenue.com" colors={colors} keyboardType="url"
          autoCapitalize="none" />

        {/* Opening Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Opening Hours</Text>
          <View style={[styles.hoursCard, { borderColor: "rgba(255,255,255,0.08)" }]}>
            {DAYS.map((day, idx) => {
              const hours = openingHours[day];
              const isOpen = hours !== null;
              return (
                <View
                  key={day}
                  style={[
                    styles.dayRow,
                    idx < DAYS.length - 1 && styles.dayRowBorder,
                    { borderBottomColor: "rgba(255,255,255,0.07)" },
                  ]}
                >
                  <View style={styles.dayLeft}>
                    <Text style={styles.dayName}>{dayLabel(day)}</Text>
                    <Switch
                      value={isOpen}
                      onValueChange={(v) => setDayOpen(day, v)}
                      trackColor={{ false: "#2A2A2F", true: colors.primary + "80" }}
                      thumbColor={isOpen ? colors.primary : "#666"}
                      ios_backgroundColor="#2A2A2F"
                    />
                  </View>

                  {isOpen && hours ? (
                    <View style={styles.timeRow}>
                      <TimeInput
                        value={hours.open}
                        onChangeText={(v) => setDayTime(day, "open", v)}
                        colors={colors}
                      />
                      <Text style={styles.timeSep}>–</Text>
                      <TimeInput
                        value={hours.close}
                        onChangeText={(v) => setDayTime(day, "close", v)}
                        colors={colors}
                      />
                    </View>
                  ) : (
                    <Text style={styles.closedLabel}>Closed</Text>
                  )}
                </View>
              );
            })}
          </View>
          <Text style={styles.hoursHint}>Use 24-hour format, e.g. 09:00 – 22:30</Text>
        </View>

        <Pressable
          style={[
            styles.saveBtn,
            { backgroundColor: !submitting ? colors.primary : "#333" },
          ]}
          onPress={() => void handleSave()}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, value, onChangeText, placeholder, multiline, numberOfLines, maxLength,
  colors, keyboardType, autoCapitalize,
}: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  multiline?: boolean; numberOfLines?: number; maxLength?: number;
  colors: { primary: string };
  keyboardType?: "default" | "phone-pad" | "email-address" | "url";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.25)"
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        style={[
          styles.fieldInput,
          multiline && { height: (numberOfLines ?? 1) * 24 + 24, textAlignVertical: "top" },
          { borderColor: colors.primary + "40" },
        ]}
      />
    </View>
  );
}

function TimeInput({
  value,
  onChangeText,
  colors,
}: {
  value: string;
  onChangeText: (v: string) => void;
  colors: { primary: string };
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder="HH:MM"
      placeholderTextColor="rgba(255,255,255,0.25)"
      keyboardType="numbers-and-punctuation"
      maxLength={5}
      style={[styles.timeInput, { borderColor: colors.primary + "40" }]}
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
    color: "rgba(255,255,255,0.55)",
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
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  coverPreview: { width: "100%", height: 160 },
  changeLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", paddingBottom: 8 },
  pickerHint: { color: "rgba(255,255,255,0.4)", fontSize: 14, fontFamily: "Inter_400Regular" },
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
    backgroundColor: "rgba(255,255,255,0.03)",
    flexShrink: 0,
  },
  logoPreview: { width: 72, height: 72 },
  logoPlaceholder: { fontSize: 28 },
  logoHint: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontFamily: "Inter_500Medium" },
  logoHintSub: { color: "rgba(255,255,255,0.35)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  fieldInput: {
    backgroundColor: "#1A1A1E",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  groupHeader: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    paddingBottom: 8,
    marginBottom: -4,
  },
  groupHeaderText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  hoursCard: {
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: "#1A1A1E",
    overflow: "hidden",
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  dayRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 140,
  },
  dayName: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    width: 82,
  },
  closedLabel: {
    color: "rgba(255,255,255,0.28)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeSep: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
  timeInput: {
    backgroundColor: "#242428",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    width: 62,
    textAlign: "center",
  },
  hoursHint: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
