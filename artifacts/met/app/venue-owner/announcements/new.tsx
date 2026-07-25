/**
 * New Venue Announcement screen
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

export default function NewVenueAnnouncementScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0;

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
      style={[styles.root, { backgroundColor: "#0F0F12" }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backText}>← Cancel</Text>
        </Pressable>
        <Text style={styles.title}>New Announcement</Text>
        <View style={{ width: 80 }} />
      </View>

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

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Image URL (optional)</Text>
          <TextInput
            value={imageUrl} onChangeText={setImageUrl} placeholder="https://..."
            placeholderTextColor="rgba(255,255,255,0.25)" autoCapitalize="none" keyboardType="url"
            style={[styles.fieldInput, { borderColor: colors.primary + "40" }]}
          />
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
          style={[styles.submitBtn, { backgroundColor: canSubmit && !submitting ? colors.primary : "#333" }]}
          onPress={handleCreate}
          disabled={!canSubmit || submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Post Announcement</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#1A1A1E", borderRadius: 10, padding: 14 },
  toggleLabel: { color: "rgba(255,255,255,0.85)", fontSize: 15, fontFamily: "Inter_500Medium" },
  toggleSub: { color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  submitBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
