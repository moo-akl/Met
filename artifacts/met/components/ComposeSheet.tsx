import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { useCreateAnnouncement } from "@workspace/api-client-react";

type AnnType = "post" | "poll" | "questionnaire";

const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;
const MAX_QUESTIONS = 5;

interface Props {
  networkId: number;
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function ComposeSheet({ networkId, visible, onClose, onCreated }: Props) {
  const colors = useColors();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const createMutation = useCreateAnnouncement();

  const [annType, setAnnType] = useState<AnnType>("post");
  const [body, setBody] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [options, setOptions] = useState(["", ""]);
  const [questions, setQuestions] = useState([""]);
  const [submitting, setSubmitting] = useState(false);

  function resetState() {
    setAnnType("post");
    setBody("");
    setPhotoUrl(null);
    setPhotoPreview(null);
    setOptions(["", ""]);
    setQuestions([""]);
    setSubmitting(false);
    setUploadingPhoto(false);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) return;

    setPhotoPreview(asset.uri);
    setUploadingPhoto(true);
    try {
      const uid = profile?.id ?? "";
      const uploaded = await api.uploadAnnouncementPhoto(
        { uid },
        networkId,
        { base64: asset.base64, contentType: asset.mimeType ?? "image/jpeg" },
      );
      setPhotoUrl(uploaded.photoUrl);
    } catch {
      Alert.alert("Upload failed", "Could not upload the photo. Try again.");
      setPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handleRemovePhoto() {
    setPhotoUrl(null);
    setPhotoPreview(null);
  }

  function updateOption(i: number, value: string) {
    setOptions((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  function addOption() {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(i: number) {
    if (options.length <= MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateQuestion(i: number, value: string) {
    setQuestions((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  function addQuestion() {
    if (questions.length >= MAX_QUESTIONS) return;
    setQuestions((prev) => [...prev, ""]);
  }

  function removeQuestion(i: number) {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function isValid() {
    if (!body.trim()) return false;
    if (annType === "poll") {
      return options.filter((o) => o.trim()).length >= MIN_OPTIONS;
    }
    if (annType === "questionnaire") {
      return questions.filter((q) => q.trim()).length >= 1;
    }
    return true;
  }

  async function handleSubmit() {
    if (!isValid() || submitting) return;
    setSubmitting(true);
    try {
      const data: Parameters<typeof createMutation.mutateAsync>[0]["data"] = {
        body: body.trim(),
        type: annType,
        photoUrl: annType === "post" ? (photoUrl ?? null) : null,
        options:
          annType === "poll"
            ? options.map((o) => o.trim()).filter(Boolean)
            : null,
        questions:
          annType === "questionnaire"
            ? questions.map((q) => q.trim()).filter(Boolean)
            : null,
      };
      await createMutation.mutateAsync({ id: networkId, data });
      resetState();
      onCreated();
    } catch {
      Alert.alert("Failed", "Could not post the announcement. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const TABS: Array<{ key: AnnType; label: string; icon: React.ComponentProps<typeof Feather>["name"] }> = [
    { key: "post", label: t("networks.feedPost"), icon: "bell" },
    { key: "poll", label: t("networks.feedPoll"), icon: "bar-chart-2" },
    { key: "questionnaire", label: t("networks.feedQuestionnaire"), icon: "help-circle" },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View
          style={[
            styles.header,
            {
              borderBottomColor: colors.border,
              paddingTop: insets.top > 0 ? insets.top : 16,
            },
          ]}
        >
          <Pressable onPress={handleClose} hitSlop={8}>
            <Text style={{ color: colors.mutedForeground, fontSize: 16 }}>
              {t("common.cancel")}
            </Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {t("networks.feedCompose")}
          </Text>
          <Pressable onPress={handleSubmit} disabled={!isValid() || submitting} hitSlop={8}>
            {submitting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={{
                  color: isValid() ? colors.primary : colors.mutedForeground,
                  fontSize: 16,
                  fontWeight: "700",
                }}
              >
                {t("networks.feedSubmitBtn")}
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Type tabs ─────────────────────────────────────────────────── */}
          <View
            style={[styles.tabs, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            {TABS.map((tab) => {
              const active = annType === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setAnnType(tab.key)}
                  style={[
                    styles.tab,
                    active && { backgroundColor: colors.primary + "18" },
                  ]}
                >
                  <Feather
                    name={tab.icon}
                    size={13}
                    color={active ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: active ? colors.primary : colors.mutedForeground },
                      active && { fontWeight: "700" },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Body text ─────────────────────────────────────────────────── */}
          <TextInput
            style={[
              styles.bodyInput,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
            ]}
            placeholder={t("networks.feedBodyPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={2000}
            textAlignVertical="top"
          />

          {/* ── Photo picker (Post only) ───────────────────────────────────── */}
          {annType === "post" && (
            <View style={styles.photoSection}>
              {photoPreview ? (
                <View style={styles.photoPreviewWrap}>
                  <Image
                    source={{ uri: photoPreview }}
                    style={styles.photoPreview}
                    resizeMode="cover"
                  />
                  {uploadingPhoto && (
                    <View style={styles.uploadOverlay}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  )}
                  {!uploadingPhoto && (
                    <Pressable
                      onPress={handleRemovePhoto}
                      style={styles.removePhotoBtn}
                    >
                      <Feather name="x" size={14} color="#fff" />
                    </Pressable>
                  )}
                </View>
              ) : (
                <Pressable
                  onPress={handlePickPhoto}
                  style={[
                    styles.addPhotoBtn,
                    { borderColor: colors.border, backgroundColor: colors.card },
                  ]}
                >
                  <Feather name="image" size={18} color={colors.mutedForeground} />
                  <Text style={[styles.addPhotoBtnText, { color: colors.mutedForeground }]}>
                    {t("networks.feedAddPhoto")}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* ── Poll options ───────────────────────────────────────────────── */}
          {annType === "poll" && (
            <View style={styles.listSection}>
              {options.map((opt, i) => (
                <View key={i} style={styles.listRow}>
                  <TextInput
                    style={[
                      styles.listInput,
                      { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
                    ]}
                    placeholder={`${t("networks.feedOptionPlaceholder")} ${i + 1}`}
                    placeholderTextColor={colors.mutedForeground}
                    value={opt}
                    onChangeText={(v) => updateOption(i, v)}
                    maxLength={120}
                  />
                  {options.length > MIN_OPTIONS && (
                    <Pressable onPress={() => removeOption(i)} hitSlop={8}>
                      <Feather name="minus-circle" size={18} color={colors.mutedForeground} />
                    </Pressable>
                  )}
                </View>
              ))}
              {options.length < MAX_OPTIONS && (
                <Pressable onPress={addOption} style={styles.addRowBtn}>
                  <Feather name="plus" size={14} color={colors.primary} />
                  <Text style={[styles.addRowBtnText, { color: colors.primary }]}>
                    {t("networks.feedAddOption")}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* ── Questionnaire questions ────────────────────────────────────── */}
          {annType === "questionnaire" && (
            <View style={styles.listSection}>
              {questions.map((q, i) => (
                <View key={i} style={styles.listRow}>
                  <TextInput
                    style={[
                      styles.listInput,
                      { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
                    ]}
                    placeholder={`${t("networks.feedQuestionPlaceholder")} ${i + 1}`}
                    placeholderTextColor={colors.mutedForeground}
                    value={q}
                    onChangeText={(v) => updateQuestion(i, v)}
                    maxLength={200}
                  />
                  {questions.length > 1 && (
                    <Pressable onPress={() => removeQuestion(i)} hitSlop={8}>
                      <Feather name="minus-circle" size={18} color={colors.mutedForeground} />
                    </Pressable>
                  )}
                </View>
              ))}
              {questions.length < MAX_QUESTIONS && (
                <Pressable onPress={addQuestion} style={styles.addRowBtn}>
                  <Feather name="plus" size={14} color={colors.primary} />
                  <Text style={[styles.addRowBtnText, { color: colors.primary }]}>
                    {t("networks.feedAddQuestion")}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: "600" },
  body: { padding: 16, gap: 16 },
  tabs: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  tabLabel: { fontSize: 13 },
  bodyInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 110,
  },
  photoSection: {},
  photoPreviewWrap: {
    borderRadius: 12,
    overflow: "hidden",
    height: 160,
    position: "relative",
  },
  photoPreview: { width: "100%", height: "100%" },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  removePhotoBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    padding: 5,
  },
  addPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 20,
  },
  addPhotoBtnText: { fontSize: 14 },
  listSection: { gap: 10 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  listInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  addRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  addRowBtnText: { fontSize: 14, fontWeight: "600" },
});
