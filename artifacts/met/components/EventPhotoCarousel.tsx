import React, { useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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

export function getEventPhotoIndexAfterScroll(
  offsetX: number,
  itemWidth: number,
  gap: number,
  photoCount: number,
) {
  if (photoCount < 2 || itemWidth <= 0) return 0;
  return Math.max(
    0,
    Math.min(photoCount - 1, Math.round(offsetX / (itemWidth + gap))),
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
  const activeIndex = activePage.photosKey === photosKey ? activePage.index : 0;
  const flattenedImageStyle = StyleSheet.flatten(imageStyle);
  const flattenedContainerStyle = StyleSheet.flatten(containerStyle);
  const itemWidth =
    typeof flattenedImageStyle.width === "number"
      ? flattenedImageStyle.width
      : 0;
  const itemHeight =
    typeof flattenedImageStyle.height === "number"
      ? flattenedImageStyle.height
      : 230;
  const gap =
    typeof flattenedContainerStyle?.gap === "number"
      ? flattenedContainerStyle.gap
      : 0;
  const currentIndex = Math.min(activeIndex, photos.length - 1);

  const updateActivePage = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const index = getEventPhotoIndexAfterScroll(
      event.nativeEvent.contentOffset.x,
      itemWidth,
      gap,
      photos.length,
    );
    setActivePage({ photosKey, index });
  };

  if (photos.length === 0) return null;

  return (
    <View style={containerStyle} testID={testID}>
      <ScrollView
        key={photosKey}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={itemWidth > 0 ? itemWidth + gap : undefined}
        snapToAlignment="start"
        style={[styles.scroll, { height: itemHeight }]}
        contentContainerStyle={gap > 0 ? { gap } : undefined}
        onScrollEndDrag={updateActivePage}
        onMomentumScrollEnd={updateActivePage}
        testID={`${testID}-scroll`}
      >
        {photos.map((photo, index) => (
          <Image
            key={`${photosKey}-${index}`}
            source={{ uri: photo }}
            style={imageStyle}
            resizeMode="cover"
            accessibilityLabel={`${accessibilityLabel}, ${index + 1} of ${photos.length}`}
            testID={
              index === 0
                ? `${testID}-image`
                : `${testID}-image-${index}`
            }
          />
        ))}
      </ScrollView>
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
  scroll: {
    width: "100%",
    flexGrow: 0,
  },
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
