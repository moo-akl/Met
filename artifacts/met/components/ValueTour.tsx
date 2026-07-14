/**
 * ValueTour — 3-slide animated onboarding tour shown once after language selection.
 *
 * Slide 1 – "See who's around you":  radar sweep with orbiting user dots
 * Slide 2 – "Compete to own your scene": animated leaderboard list + crown drop
 * Slide 3 – "Build your social footprint": growing reputation web / nodes
 *
 * valueTourSeen is persisted on FIRST MOUNT so re-opening the app mid-tour
 * never re-shows the tour.  done/skip call onDone to advance to "auth".
 */
import { Feather } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { saveInteractiveWalkthroughPending, saveValueTourSeen } from "@/lib/storage";

// ---------------------------------------------------------------------------
// Slide 1: Radar
// ---------------------------------------------------------------------------
function RadarScene({ color }: { color: string }) {
  const rings = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  const orbitAngle = useRef(new Animated.Value(0)).current;
  const dot2Angle = useRef(new Animated.Value(120)).current;
  const dot3Angle = useRef(new Animated.Value(240)).current;

  useEffect(() => {
    // Staggered radar rings
    rings.forEach((anim, i) => {
      anim.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(0),
        ]),
      );
      loop.start();
    });
    // Orbiting dots
    const orbit = Animated.loop(
      Animated.timing(orbitAngle, {
        toValue: 360,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const orbit2 = Animated.loop(
      Animated.timing(dot2Angle, {
        toValue: 120 + 360,
        duration: 4200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const orbit3 = Animated.loop(
      Animated.timing(dot3Angle, {
        toValue: 240 + 360,
        duration: 5400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    orbit.start();
    orbit2.start();
    orbit3.start();
    return () => {
      rings.forEach((a) => a.stopAnimation());
      orbitAngle.stopAnimation();
      dot2Angle.stopAnimation();
      dot3Angle.stopAnimation();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const RADIUS = 62;
  const DOT_COLORS = ["#60A5FA", "#34D399", "#F472B6"];

  function orbiterStyle(angleAnim: Animated.Value, dotColor: string) {
    const tx = angleAnim.interpolate({
      inputRange: [0, 360],
      outputRange: [0, Math.PI * 2],
    });
    // Use simple cos/sin approximation via interpolate ranges
    const angles = Array.from({ length: 37 }, (_, i) => i * 10);
    const txOut = angles.map((a) => Math.cos((a * Math.PI) / 180) * RADIUS);
    const tyOut = angles.map((a) => Math.sin((a * Math.PI) / 180) * RADIUS);
    return {
      position: "absolute" as const,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: dotColor,
      transform: [
        {
          translateX: angleAnim.interpolate({
            inputRange: angles,
            outputRange: txOut,
          }),
        },
        {
          translateY: angleAnim.interpolate({
            inputRange: angles,
            outputRange: tyOut,
          }),
        },
      ],
    };
  }

  return (
    <View style={styles.sceneContainer}>
      {/* Radar rings */}
      {rings.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.radarRing,
            {
              borderColor: color + "40",
              opacity: anim.interpolate({
                inputRange: [0, 0.3, 1],
                outputRange: [0, 0.8, 0],
              }),
              transform: [
                {
                  scale: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.15, 1],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
      {/* Orbiting user dots */}
      <Animated.View style={orbiterStyle(orbitAngle, DOT_COLORS[0])} />
      <Animated.View style={orbiterStyle(dot2Angle, DOT_COLORS[1])} />
      <Animated.View style={orbiterStyle(dot3Angle, DOT_COLORS[2])} />
      {/* Centre person icon */}
      <View style={[styles.centreBubble, { backgroundColor: color + "20" }]}>
        <Feather name="user" size={28} color={color} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Slide 2: Leaderboard with crown
// ---------------------------------------------------------------------------
function LeaderboardScene({ color }: { color: string }) {
  const rowOpacities = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  const crownY = useRef(new Animated.Value(-40)).current;
  const crownOpacity = useRef(new Animated.Value(0)).current;
  const crownScale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    // Stagger rows in, then crown drops
    Animated.stagger(180, [
      ...rowOpacities.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ),
    ]).start(() => {
      Animated.parallel([
        Animated.spring(crownY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 180,
          friction: 8,
        }),
        Animated.timing(crownOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(crownScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 180,
          friction: 8,
        }),
      ]).start();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = [
    { rank: 1, label: "You", isYou: true, streak: 7 },
    { rank: 2, label: "Alex", isYou: false, streak: 5 },
    { rank: 3, label: "Sam", isYou: false, streak: 3 },
  ];

  return (
    <View style={styles.sceneContainer}>
      <View style={styles.leaderboardCard}>
        {rows.map((row, i) => (
          <Animated.View
            key={row.rank}
            style={[
              styles.leaderRow,
              i < rows.length - 1 && styles.leaderRowBorder,
              { opacity: rowOpacities[i] },
            ]}
          >
            <Text
              style={[
                styles.leaderRank,
                { color: row.isYou ? color : "#9CA3AF" },
              ]}
            >
              #{row.rank}
            </Text>
            <Text
              style={[
                styles.leaderName,
                { color: row.isYou ? color : "#E5E7EB", fontFamily: row.isYou ? "Inter_700Bold" : "Inter_400Regular" },
              ]}
            >
              {row.label}
            </Text>
            <View style={styles.leaderStreak}>
              <Text style={styles.leaderFlame}>🔥</Text>
              <Text style={[styles.leaderStreakNum, { color: row.isYou ? color : "#9CA3AF" }]}>
                {row.streak}
              </Text>
            </View>
          </Animated.View>
        ))}
        {/* Crown drop */}
        <Animated.View
          style={[
            styles.crownWrap,
            {
              opacity: crownOpacity,
              transform: [{ translateY: crownY }, { scale: crownScale }],
            },
          ]}
        >
          <Text style={styles.crownEmoji}>👑</Text>
        </Animated.View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Slide 3: Reputation web / footprint
// ---------------------------------------------------------------------------
function ReputationScene({ color }: { color: string }) {
  const nodeScales = useMemo(
    () => Array.from({ length: 6 }, () => new Animated.Value(0)),
    [],
  );
  const lineOpacities = useMemo(
    () => Array.from({ length: 5 }, () => new Animated.Value(0)),
    [],
  );
  const badgeScale = useRef(new Animated.Value(0)).current;

  // Node positions (relative to centre 80,80 in a 160x160 canvas)
  const nodes = [
    { x: 80, y: 80 }, // centre (you)
    { x: 20, y: 30 },
    { x: 140, y: 30 },
    { x: 20, y: 130 },
    { x: 140, y: 130 },
    { x: 80, y: 155 },
  ];

  useEffect(() => {
    Animated.stagger(120, [
      ...nodeScales.map((s) =>
        Animated.spring(s, {
          toValue: 1,
          useNativeDriver: true,
          tension: 200,
          friction: 8,
        }),
      ),
    ]).start();
    Animated.stagger(100, [
      ...lineOpacities.map((o) =>
        Animated.timing(o, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ),
    ]).start(() => {
      Animated.spring(badgeScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 180,
        friction: 7,
      }).start();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cx = 80;
  const cy = 80;
  const CANVAS = 160;

  return (
    <View style={styles.sceneContainer}>
      <View style={{ width: CANVAS, height: CANVAS, position: "relative" }}>
        {/* Connection lines (View-based since SVG is not standard RN) */}
        {nodes.slice(1).map((node, i) => {
          const dx = node.x - cx;
          const dy = node.y - cy;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          return (
            <Animated.View
              key={i}
              style={[
                styles.line,
                {
                  width: len,
                  left: cx,
                  top: cy,
                  transform: [{ rotate: `${angle}deg` }],
                  backgroundColor: color + "50",
                  opacity: lineOpacities[i],
                },
              ]}
            />
          );
        })}
        {/* Outer nodes */}
        {nodes.slice(1).map((node, i) => (
          <Animated.View
            key={i}
            style={[
              styles.repNode,
              {
                left: node.x - 8,
                top: node.y - 8,
                backgroundColor: color + "30",
                borderColor: color + "80",
                transform: [{ scale: nodeScales[i + 1] }],
              },
            ]}
          />
        ))}
        {/* Centre badge */}
        <Animated.View
          style={[
            styles.repCentre,
            {
              left: cx - 20,
              top: cy - 20,
              backgroundColor: color,
              transform: [{ scale: badgeScale }],
            },
          ]}
        >
          <Feather name="star" size={20} color="#fff" />
        </Animated.View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main ValueTour
// ---------------------------------------------------------------------------
interface Props {
  onDone: () => void;
}

export function ValueTour({ onDone }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useT();

  const [index, setIndex] = useState(0);
  const textOpacity = useRef(new Animated.Value(1)).current;

  // Persist "seen" flag immediately on first mount so re-opening mid-tour
  // never re-shows the tour.
  useEffect(() => {
    saveValueTourSeen().catch(() => {});
    saveInteractiveWalkthroughPending().catch(() => {});
  }, []);

  const SLIDES = [
    {
      titleKey: "valueTour.slide1Title",
      subKey: "valueTour.slide1Sub",
      scene: <RadarScene color={colors.primary} />,
    },
    {
      titleKey: "valueTour.slide2Title",
      subKey: "valueTour.slide2Sub",
      scene: <LeaderboardScene color={colors.primary} />,
    },
    {
      titleKey: "valueTour.slide3Title",
      subKey: "valueTour.slide3Sub",
      scene: <ReputationScene color={colors.primary} />,
    },
  ];

  const handleNext = useCallback(() => {
    if (index < SLIDES.length - 1) {
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setIndex((i) => i + 1);
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      });
    } else {
      onDone();
    }
  }, [index, SLIDES.length, textOpacity, onDone]);

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top bar: dots + skip */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={{ width: 60 }} />
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
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
          onPress={onDone}
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

      {/* Scene */}
      <View style={styles.sceneArea}>{slide.scene}</View>

      {/* Text */}
      <Animated.View
        style={[styles.textArea, { opacity: textOpacity }]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>
          {t(slide.titleKey as never)}
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {t(slide.subKey as never)}
        </Text>
      </Animated.View>

      {/* CTA button */}
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
  dots: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { height: 7, borderRadius: 4 },
  skipText: { fontFamily: "Inter_500Medium", fontSize: 15 },
  sceneArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textArea: {
    paddingHorizontal: 32,
    paddingBottom: 24,
    alignItems: "center",
    gap: 10,
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
  footer: { paddingHorizontal: 24 },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 16,
  },
  nextText: { fontFamily: "Inter_700Bold", fontSize: 17 },

  // Slide 1 – Radar
  sceneContainer: {
    width: 180,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  radarRing: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
  },
  centreBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  // Slide 2 – Leaderboard
  leaderboardCard: {
    width: 220,
    borderRadius: 16,
    backgroundColor: "#1F2937",
    padding: 12,
    gap: 4,
    position: "relative",
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 10,
  },
  leaderRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#374151",
  },
  leaderRank: { fontFamily: "Inter_700Bold", fontSize: 13, width: 24 },
  leaderName: { flex: 1, fontSize: 14 },
  leaderStreak: { flexDirection: "row", alignItems: "center", gap: 2 },
  leaderFlame: { fontSize: 13 },
  leaderStreakNum: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  crownWrap: {
    position: "absolute",
    top: -22,
    left: 28,
  },
  crownEmoji: { fontSize: 22 },

  // Slide 3 – Reputation
  line: {
    position: "absolute",
    height: 2,
    transformOrigin: "0 50%",
  },
  repNode: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  repCentre: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
