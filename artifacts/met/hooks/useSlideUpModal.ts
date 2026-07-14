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
 * Pan-to-dismiss: `panGesture` is a pre-configured RNGH Gesture.Pan that
 * tracks downward drags on the sheet.  Wrap the sheet panel in a
 * `<GestureDetector gesture={panGesture}>` to enable swipe-to-dismiss.
 * Releasing below `DISMISS_THRESHOLD` (or flicking down fast) animates the
 * sheet off-screen and calls `onDismiss`; releasing above the threshold snaps
 * the sheet back to the open position.
 *
 * Usage:
 *   const { isMounted, panelStyle, backdropStyle, panGesture } =
 *     useSlideUpModal(visible, onClose);
 *   <Modal visible={isMounted} animationType="none" ...>
 *     <Animated.View style={[{ flex: 1 }, backdropStyle]}>
 *       ...
 *       <GestureDetector gesture={panGesture}>
 *         <Animated.View style={[styles.sheet, panelStyle]}>...</Animated.View>
 *       </GestureDetector>
 *     </Animated.View>
 *   </Modal>
 */

import { useEffect, useState } from "react";
import { Gesture } from "react-native-gesture-handler";
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

/** Pixels dragged downward before release triggers dismiss. */
const DISMISS_THRESHOLD = 120;
/** Downward flick velocity (px/s) that triggers dismiss regardless of distance. */
const DISMISS_VELOCITY = 800;

export function useSlideUpModal(visible: boolean, onDismiss?: () => void) {
  const translateY = useSharedValue(PANEL_OFFSCREEN);
  const dragY = useSharedValue(0);
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

  const panGesture = Gesture.Pan()
    // Only activate on clearly downward pans; fail immediately on upward swipes
    // so scroll-inside-the-sheet still works naturally.
    .activeOffsetY(10)
    .failOffsetY(-5)
    .onUpdate((e) => {
      // Clamp to non-negative so the sheet can't be dragged upward.
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      const shouldDismiss =
        dragY.value > DISMISS_THRESHOLD || e.velocityY > DISMISS_VELOCITY;

      if (shouldDismiss && onDismiss) {
        // Continue the exit spring from the current visual position so there
        // is no jump when dragY resets to 0.
        translateY.value = dragY.value;
        dragY.value = 0;
        translateY.value = withSpring(PANEL_OFFSCREEN, SPRING_OUT, (finished) => {
          if (finished) runOnJS(onDismiss)();
        });
      } else {
        // Not far enough — spring back to open position.
        dragY.value = withSpring(0, SPRING_IN);
      }
    })
    .onFinalize((_e, success) => {
      // Reset dragY if the gesture was interrupted or cancelled before onEnd.
      if (!success && dragY.value !== 0) {
        dragY.value = withSpring(0, SPRING_IN);
      }
    });

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + dragY.value }],
  }));

  // Opacity derived from the combined visual position so the backdrop always
  // tracks both the spring animation and live drag offset.
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value + dragY.value,
      [0, PANEL_OFFSCREEN],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return { isMounted, panelStyle, backdropStyle, panGesture };
}
