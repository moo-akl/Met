import React, { useMemo, useRef, useState } from "react";
import {
  Image,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useColors } from "@/hooks/useColors";

type EventPhotoCarouselProps = {
  photos: string[];
  imageStyle: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  testID: string;
  accessibilityLabel: string;
};

export function shouldCaptureEventPhotoSwipe(
  photoCount: number,
  dx: number,
  dy: number,
) {
  return (
    photoCount > 1 &&
    Math.abs(dx) >= 12 &&
    Math.abs(dx) > Math.abs(dy) * 1.2
  );
}

export function getEventPhotoIndexAfterSwipe(
  currentIndex: number,
  photoCount: number,
  dx: number,
) {
  if (photoCount < 2 || Math.abs(dx) < 40) return currentIndex;
  return Math.max(
    0,
    Math.min(photoCount - 1, currentIndex + (dx < 0 ? 1 : -1)),
  );
}

export function EventPhotoCarousel({
  photos,
  imageStyle,
  containerStyle,
  testID,
  accessibilityLabel,
}: EventPhotoCarouselProps) {
  const colors = useColors();
  const photosKey = photos.join("\u0000");
  const [activePage, setActivePage] = useState({ photosKey, index: 0 });
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const photosKeyRef = useRef(photosKey);
  photosKeyRef.current = photosKey;
  const activeIndex = activePage.photosKey === photosKey ? activePage.index : 0;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          shouldCaptureEventPhotoSwipe(
            photosRef.current.length,
            gesture.dx,
            gesture.dy,
          ),
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_event, gesture) => {
          setActivePage((current) => {
            const currentIndex =
              current.photosKey === photosKeyRef.current ? current.index : 0;
            return {
              photosKey: photosKeyRef.current,
              index: getEventPhotoIndexAfterSwipe(
                currentIndex,
                photosRef.current.length,
                gesture.dx,
              ),
            };
          });
        },
      }),
    [],
  );

  if (photos.length === 0) return null;

  const currentIndex = Math.min(activeIndex, photos.length - 1);
  const currentPhoto = photos[currentIndex];

  return (
    <View
      {...panResponder.panHandlers}
      style={containerStyle}
      testID={testID}
    >
      <Image
        source={{ uri: currentPhoto }}
        style={imageStyle}
        resizeMode="cover"
        accessibilityLabel={`${accessibilityLabel}, ${currentIndex + 1} of ${photos.length}`}
        testID={`${testID}-image`}
      />
      {photos.length > 1 ? (
        <View
          style={styles.pagination}
          pointerEvents="none"
          testID={`${testID}-indicator`}
        >
          <Text style={[styles.paginationText, { color: colors.mutedForeground }]}>
            {currentIndex + 1} / {photos.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pagination: {
    alignSelf: "flex-end",
    paddingTop: 4,
    paddingRight: 10,
  },
  paginationText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
