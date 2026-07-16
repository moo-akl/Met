import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useT } from "@/lib/i18n";

const PIONEER_MODAL_SEEN_KEY = "met:pioneer_modal_seen:v1";

export async function loadPioneerModalSeen(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PIONEER_MODAL_SEEN_KEY);
  return raw === "1";
}

export async function savePioneerModalSeen(): Promise<void> {
  await AsyncStorage.setItem(PIONEER_MODAL_SEEN_KEY, "1");
}

const SLIDE_ICONS: ("award" | "zap" | "gift")[] = ["award", "zap", "gift"];
const SLIDE_COUNT = 3;

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function PioneerModal({ visible, onClose }: Props) {
  const { t } = useT();
  const [page, setPage] = useState(0);

  const isLast = page === SLIDE_COUNT - 1;
  const isFirst = page === 0;
  const icon = SLIDE_ICONS[page]!;

  const slides = [
    { title: t("pioneer.slide1Title"), body: t("pioneer.slide1Body") },
    { title: t("pioneer.slide2Title"), body: t("pioneer.slide2Body") },
    { title: t("pioneer.slide3Title"), body: t("pioneer.slide3Body") },
  ];
  const slide = slides[page]!;

  const handleNext = () => {
    if (isLast) {
      void savePioneerModalSeen();
      onClose();
    } else {
      setPage((p) => p + 1);
    }
  };

  const handleBack = () => {
    if (!isFirst) setPage((p) => p - 1);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <LinearGradient
            colors={["#1a0a00", "#2d1800"]}
            style={styles.headerGradient}
          >
            <View style={styles.iconRing}>
              <Feather name={icon} size={28} color="#FFD700" />
            </View>
            <Text style={styles.headerLabel}>{t("pioneer.modalTitle")}</Text>
          </LinearGradient>

          <View style={styles.body}>
            <Text style={styles.partTitle}>{slide.title}</Text>
            <Text style={styles.partBody}>{slide.body}</Text>
          </View>

          <View style={styles.dots}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === page && styles.dotActive]}
              />
            ))}
          </View>

          <View style={styles.btnRow}>
            {!isFirst ? (
              <Pressable onPress={handleBack} style={styles.backBtn}>
                <Feather name="arrow-left" size={16} color="#D4AF37" />
                <Text style={styles.backBtnText}>{t("pioneer.back")}</Text>
              </Pressable>
            ) : (
              <View style={styles.backBtnPlaceholder} />
            )}

            <Pressable onPress={handleNext} style={styles.btn}>
              <LinearGradient
                colors={["#D4AF37", "#FFD700", "#D4AF37"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>
                  {isLast ? t("pioneer.gotIt") : t("pioneer.next")}
                </Text>
                <Feather
                  name={isLast ? "check" : "arrow-right"}
                  size={16}
                  color="#1a0a00"
                />
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    backgroundColor: "#0e0e0e",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#3d2e00",
  },
  headerGradient: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 24,
    gap: 14,
  },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,215,0,0.12)",
    borderWidth: 1.5,
    borderColor: "#D4AF37",
    alignItems: "center",
    justifyContent: "center",
  },
  headerLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 2.5,
    color: "#D4AF37",
    textTransform: "uppercase",
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 10,
    minHeight: 140,
  },
  partTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: "#FFFFFF",
    textAlign: "center",
  },
  partBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
    color: "#B0B0B0",
    textAlign: "center",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#3d2e00",
  },
  dotActive: {
    width: 18,
    backgroundColor: "#D4AF37",
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#D4AF37",
  },
  backBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#D4AF37",
  },
  backBtnPlaceholder: {
    width: 80,
  },
  btn: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  btnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  btnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#1a0a00",
  },
});
