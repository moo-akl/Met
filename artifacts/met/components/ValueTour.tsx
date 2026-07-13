import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { saveValueTourSeen } from "@/lib/storage";

type SlideConfig = {
  icon: React.ComponentProps<typeof Feather>["name"];
  iconColor: string;
  iconBg: string;
  badge: string;
  titleKey: string;
  subKey: string;
};

function getSlides(primary: string): SlideConfig[] {
  return [
    {
      icon: "target",
      iconColor: "#60A5FA",
      iconBg: "rgba(96,165,250,0.15)",
      badge: "PROXIMITY",
      titleKey: "valueTour.slide1Title",
      subKey: "valueTour.slide1Sub",
    },
    {
      icon: "shield",
      iconColor: primary,
      iconBg: `${primary}22`,
      badge: "PRIVACY",
      titleKey: "valueTour.slide2Title",
      subKey: "valueTour.slide2Sub",
    },
    {
      icon: "award",
      iconColor: "#FBBF24",
      iconBg: "rgba(251,191,36,0.15)",
      badge: "COMPETE",
      titleKey: "valueTour.slide3Title",
      subKey: "valueTour.slide3Sub",
    },
  ];
}

interface Props {
  onDone: () => void;
}

export function ValueTour({ onDone }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const slides = getSlides(colors.primary);

  const [index, setIndex] = useState(0);
  const iconScale = useRef(new Animated.Value(0.7)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const animateIn = useCallback(() => {
    iconScale.setValue(0.7);
    iconOpacity.setValue(0);
    textOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(iconScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }),
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 380,
        delay: 120,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [iconScale, iconOpacity, textOpacity]);

  useEffect(() => {
    animateIn();
  }, [index, animateIn]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const handleNext = () => {
    if (index < slides.length - 1) {
      textOpacity.setValue(0);
      setIndex((i) => i + 1);
    } else {
      handleDone();
    }
  };

  const handleDone = () => {
    saveValueTourSeen().catch(() => {});
    onDone();
  };

  const slide = slides[index];
  const isLast = index === slides.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={{ width: 60 }} />
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? colors.primary : colors.border,
                  width: i === index ? 20 : 7,
                },
              ]}
            />
          ))}
        </View>
        <Pressable
          onPress={handleDone}
          hitSlop={12}
          style={({ pressed }) => ({
            opacity: pressed ? 0.6 : 1,
            width: 60,
            alignItems: "flex-end",
          })}
        >
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>
            {t("valueTour.skip")}
          </Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                borderColor: slide.iconColor + "30",
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.iconWrap,
              {
                backgroundColor: slide.iconBg,
                transform: [{ scale: iconScale }],
                opacity: iconOpacity,
              },
            ]}
          >
            <Feather name={slide.icon} size={52} color={slide.iconColor} />
          </Animated.View>
        </View>

        <Animated.View style={[styles.badgeWrap, { opacity: iconOpacity }]}>
          <View
            style={[
              styles.badge,
              {
                borderColor: slide.iconColor + "60",
                backgroundColor: slide.iconBg,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: slide.iconColor }]}>
              {slide.badge}
            </Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.textArea, { opacity: textOpacity }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t(slide.titleKey as never)}
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {t(slide.subKey as never)}
          </Text>
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 32 }]}>
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.nextBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.nextText, { color: colors.primaryForeground }]}>
            {isLast ? t("valueTour.getStarted") : t("valueTour.next")}
          </Text>
          {!isLast && (
            <Feather
              name="arrow-right"
              size={18}
              color={colors.primaryForeground}
              style={{ marginLeft: 6 }}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  skipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 160,
    height: 160,
  },
  pulseRing: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeWrap: {
    marginTop: 20,
  },
  badge: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 1.5,
  },
  textArea: {
    marginTop: 24,
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    textAlign: "center",
    lineHeight: 32,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 23,
  },
  footer: {
    paddingHorizontal: 24,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 16,
  },
  nextText: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
  },
});
