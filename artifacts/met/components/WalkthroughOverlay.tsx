import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";

const SPOTLIGHT_PAD = 14;
const DEFAULT_TOTAL_STEPS = 3;
const PANEL_OFFSCREEN = 420;
const PANEL_SPRING_IN = { damping: 18, stiffness: 200 } as const;
const PANEL_SPRING_OUT = { damping: 20, stiffness: 260 } as const;

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
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { t } = useT();

  // isMounted drives Modal visibility — stays true until the exit spring
  // fully completes, so the slide-down animation is always visible.
  const [isMounted, setIsMounted] = useState(false);

  // ── RN Animated (spotlight overlay fade + ring pulse) ─────────────────
  const ringAnim = useRef(new RNAnimated.Value(0)).current;
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      RNAnimated.timing(fadeAnim, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }).start();
    } else {
      // Fade the dark overlay out in sync with the panel sliding down.
      RNAnimated.timing(fadeAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim]);

  useEffect(() => {
    if (!visible || !targetRect) return;
    ringAnim.setValue(0);
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(ringAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        RNAnimated.timing(ringAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, targetRect, ringAnim]);

  // ── Reanimated (bottom-sheet panel) ───────────────────────────────────
  const panelY = useSharedValue(PANEL_OFFSCREEN);

  // Displayed content — only updated after the panel slides off on step
  // transitions, preventing mid-slide content flashes.
  const [displayedStep, setDisplayedStep] = useState(step);
  const [displayedText, setDisplayedText] = useState(stepText);
  const [displayedIsLast, setDisplayedIsLast] = useState(isLastStep);
  const [displayedTotal, setDisplayedTotal] = useState(totalSteps);

  // Always-current ref for the Reanimated → JS bridge.
  const contentRef = useRef({ step, stepText, isLastStep, totalSteps });
  useEffect(() => {
    contentRef.current = { step, stepText, isLastStep, totalSteps };
  });

  const applyContentAndSlideIn = useCallback(() => {
    setDisplayedStep(contentRef.current.step);
    setDisplayedText(contentRef.current.stepText);
    setDisplayedIsLast(contentRef.current.isLastStep);
    setDisplayedTotal(contentRef.current.totalSteps);
    panelY.value = withSpring(0, PANEL_SPRING_IN);
  }, [panelY]);

  // Mount / unmount lifecycle driven by the exit spring callback so the
  // slide-down animation always completes before the Modal disappears.
  useEffect(() => {
    if (visible) {
      // Snap displayed content to current props, mount, then spring in.
      setDisplayedStep(step);
      setDisplayedText(stepText);
      setDisplayedIsLast(isLastStep);
      setDisplayedTotal(totalSteps);
      setIsMounted(true);
      panelY.value = withSpring(0, PANEL_SPRING_IN);
    } else {
      // Spring the panel off-screen; unmount only after animation finishes.
      panelY.value = withSpring(PANEL_OFFSCREEN, PANEL_SPRING_OUT, (finished) => {
        if (finished) runOnJS(setIsMounted)(false);
      });
    }
    // Intentionally omits step/stepText/isLastStep/totalSteps — step
    // transitions are handled by the separate effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, panelY]);

  // Step transition: slide panel out → swap content → slide back in.
  const prevStepRef = useRef(step);
  useEffect(() => {
    if (!visible || step === prevStepRef.current) {
      prevStepRef.current = step;
      return;
    }
    prevStepRef.current = step;
    panelY.value = withSpring(PANEL_OFFSCREEN, PANEL_SPRING_OUT, (finished) => {
      if (finished) runOnJS(applyContentAndSlideIn)();
    });
  }, [step, visible, panelY, applyContentAndSlideIn]);

  const panelAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: panelY.value }],
  }));

  if (!isMounted) return null;

  // ── Spotlight geometry ────────────────────────────────────────────────
  const ringOpacity = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });
  const { height: screenH } = Dimensions.get("window");
  const hasTarget = targetRect !== null;
  const spotX = hasTarget ? targetRect!.x - SPOTLIGHT_PAD : 0;
  const spotW = hasTarget ? targetRect!.width + SPOTLIGHT_PAD * 2 : 0;
  const spotH = hasTarget ? targetRect!.height + SPOTLIGHT_PAD * 2 : 0;
  // Clamp so the spotlight ring never renders off-screen.
  const rawSpotY = hasTarget ? targetRect!.y - SPOTLIGHT_PAD : 0;
  const spotY = Math.max(0, Math.min(rawSpotY, Math.max(0, screenH - spotH)));

  return (
    <Modal
      visible={isMounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onSkip}
    >
      {/* Dark overlay + spotlight cutout (RN Animated — unchanged) */}
      <RNAnimated.View
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
            <RNAnimated.View
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
      </RNAnimated.View>

      {/* Bottom-sheet panel (Reanimated withSpring) */}
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            paddingBottom: Math.max(insets.bottom + 8, 24),
          },
          panelAnimStyle,
        ]}
      >
        {/* Step progress dots */}
        <View style={styles.stepDots}>
          {Array.from({ length: displayedTotal }, (_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i + 1 === displayedStep ? colors.primary : colors.border,
                  width: i + 1 === displayedStep ? 16 : 6,
                },
              ]}
            />
          ))}
        </View>

        {/* Instructional copy */}
        <Text style={[styles.stepText, { color: colors.foreground }]}>
          {displayedText}
        </Text>

        {/* Skip / Next–Got it */}
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
              style={[styles.nextBtnText, { color: colors.primaryForeground }]}
            >
              {displayedIsLast
                ? t("walkthrough.gotIt")
                : t("walkthrough.next")}
            </Text>
          </Pressable>
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
  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: 20,
    paddingHorizontal: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
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
    marginBottom: 4,
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
