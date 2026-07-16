/**
 * ReviewModal — 5-star peer review with Vibe Tags
 *
 * Bottom-sheet modal that prompts the user to rate a peer with a 1–5 star
 * picker and optional Vibe Tag chips (Kind, Reliable, Open, Funny, Professional).
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
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { useSlideUpModal } from "@/hooks/useSlideUpModal";

const VIBE_TAG_KEYS = ["kind", "reliable", "open", "funny", "professional"] as const;
type VibeTagKey = (typeof VIBE_TAG_KEYS)[number];

// Individual animated star — each instance owns its own shared value so the
// bounce is isolated to the tapped star.
interface AnimatedStarProps {
  star: number;
  value: number;
  onChange: (v: number) => void;
}

function AnimatedStar({ star, value, onChange }: AnimatedStarProps) {
  const colors = useColors();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(1.4, { damping: 6, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 8, stiffness: 200 });
    });
    onChange(star);
  };

  const filled = star <= value;
  const fillColor = "#FFD700";

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="radio"
      accessibilityState={{ checked: filled }}
      accessibilityLabel={`${star} star${star !== 1 ? "s" : ""}`}
    >
      <Animated.View style={animStyle}>
        <Feather
          name="star"
          size={40}
          color={filled ? fillColor : "rgba(255,255,255,0.15)"}
          style={{ marginHorizontal: 4 }}
        />
      </Animated.View>
    </Pressable>
  );
}

interface StarPickerProps {
  value: number;
  onChange: (v: number) => void;
}

function StarPicker({ value, onChange }: StarPickerProps) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <AnimatedStar key={star} star={star} value={value} onChange={onChange} />
      ))}
    </View>
  );
}

interface Props {
  visible: boolean;
  receiverUid: string;
  receiverName: string;
  /** "chat" = submitted from chat screen (default). "meeting" = submitted after physically meeting. */
  context?: "chat" | "meeting";
  /** Called after submit succeeds OR after user skips. */
  onDone: () => void;
}

export function ReviewModal({ visible, receiverUid, receiverName, context = "chat", onDone }: Props) {
  const colors = useColors();
  const { t } = useT();
  const { authedUid } = useApp();
  const { isMounted, panelStyle, backdropStyle, panGesture } = useSlideUpModal(visible, onDone);

  const [starRating, setStarRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<Set<VibeTagKey>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = starRating > 0;

  const toggleTag = (tag: VibeTagKey) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit || !authedUid) return;
    setSubmitting(true);
    try {
      await api.submitReview(
        { uid: authedUid },
        {
          receiverUid,
          starRating,
          vibeTags: Array.from(selectedTags),
          context,
        },
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
      visible={isMounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleSkip}
    >
      <Animated.View style={[styles.backdropWrapper, backdropStyle]}>
      <Pressable style={styles.backdrop} onPress={handleSkip}>
        <GestureDetector gesture={panGesture}>
        <Animated.View style={panelStyle}>
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

              {/* Educational blurb */}
              <Text style={[styles.blurb, { color: colors.mutedForeground }]}>
                {t("review.blurb")}
              </Text>

              {/* 5-star picker */}
              <View style={[styles.starCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.starLabel, { color: colors.foreground }]}>
                  {t("review.starLabel")}
                </Text>
                <StarPicker value={starRating} onChange={setStarRating} />
              </View>

              {/* Vibe tag chips */}
              <Text style={[styles.vibeHeading, { color: colors.mutedForeground }]}>
                {t("review.vibeTagsLabel")}
              </Text>
              <View style={styles.tagsWrap}>
                {VIBE_TAG_KEYS.map((tag) => {
                  const active = selectedTags.has(tag);
                  return (
                    <Pressable
                      key={tag}
                      onPress={() => toggleTag(tag)}
                      style={[
                        styles.tagChip,
                        {
                          backgroundColor: active ? colors.primary : colors.muted,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                    >
                      <Text
                        style={[
                          styles.tagChipText,
                          { color: active ? "#fff" : colors.foreground },
                        ]}
                      >
                        {t(`review.vibeTags.${tag}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Submit */}
              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit || submitting}
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor:
                      canSubmit && !submitting ? colors.primary : colors.muted,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("review.submit")}
                accessibilityState={{ disabled: !canSubmit || submitting }}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text
                    style={[
                      styles.submitText,
                      { color: canSubmit ? "#fff" : colors.mutedForeground },
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
        </Animated.View>
        </GestureDetector>
      </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrapper: {
    flex: 1,
  },
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
    marginBottom: 12,
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
  blurb: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 17,
  },
  starCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    marginBottom: 18,
    gap: 12,
  },
  starLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  vibeHeading: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 18,
  },
  tagChip: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  tagChipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
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
