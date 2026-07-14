/**
 * useSlideUpModal
 *
 * Shared hook for bottom-sheet modals.  Drives a Reanimated `translateY`
 * shared value with `withSpring` open/close animations and keeps the Modal
 * mounted until the exit spring fully completes — preventing the sheet from
 * disappearing before the slide-down animation finishes.
 *
 * The `backdropStyle` animates opacity in sync with the panel position so the
 * semi-transparent backdrop fades in/out smoothly instead of snapping.
 *
 * Usage:
 *   const { isMounted, panelStyle, backdropStyle } = useSlideUpModal(visible);
 *   <Modal visible={isMounted} animationType="none" ...>
 *     <Animated.View style={[{ flex: 1 }, backdropStyle]}>
 *       ...
 *       <Animated.View style={[styles.sheet, panelStyle]}>...</Animated.View>
 *     </Animated.View>
 *   </Modal>
 */

import { useEffect, useState } from "react";
import {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const PANEL_OFFSCREEN = 800;
const SPRING_IN = { damping: 20, stiffness: 220 } as const;
const SPRING_OUT = { damping: 22, stiffness: 280 } as const;

export function useSlideUpModal(visible: boolean) {
  const translateY = useSharedValue(PANEL_OFFSCREEN);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      translateY.value = withSpring(0, SPRING_IN);
    } else {
      translateY.value = withSpring(
        PANEL_OFFSCREEN,
        SPRING_OUT,
        (finished) => {
          if (finished) runOnJS(setIsMounted)(false);
        },
      );
    }
    // translateY shared value identity is stable — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Opacity derived directly from panel position so backdrop fade is always
  // in sync with the sheet spring — no extra shared value or timer needed.
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [0, PANEL_OFFSCREEN],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return { isMounted, panelStyle, backdropStyle };
}
