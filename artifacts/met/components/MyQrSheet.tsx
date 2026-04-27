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
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { TierBadge } from "@/components/TierBadge";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { useSubscription } from "@/lib/revenuecat";
import type { Profile } from "@/lib/types";

type Props = {
  visible: boolean;
  onClose: () => void;
  profile: Profile;
};

export function MyQrSheet({ visible, onClose, profile }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webBot = Platform.OS === "web" ? 34 : 0;
  const { t } = useT();
  const { tier } = useSubscription();

  const payload = JSON.stringify({
    v: 1,
    type: "met.user",
    id: profile.id,
    name: profile.name,
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + webBot + 24,
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={{ width: 28 }} />
            <Text style={[styles.title, { color: colors.foreground }]}>
              {t("myQr.titleSheet")}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={24} color={colors.foreground} />
            </Pressable>
          </View>

          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {t("myQr.subSheet")}
          </Text>

          <View style={styles.identity}>
            <Avatar uri={profile.photoUri} size={72} ring />
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.foreground }]}>
                {profile.name}
              </Text>
              <TierBadge tier={tier} size="md" />
            </View>
            {profile.bio ? (
              <Text style={[styles.bio, { color: colors.mutedForeground }]}>
                {profile.bio}
              </Text>
            ) : null}
          </View>

          <View
            style={[
              styles.qrFrame,
              { borderColor: colors.border, backgroundColor: "#FFFFFF" },
            ]}
          >
            <QRCode
              value={payload}
              size={220}
              color="#16161E"
              backgroundColor="#FFFFFF"
            />
          </View>

          <Text style={[styles.tip, { color: colors.mutedForeground }]}>
            {t("myQr.tip")}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    paddingHorizontal: 24,
    paddingTop: 10,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    alignItems: "center",
    gap: 18,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 18 },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 320,
  },
  identity: {
    alignItems: "center",
    gap: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: { fontFamily: "Inter_700Bold", fontSize: 18 },
  bio: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    maxWidth: 280,
  },
  qrFrame: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
  },
  tip: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
  },
});
