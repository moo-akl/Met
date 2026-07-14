import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";

const SPOTLIGHT_PAD = 14;
const DEFAULT_TOTAL_STEPS = 3;

export type TargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

interface Props {
  visible: boolean;
  step: number;
  totalSteps?: number;
  targetRect: TargetRect | null;
  stepText: string;
  isLastStep: boolean;
  onNext: () => void;
  onSkip: () => void;
}

export function WalkthroughOverlay({
  visible,
  step,
  totalSteps = DEFAULT_TOTAL_STEPS,
  targetRect,
  stepText,
  isLastStep,
  onNext,
  onSkip,
}: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const colors = useColors();
  const { t } = useT();
  const ringAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      fadeAnim.setValue(0);
      return;
    }
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim]);

  useEffect(() => {
    if (!visible || !targetRect) return;
    ringAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(ringAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, targetRect, ringAnim]);

  if (!visible) return null;

  const ringOpacity = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });

  const hasTarget = targetRect !== null;
  const spotX = hasTarget ? targetRect!.x - SPOTLIGHT_PAD : 0;
  const spotY = hasTarget ? targetRect!.y - SPOTLIGHT_PAD : 0;
  const spotW = hasTarget ? targetRect!.width + SPOTLIGHT_PAD * 2 : 0;
  const spotH = hasTarget ? targetRect!.height + SPOTLIGHT_PAD * 2 : 0;

  const tooltipAbove = hasTarget && spotY + spotH > screenH * 0.55;
  const tooltipStyle = hasTarget
    ? tooltipAbove
      ? { bottom: screenH - spotY + 16 }
      : { top: spotY + spotH + 16 }
    : { top: screenH * 0.38 };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onSkip}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}
        pointerEvents="box-none"
      >
        {hasTarget ? (
          <>
            <View
              style={[
                styles.overlay,
                { top: 0, left: 0, right: 0, height: Math.max(0, spotY) },
              ]}
            />
            <View
              style={[
                styles.overlay,
                { top: spotY + spotH, left: 0, right: 0, bottom: 0 },
              ]}
            />
            <View
              style={[
                styles.overlay,
                {
                  top: spotY,
                  left: 0,
                  width: Math.max(0, spotX),
                  height: spotH,
                },
              ]}
            />
            <View
              style={[
                styles.overlay,
                {
                  top: spotY,
                  left: spotX + spotW,
                  right: 0,
                  height: spotH,
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: spotY,
                left: spotX,
                width: spotW,
                height: spotH,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: colors.primary,
                opacity: ringOpacity,
              }}
            />
          </>
        ) : (
          <View style={[styles.overlay, StyleSheet.absoluteFill]} />
        )}

        <View
          style={[
            styles.tooltip,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              left: 20,
              right: 20,
              ...tooltipStyle,
            },
          ]}
        >
          <View style={styles.stepDots}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i + 1 === step ? colors.primary : colors.border,
                    width: i + 1 === step ? 16 : 6,
                  },
                ]}
              />
            ))}
          </View>

          <Text style={[styles.stepText, { color: colors.foreground }]}>
            {stepText}
          </Text>

          <View style={styles.actions}>
            <Pressable onPress={onSkip} hitSlop={10} accessibilityRole="button">
              <Text style={[styles.skipBtn, { color: colors.mutedForeground }]}>
                {t("walkthrough.skip")}
              </Text>
            </Pressable>
            <Pressable
              onPress={onNext}
              style={[styles.nextBtn, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.nextBtnText,
                  { color: colors.primaryForeground },
                ]}
              >
                {isLastStep ? t("walkthrough.gotIt") : t("walkthrough.next")}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  tooltip: {
    position: "absolute",
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  stepDots: {
    flexDirection: "row",
    gap: 6,
    alignSelf: "center",
    alignItems: "center",
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  stepText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  skipBtn: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    paddingVertical: 4,
  },
  nextBtn: {
    borderRadius: 99,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  nextBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
});
