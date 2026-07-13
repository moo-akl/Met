/**
 * ReviewModal — 3-category scored peer review
 *
 * Bottom-sheet modal that prompts the user to rate a peer across three
 * dimensions: Courtesy, Communication, Reliability (each 1–5 dots).
 * Appears after a chat session. Calls api.submitReview then invokes onDone.
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

const MAX_SCORE = 5;

interface CategoryRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
}

function CategoryRow({ label, value, onChange }: CategoryRowProps) {
  const colors = useColors();
  return (
    <View style={styles.categoryRow}>
      <Text style={[styles.categoryLabel, { color: colors.foreground }]}>
        {label}
      </Text>
      <View style={styles.dotsRow}>
        {Array.from({ length: MAX_SCORE }, (_, i) => {
          const score = i + 1;
          const filled = score <= value;
          return (
            <Pressable
              key={score}
              onPress={() => onChange(score)}
              hitSlop={6}
              accessibilityRole="radio"
              accessibilityState={{ checked: filled }}
              accessibilityLabel={`${score} out of ${MAX_SCORE}`}
            >
              <View
                style={[
                  styles.dot,
                  filled
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1.5 },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

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

  const [courtesy, setCourtesy] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [reliability, setReliability] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const allRated = courtesy > 0 && communication > 0 && reliability > 0;

  const handleSubmit = async () => {
    if (!allRated || !authedUid) return;
    setSubmitting(true);
    try {
      await api.submitReview(
        { uid: authedUid },
        { receiverUid, courtesy, communication, reliability },
      );
    } catch {
      // best-effort — don't block navigation on failure
    } finally {
      setSubmitting(false);
      setSubmitted(true);
      setTimeout(onDone, 900);
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
              <Text style={styles.successEmoji}>🌟</Text>
              <Text style={[styles.successText, { color: colors.foreground }]}>
                {t("review.submitted")}
              </Text>
            </View>
          ) : (
            <>
              {/* Header */}
              <View style={styles.header}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.title, { color: colors.foreground }]}>
                    {t("review.title")}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                    {t("review.subtitle", { name: receiverName })}
                  </Text>
                </View>
                <Pressable
                  onPress={handleSkip}
                  hitSlop={8}
                  accessibilityLabel={t("common.skip")}
                >
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {/* Educational blurb — shown at top so users understand before rating */}
              <Text style={[styles.blurb, { color: colors.mutedForeground }]}>
                {t("review.blurb")}
              </Text>

              {/* Category selectors */}
              <View
                style={[
                  styles.categoriesCard,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <CategoryRow
                  label={t("review.courtesy")}
                  value={courtesy}
                  onChange={setCourtesy}
                />
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <CategoryRow
                  label={t("review.communication")}
                  value={communication}
                  onChange={setCommunication}
                />
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <CategoryRow
                  label={t("review.reliability")}
                  value={reliability}
                  onChange={setReliability}
                />
              </View>

              {/* Submit */}
              <Pressable
                onPress={handleSubmit}
                disabled={!allRated || submitting}
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor:
                      allRated && !submitting ? colors.primary : colors.muted,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("review.submit")}
                accessibilityState={{ disabled: !allRated || submitting }}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text
                    style={[
                      styles.submitText,
                      { color: allRated ? "#fff" : colors.mutedForeground },
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
    marginBottom: 18,
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
  categoriesCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    overflow: "hidden",
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  categoryLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    flex: 1,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  blurb: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 17,
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
