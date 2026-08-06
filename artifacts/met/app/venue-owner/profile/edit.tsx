/**
 * Venue Owner Profile Editor
 *
 * Allows venue owners to update their business name, tagline, description,
 * cover photo, and logo.
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
      setInitialized(true);
    }
  }, [ownerLoading, application, initialized]);

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
    setSubmitting(true);
    try {
      await api.updateMyVenueOwnerProfile({ uid: authedUid }, {
        businessName: businessName.trim(),
        tagline: tagline.trim() || null,
        description: description.trim() || null,
        coverPhotoUrl: coverPhotoUrl.trim() || null,
        logoUrl: logoUrl.trim() || null,
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

        <Text style={styles.footerNote}>
          Contact details and opening hours can be updated in the Venue Manager web portal.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, value, onChangeText, placeholder, multiline, numberOfLines, maxLength,
  colors,
}: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  multiline?: boolean; numberOfLines?: number; maxLength?: number;
  colors: { primary: string };
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
        style={[
          styles.fieldInput,
          multiline && { height: (numberOfLines ?? 1) * 24 + 24, textAlignVertical: "top" },
          { borderColor: colors.primary + "40" },
        ]}
      />
    </View>
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
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  footerNote: {
    color: "rgba(255,255,255,0.28)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
});
