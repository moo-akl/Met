/**
 * Edit Venue Announcement screen.
 *
 * Receives announcement fields via router params (from the announcements list
 * screen), pre-fills the form, and updates via PUT /api/venue-owner/me/announcements/:id.
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
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";

export default function EditVenueAnnouncementScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    title?: string;
    body?: string;
    imageUrl?: string;
    isPinned?: string;
  }>();

  const announcementId = Number(params.id);

  const [title, setTitle] = useState(params.title ?? "");
  const [body, setBody] = useState(params.body ?? "");
  const [imageUrl, setImageUrl] = useState(params.imageUrl ?? "");
  const [imageUploading, setImageUploading] = useState(false);
  const [isPinned, setIsPinned] = useState(params.isPinned === "true");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0;

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Please allow photo access in Settings to add an image.");
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
      const { url } = await api.uploadVenueAnnouncementImage(
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

  const handleSave = async () => {
    if (!authedUid || !canSubmit || submitting || !announcementId) return;
    setSubmitting(true);
    try {
      await api.updateVenueAnnouncement({ uid: authedUid }, announcementId, {
        title: title.trim(),
        body: body.trim(),
        imageUrl: imageUrl.trim() || null,
        isPinned,
      });
      Alert.alert("Announcement updated!", undefined, [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Failed to update announcement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: "#0F0F12" }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <VenueOwnerHeader title="Edit Announcement" onBack={() => router.back()} backLabel="Cancel" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Title *</Text>
          <TextInput
            value={title} onChangeText={setTitle} placeholder="Happy Hour Extended!"
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={[styles.fieldInput, { borderColor: colors.primary + "40" }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Message *</Text>
          <TextInput
            value={body} onChangeText={setBody}
            placeholder="We're extending happy hour every Friday until 9pm this month..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            multiline numberOfLines={5}
            style={[styles.fieldInput, { borderColor: colors.primary + "40", height: 140, textAlignVertical: "top" }]}
          />
        </View>

        {/* ── Cover Image ────────────────────────────────────────────────── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Image (optional)</Text>
          {imageUrl ? (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: imageUrl }} style={styles.imagePreview} resizeMode="cover" />
              <Pressable
                onPress={() => setImageUrl("")}
                style={styles.imageRemoveBtn}
                accessibilityLabel="Remove image"
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
                : <Text style={styles.imagePickerText}>＋ Add Image</Text>}
            </Pressable>
          )}
        </View>

        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleLabel}>Pin this announcement</Text>
            <Text style={styles.toggleSub}>Pinned posts always appear first</Text>
          </View>
          <Switch
            value={isPinned} onValueChange={setIsPinned}
            trackColor={{ false: "#333", true: colors.primary + "80" }}
            thumbColor={isPinned ? colors.primary : "#888"}
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
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#1A1A1E", borderRadius: 10, padding: 14 },
  toggleLabel: { color: "rgba(255,255,255,0.85)", fontSize: 15, fontFamily: "Inter_500Medium" },
  toggleSub: { color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
