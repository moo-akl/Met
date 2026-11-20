import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import {
  ActivityIndicator,
  type ImageStyle,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";

export type ChatPhotoUploadStatus =
  | "idle"
  | "preparing"
  | "uploading"
  | "ready"
  | "sending"
  | "failed";

export function ChatPhotoBubble({
  uri,
  caption,
  onPress,
  onLongPress,
  imageStyle,
  accessibilityLabel,
}: {
  uri: string;
  caption?: string;
  onPress: () => void;
  onLongPress?: () => void;
  imageStyle?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const { t } = useT();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t("chat.photo")}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={onLongPress ? 300 : undefined}
      style={styles.photoBubble}
      testID="chat-photo-message-bubble"
    >
      <Image
        source={{ uri }}
        style={[styles.bubbleImage, imageStyle]}
        contentFit="cover"
        cachePolicy="memory-disk"
        testID="chat-photo-image"
      />
      {caption ? (
        <View
          style={[styles.photoCaption, { backgroundColor: colors.card }]}
          testID="chat-photo-caption"
        >
          <Text style={[styles.captionText, { color: colors.foreground }]}>
            {caption}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ChatPhotoDraftPreview({
  uri,
  status,
  progress,
  onPress,
  onRemove,
  disabled = false,
}: {
  uri: string;
  status: ChatPhotoUploadStatus;
  progress: number | null;
  onPress: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  const { t } = useT();

  let statusText = "";
  if (status === "preparing") {
    statusText = t("chat.preparingPhoto");
  } else if (status === "uploading") {
    statusText =
      progress === null
        ? t("chat.uploadingPhoto")
        : `${t("chat.uploadingPhoto")} ${Math.round(progress * 100)}%`;
  } else if (status === "ready") {
    statusText = t("chat.readyToSendPhoto");
  } else if (status === "sending") {
    statusText = t("common.sending");
  } else if (status === "failed") {
    statusText = t("chat.sendFailed");
  }

  const busy =
    status === "preparing" ||
    status === "uploading" ||
    status === "sending";

  return (
    <View
      style={[
        styles.mediaPreviewBar,
        { backgroundColor: colors.card, borderTopColor: colors.border },
      ]}
      testID="chat-photo-preview"
    >
      <Pressable
        onPress={onPress}
        style={styles.mediaThumbWrap}
        accessibilityLabel={t("chat.photo")}
      >
        <Image
          source={{ uri }}
          style={styles.mediaThumb}
          contentFit="cover"
          testID="chat-photo-preview-image"
        />
      </Pressable>
      {status !== "idle" ? (
        <View
          style={styles.photoUploadStatus}
          accessibilityLiveRegion="polite"
          testID="chat-image-upload-status"
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather
              name={status === "ready" ? "check-circle" : "alert-circle"}
              size={15}
              color={status === "ready" ? colors.primary : colors.destructive}
            />
          )}
          <Text
            style={[
              styles.photoUploadStatusText,
              { color: colors.mutedForeground },
            ]}
            numberOfLines={1}
            testID="chat-image-upload-status-text"
          >
            {statusText}
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={onRemove}
        disabled={disabled}
        style={[
          styles.mediaRemoveBtn,
          { backgroundColor: colors.muted, opacity: disabled ? 0.5 : 1 },
        ]}
        accessibilityLabel={t("chat.removePhoto")}
        accessibilityState={{ disabled }}
        hitSlop={8}
      >
        <Feather name="x" size={14} color={colors.foreground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  photoBubble: {
    padding: 0,
    marginBottom: 3,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: 16,
    overflow: "hidden",
  },
  bubbleImage: {
    width: 210,
    height: 210,
    borderRadius: 15,
  },
  photoCaption: { paddingHorizontal: 4, paddingBottom: 4 },
  captionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  mediaPreviewBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  photoUploadStatus: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  photoUploadStatusText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  mediaThumbWrap: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  mediaThumb: {
    width: 64,
    height: 64,
  },
  mediaRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
