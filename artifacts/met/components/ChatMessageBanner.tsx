import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const BANNER_DURATION_MS = 4000;
const SLIDE_DURATION_MS = 280;

export type ChatBannerPayload = {
  chatPeerUid: string;
  senderName: string;
  messagePreview: string;
};

type Props = {
  payload: ChatBannerPayload | null;
  onNavigate: (chatPeerUid: string) => void;
  onDismiss: () => void;
};

export function ChatMessageBanner({ payload, onNavigate, onDismiss }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(false);

  const hide = useCallback(() => {
    if (!visibleRef.current) return;
    visibleRef.current = false;
    Animated.timing(translateY, {
      toValue: -120,
      duration: SLIDE_DURATION_MS,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  }, [translateY, onDismiss]);

  useEffect(() => {
    if (!payload) return;

    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);

    visibleRef.current = true;
    Animated.timing(translateY, {
      toValue: 0,
      duration: SLIDE_DURATION_MS,
      useNativeDriver: true,
    }).start();

    autoHideTimer.current = setTimeout(hide, BANNER_DURATION_MS);

    return () => {
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    };
  }, [payload, translateY, hide]);

  if (!payload) return null;

  const handlePress = () => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    visibleRef.current = false;
    Animated.timing(translateY, {
      toValue: -120,
      duration: SLIDE_DURATION_MS,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
      onNavigate(payload.chatPeerUid);
    });
  };

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          top: insets.top + 8,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={handlePress}
        style={[
          styles.banner,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
        android_ripple={{ color: colors.border }}
      >
        <View
          style={[styles.iconContainer, { backgroundColor: colors.primary }]}
        >
          <Feather name="message-circle" size={18} color={colors.primaryForeground} />
        </View>
        <View style={styles.textContainer}>
          <Text
            style={[styles.senderName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {payload.senderName}
          </Text>
          <Text
            style={[styles.preview, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {payload.messagePreview}
          </Text>
        </View>
        <Pressable onPress={hide} hitSlop={12} style={styles.closeButton}>
          <Feather name="x" size={16} color={colors.mutedForeground} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 9999,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  senderName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  preview: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  closeButton: {
    padding: 2,
    flexShrink: 0,
  },
});
