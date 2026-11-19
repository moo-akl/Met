import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { VenueEventPhoto } from "@/lib/useVenueEventPhotoUploads";

export function EventPhotoUploadStatus({
  photo,
  testID,
  onRetry,
}: {
  photo: VenueEventPhoto;
  testID: string;
  onRetry: () => void;
}) {
  const colors = useColors();

  if (photo.status === "uploaded") return null;

  if (photo.status === "failed") {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry photo upload"
        accessibilityHint={photo.error}
        testID={`${testID}-retry`}
        onPress={onRetry}
        style={[styles.overlay, { backgroundColor: `${colors.card}e8` }]}
      >
        <Feather name="refresh-cw" size={16} color={colors.primary} />
        <Text style={[styles.statusText, { color: colors.text }]}>Retry</Text>
      </Pressable>
    );
  }

  if (photo.status === "uploading") {
    const percent = Math.round(photo.progress * 100);
    return (
      <View
        accessibilityLabel={`Uploading photo ${percent}%`}
        testID={`${testID}-progress`}
        style={[styles.overlay, { backgroundColor: `${colors.card}e8` }]}
      >
        <Text style={[styles.statusText, { color: colors.text }]}>{percent}%</Text>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${percent}%`,
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel="Preparing photo"
      testID={`${testID}-preparing`}
      style={[styles.overlay, { backgroundColor: `${colors.card}e8` }]}
    >
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    padding: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  progressTrack: {
    width: "85%",
    height: 4,
    overflow: "hidden",
    borderRadius: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
});
