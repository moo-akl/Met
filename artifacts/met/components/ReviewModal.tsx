/**
 * ReviewModal
 *
 * Bottom-sheet modal that prompts the user to tag a peer after a chat
 * session. Appears when the user navigates back from the chat screen
 * (only if at least one message was exchanged).
 *
 * Shows 5 positive vibe tags. The user picks one and taps Submit.
 * Calls api.submitReview then invokes onDone so the caller can navigate away.
 */

import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n";

const VIBE_TAGS = [
  { key: "friendly",    emoji: "😊" },
  { key: "funny",       emoji: "😂" },
  { key: "interesting", emoji: "🤔" },
  { key: "helpful",     emoji: "🙌" },
  { key: "genuine",     emoji: "💎" },
] as const;

type VibeTag = (typeof VIBE_TAGS)[number]["key"];

interface Props {
  visible: boolean;
  receiverUid: string;
  receiverName: string;
  /** Called after submit succeeds OR after user skips. */
  onDone: () => void;
}

export function ReviewModal({ visible, receiverUid, receiverName, onDone }: Props) {
  const colors = useColors();
  const { t } = useT();
  const { authedUid } = useApp();

  const [selected, setSelected] = useState<VibeTag | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!selected || !authedUid) return;
    setSubmitting(true);
    try {
      await api.submitReview({ uid: authedUid }, { receiverUid, tag: selected });
    } catch {
      // best-effort — don't block navigation on failure
    } finally {
      setSubmitting(false);
      setSubmitted(true);
      setTimeout(onDone, 800);
    }
  };

  const handleSkip = () => {
    onDone();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleSkip}
    >
      <Pressable style={styles.backdrop} onPress={handleSkip}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {submitted ? (
            <View style={styles.successContainer}>
              <Text style={styles.successEmoji}>🎉</Text>
              <Text style={[styles.successText, { color: colors.foreground }]}>
                {t("review.submitted")}
              </Text>
            </View>
          ) : (
            <>
              {/* Header */}
              <View style={styles.header}>
                <View>
                  <Text style={[styles.title, { color: colors.foreground }]}>
                    {t("review.title")}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                    {t("review.subtitle", { name: receiverName })}
                  </Text>
                </View>
                <Pressable onPress={handleSkip} hitSlop={8} accessibilityLabel={t("common.skip")}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {/* Vibe tag grid */}
              <View style={styles.tagsGrid}>
                {VIBE_TAGS.map(({ key, emoji }) => {
                  const active = selected === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setSelected(key)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={t(`review.tag_${key}`)}
                      style={[
                        styles.tag,
                        {
                          backgroundColor: active ? colors.primary + "22" : colors.muted,
                          borderColor: active ? colors.primary : colors.border,
                          borderWidth: active ? 1.5 : 1,
                        },
                      ]}
                    >
                      <Text style={styles.tagEmoji}>{emoji}</Text>
                      <Text
                        style={[
                          styles.tagLabel,
                          { color: active ? colors.primary : colors.foreground },
                        ]}
                      >
                        {t(`review.tag_${key}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Submit */}
              <Pressable
                onPress={handleSubmit}
                disabled={!selected || submitting}
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor:
                      selected && !submitting ? colors.primary : colors.muted,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("review.submit")}
                accessibilityState={{ disabled: !selected || submitting }}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text
                    style={[
                      styles.submitText,
                      { color: selected ? "#fff" : colors.mutedForeground },
                    ]}
                  >
                    {t("review.submit")}
                  </Text>
                )}
              </Pressable>

              <Pressable onPress={handleSkip} style={styles.skipBtn}>
                <Text style={[styles.skipText, { color: colors.mutedForeground }]}>
                  {t("common.skip")}
                </Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 3,
  },
  tagsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  tagEmoji: {
    fontSize: 16,
    lineHeight: 20,
  },
  tagLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    textTransform: "capitalize",
  },
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  submitText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  skipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 10,
  },
  successEmoji: {
    fontSize: 42,
    lineHeight: 50,
  },
  successText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
});
