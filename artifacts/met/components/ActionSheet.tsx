import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useSlideUpModal } from "@/hooks/useSlideUpModal";

type IconName = React.ComponentProps<typeof Feather>["name"];

export type ActionItem = {
  label: string;
  icon?: IconName;
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions: ActionItem[];
};

export function ActionSheet({
  visible,
  onClose,
  title,
  message,
  actions,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webBot = Platform.OS === "web" ? 34 : 0;
  const { isMounted, panelStyle, backdropStyle, panGesture } = useSlideUpModal(visible, onClose);

  return (
    <Modal
      visible={isMounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdropWrapper, backdropStyle]}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <GestureDetector gesture={panGesture}>
        <Animated.View style={panelStyle}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + webBot + 16,
            },
          ]}
        >
          <View style={styles.handle} />

          {title ? (
            <Text style={[styles.title, { color: colors.foreground }]}>
              {title}
            </Text>
          ) : null}
          {message ? (
            <Text style={[styles.message, { color: colors.mutedForeground }]}>
              {message}
            </Text>
          ) : null}

          <View style={[styles.actions, { borderColor: colors.border }]}>
            {actions.map((a, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  onClose();
                  setTimeout(() => a.onPress(), 80);
                }}
                style={({ pressed }) => [
                  styles.action,
                  i < actions.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  },
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                {a.icon ? (
                  <Feather
                    name={a.icon}
                    size={18}
                    color={a.destructive ? colors.destructive : colors.foreground}
                  />
                ) : null}
                <Text
                  style={[
                    styles.actionText,
                    {
                      color: a.destructive
                        ? colors.destructive
                        : colors.foreground,
                    },
                  ]}
                >
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancel,
              {
                backgroundColor: colors.muted,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[styles.cancelText, { color: colors.foreground }]}>
              Cancel
            </Text>
          </Pressable>
        </Pressable>
        </Animated.View>
        </GestureDetector>
      </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrapper: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    gap: 14,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 4,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  message: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 12,
    marginTop: -8,
  },
  actions: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  actionText: { fontFamily: "Inter_500Medium", fontSize: 15 },
  cancel: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  cancelText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
