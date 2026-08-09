import { Feather } from "@expo/vector-icons";
import { Image } from "@/components/MetImage";
import { LinearGradient } from "@/components/MetGradient";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import type { Profile } from "@/lib/types";

type Props = {
  visible: boolean;
  onClose: () => void;
  profile: Profile;
};

export function ShareCardSheet({ visible, onClose, profile }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const payload = JSON.stringify({
    v: 1,
    type: "met.user",
    id: profile.id,
    name: profile.name,
  });

  const handleShare = async () => {
    setSharing(true);
    try {
      if (Platform.OS !== "web" && cardRef.current) {
        const ViewShot = await import("react-native-view-shot").catch(() => null);
        if (ViewShot) {
          const uri: string = await ViewShot.captureRef(cardRef, {
            format: "png",
            quality: 1.0,
            result: "tmpfile",
          });
          const Sharing = await import("expo-sharing").catch(() => null);
          if (Sharing) {
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
              await Sharing.shareAsync(uri, {
                mimeType: "image/png",
                dialogTitle: t("shareCard.title"),
              });
              return;
            }
          }
        }
      }
      await Share.share({
        message: `${profile.name} is on Met — a quiet way to connect with people you cross paths with. Find them nearby!`,
      });
    } catch {
      // User cancelled or error — no-op
    } finally {
      setSharing(false);
    }
  };

  const webBot = Platform.OS === "web" ? 34 : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + webBot + 24,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />

          <View style={styles.headerRow}>
            <View style={{ width: 28 }} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              {t("shareCard.title")}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={24} color={colors.foreground} />
            </Pressable>
          </View>

          <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
            {t("shareCard.sub")}
          </Text>

          {/* Card that gets captured as an image when the user shares */}
          <View ref={cardRef} collapsable={false} style={styles.card}>
            <LinearGradient
              colors={["#1A7D2E", "#5BB649"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGradient}
            >
              <Text style={styles.cardBrand}>MET</Text>

              {profile.photoUri ? (
                <Image
                  source={{ uri: profile.photoUri }}
                  style={styles.cardPhoto}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.cardPhoto, styles.cardPhotoPlaceholder]}>
                  <Text style={styles.cardPhotoInitial}>
                    {profile.name?.trim().charAt(0).toUpperCase() ?? "?"}
                  </Text>
                </View>
              )}

              <Text style={styles.cardName} numberOfLines={1}>
                {profile.name}
              </Text>

              {profile.bio ? (
                <Text style={styles.cardBio} numberOfLines={2}>
                  {profile.bio}
                </Text>
              ) : null}

              <View style={styles.cardQrFrame}>
                <QRCode
                  value={payload}
                  size={120}
                  color="#16161E"
                  backgroundColor="#FFFFFF"
                />
              </View>

              <Text style={styles.cardTagline}>{t("shareCard.tagline")}</Text>
            </LinearGradient>
          </View>

          <Pressable
            onPress={handleShare}
            disabled={sharing}
            style={({ pressed }) => [
              styles.shareBtn,
              { backgroundColor: colors.primary, opacity: pressed || sharing ? 0.8 : 1 },
            ]}
            accessibilityLabel={t("shareCard.shareAction")}
          >
            {sharing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Feather name="share-2" size={18} color="#FFFFFF" />
                <Text style={styles.shareBtnText}>{t("shareCard.shareAction")}</Text>
              </>
            )}
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    paddingHorizontal: 24,
    paddingTop: 10,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    alignItems: "center",
    gap: 16,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  sheetSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 300,
  },
  card: {
    width: 300,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  cardGradient: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 26,
    paddingHorizontal: 24,
    gap: 10,
  },
  cardBrand: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 5,
    marginBottom: 4,
  },
  cardPhoto: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.55)",
  },
  cardPhotoPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardPhotoInitial: {
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    color: "#FFFFFF",
  },
  cardName: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#FFFFFF",
    textAlign: "center",
  },
  cardBio: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 240,
  },
  cardQrFrame: {
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderRadius: 14,
    marginTop: 4,
  },
  cardTagline: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.4,
    marginTop: 2,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    width: "100%",
    minHeight: 52,
  },
  shareBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});
