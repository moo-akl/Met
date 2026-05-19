import { Image } from "@/components/MetImage";
import React, { useCallback } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

type Props = {
  uri: string;
  visible: boolean;
  onClose: () => void;
};

const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.5 };
const MIN_SCALE = 1;
const MAX_SCALE = 5;

export function PhotoLightbox({ uri, visible, onClose }: Props) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const savedOffsetX = useSharedValue(0);
  const savedOffsetY = useSharedValue(0);

  const resetTransform = useCallback(() => {
    "worklet";
    scale.value = withSpring(1, SPRING_CONFIG);
    offsetX.value = withSpring(0, SPRING_CONFIG);
    offsetY.value = withSpring(0, SPRING_CONFIG);
    savedScale.value = 1;
    savedOffsetX.value = 0;
    savedOffsetY.value = 0;
  }, [scale, offsetX, offsetY, savedScale, savedOffsetX, savedOffsetY]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, savedScale.value * e.scale)
      );
      scale.value = next;
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE, SPRING_CONFIG);
        savedScale.value = MIN_SCALE;
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .minPointers(2)
    .onUpdate((e) => {
      offsetX.value = savedOffsetX.value + e.translationX;
      offsetY.value = savedOffsetY.value + e.translationY;
    })
    .onEnd(() => {
      savedOffsetX.value = offsetX.value;
      savedOffsetY.value = offsetY.value;
    });

  const tapToDismiss = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      if (scale.value > 1.05) {
        resetTransform();
      } else {
        runOnJS(onClose)();
      }
    });

  const composed = Gesture.Simultaneous(
    Gesture.Simultaneous(pinchGesture, panGesture),
    tapToDismiss
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <GestureDetector gesture={composed}>
          <Animated.View style={[styles.imageWrapper, animatedStyle]}>
            <Image
              source={{ uri }}
              style={styles.image}
              contentFit="contain"
            />
          </Animated.View>
        </GestureDetector>

        <Pressable
          style={styles.closeHitArea}
          onPress={onClose}
          accessibilityLabel="Close photo"
          accessibilityRole="button"
          hitSlop={16}
        >
          <View style={styles.closeButton}>
            <View style={[styles.closeLine, styles.closeLineLeft]} />
            <View style={[styles.closeLine, styles.closeLineRight]} />
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageWrapper: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  closeHitArea: {
    position: "absolute",
    top: 56,
    right: 20,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeLine: {
    position: "absolute",
    width: 18,
    height: 2,
    backgroundColor: "#fff",
    borderRadius: 1,
  },
  closeLineLeft: {
    transform: [{ rotate: "45deg" }],
  },
  closeLineRight: {
    transform: [{ rotate: "-45deg" }],
  },
});
