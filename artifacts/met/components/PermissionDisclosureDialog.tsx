import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

export type DisclosureKind = "location" | "bluetooth";

type Props = {
  visible: boolean;
  kind: DisclosureKind;
  /**
   * "prompt"   — first-time disclosure shown BEFORE the OS permission
   *              dialog. Accept callback should trigger the OS prompt.
   * "reminder" — re-shown later when permission is denied. Accept
   *              callback should typically open Settings via
   *              Linking.openSettings().
   */
  mode: "prompt" | "reminder";
  onAccept: () => void;
  onDismiss: () => void;
};

const COPY: Record<
  DisclosureKind,
  { title: string; body: string; reminderBody: string; cta: string }
> = {
  location: {
    title: "Location Usage",
    body:
      "Met collects location data to find people you've encountered nearby, even when the app is closed or not in use. This data is used solely to match you with others you've physically crossed paths with — your exact location is never shared with anyone.",
    reminderBody:
      "Location is currently off, so Met can't detect anyone you cross paths with. Met uses your location only to match you with people you've physically met — your exact location is never shared.",
    cta: "Accept & Continue",
  },
  bluetooth: {
    title: "Bluetooth Usage",
    body:
      "Met uses Bluetooth to detect nearby Met users without revealing your identity, including while the app is in the background. Your phone broadcasts a tiny anonymous beacon that other Met phones can spot — no personal data is ever sent over Bluetooth.",
    reminderBody:
      "Bluetooth is currently off, so Met can't spot nearby people in real time. Met only uses Bluetooth to send and receive an anonymous beacon — no personal data is exchanged.",
    cta: "Accept & Continue",
  },
};

export function PermissionDisclosureDialog({
  visible,
  kind,
  mode,
  onAccept,
  onDismiss,
}: Props) {
  const colors = useColors();
  const copy = COPY[kind];
  const body = mode === "reminder" ? copy.reminderBody : copy.body;
  const cta = mode === "reminder" ? "Open Settings" : copy.cta;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: "#DCFCE7" },
            ]}
          >
            {kind === "location" ? (
              <Feather name="map-pin" size={28} color={colors.primary} />
            ) : (
              <MaterialCommunityIcons
                name="bluetooth"
                size={28}
                color={colors.primary}
              />
            )}
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {copy.title}
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {body}
          </Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onDismiss}
              hitSlop={8}
              style={({ pressed }) => [
                styles.btnGhost,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text
                style={[styles.btnGhostText, { color: colors.mutedForeground }]}
              >
                Not Now
              </Text>
            </Pressable>
            <Pressable
              onPress={onAccept}
              hitSlop={8}
              style={({ pressed }) => [
                styles.btnPrimary,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={styles.btnPrimaryText}>{cta}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 19,
    textAlign: "center",
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    alignSelf: "stretch",
    gap: 10,
    marginTop: 6,
  },
  btnGhost: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhostText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  btnPrimary: {
    flex: 1.4,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },
});
