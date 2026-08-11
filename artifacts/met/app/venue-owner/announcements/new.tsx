/**
 * New Venue Announcement screen
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
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { api, ApiError } from "@/lib/api/client";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";

const GREEN = "#00E87A";

export default function NewVenueAnnouncementScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0;

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
    const MAX_BYTES = 5 * 1024 * 1024;
    const byteSize = asset.fileSize ?? Math.floor(asset.base64.length * 3 / 4);
    if (byteSize > MAX_BYTES) {
      Alert.alert("Image too large", "Please choose an image under 5 MB.");
      return;
    }
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

  const handleCreate = async () => {
    if (!authedUid || !canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await api.createVenueAnnouncement({ uid: authedUid }, {
        title: title.trim(),
        body: body.trim(),
        imageUrl: imageUrl.trim() || null,
        isPinned,
      });
      Alert.alert("Announcement posted!", undefined, [{ text: "Done", onPress: () => router.back() }]);
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Failed to post announcement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: vBg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <VenueOwnerHeader
        title="New Announcement"
        onBack={() => router.back()}
        backLabel="Cancel"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: vLabel }]}>Title *</Text>
          <TextInput
            value={title} onChangeText={setTitle} placeholder="Happy Hour Extended!"
            placeholderTextColor={vPlaceholder}
            style={[styles.fieldInput, { backgroundColor: vInput, borderColor: accent + "40", color: vText }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: vLabel }]}>Message *</Text>
          <TextInput
            value={body} onChangeText={setBody}
            placeholder="We're extending happy hour every Friday until 9pm this month..."
            placeholderTextColor={vPlaceholder}
            multiline numberOfLines={5}
            style={[styles.fieldInput, { backgroundColor: vInput, borderColor: accent + "40", color: vText, height: 140, textAlignVertical: "top" }]}
          />
        </View>

        {/* ── Cover Image ── */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: vLabel }]}>Image (optional)</Text>
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
              style={[styles.imagePickerBtn, { backgroundColor: vInput, borderColor: accent + "40" }]}
            >
              {imageUploading
                ? <ActivityIndicator color={accent} />
                : <Text style={[styles.imagePickerText, { color: vMuted }]}>＋ Add Image</Text>}
            </Pressable>
          )}
        </View>

        <View style={[styles.toggleRow, { backgroundColor: vToggleBg, borderColor: vToggleBorder }]}>
          <View>
            <Text style={[styles.toggleLabel, { color: vToggleLabel }]}>Pin this announcement</Text>
            <Text style={[styles.toggleSub, { color: vToggleSub }]}>Pinned posts always appear first</Text>
          </View>
          <Switch
            value={isPinned} onValueChange={setIsPinned}
            trackColor={{ false: isDark ? "#333" : "rgba(0,0,0,0.12)", true: accent + "80" }}
            thumbColor={isPinned ? accent : isDark ? "#888" : "#bbb"}
          />
        </View>

        <Pressable
          style={[styles.submitBtn, { backgroundColor: canSubmit && !submitting ? accent : vDisabledBtn }]}
          onPress={handleCreate}
          disabled={!canSubmit || submitting}
        >
          {submitting
            ? <ActivityIndicator color={isDark ? "#fff" : "#0D0D0D"} />
            : <Text style={[styles.submitBtnText, { color: isDark ? "#fff" : "#0D0D0D" }]}>Post Announcement</Text>}
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
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  fieldInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  imagePickerBtn: { borderWidth: 1, borderStyle: "dashed", borderRadius: 10, paddingVertical: 20, alignItems: "center", justifyContent: "center" },
  imagePickerText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  imagePreviewWrap: { borderRadius: 10, overflow: "hidden" },
  imagePreview: { width: "100%", height: 160, borderRadius: 10 },
  imageRemoveBtn: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  imageRemoveText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 10, borderWidth: 1, padding: 14 },
  toggleLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  toggleSub: { fontSize: 12, marginTop: 2 },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  submitBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
