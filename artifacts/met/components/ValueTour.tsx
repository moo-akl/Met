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
// Slide 4: Check-in / Places
// ---------------------------------------------------------------------------
function CheckinScene({ color }: { color: string }) {
  const pinScale = useRef(new Animated.Value(0)).current;
  const pinBounce = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(pinScale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 7 }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pinBounce, { toValue: -8, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(pinBounce, { toValue: 0, duration: 350, easing: Easing.in(Easing.ease), useNativeDriver: true }),
          Animated.delay(800),
        ]),
        { iterations: 3 },
      ),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ring1, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.timing(ring1, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(ring2, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(ring2, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    ).start();
    setTimeout(() => {
      Animated.spring(badgeScale, { toValue: 1, useNativeDriver: true, tension: 180, friction: 7 }).start();
    }, 900);
    return () => {
      pinScale.stopAnimation();
      pinBounce.stopAnimation();
      ring1.stopAnimation();
      ring2.stopAnimation();
      badgeScale.stopAnimation();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.sceneContainer}>
      {/* Ripple rings */}
      {[ring1, ring2].map((anim, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            width: 130,
            height: 130,
            borderRadius: 65,
            borderWidth: 2,
            borderColor: color + "50",
            opacity: anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.7, 0] }),
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
          }}
        />
      ))}
      {/* Map pin */}
      <Animated.View style={{ alignItems: "center", transform: [{ scale: pinScale }, { translateY: pinBounce }] }}>
        <View style={[styles.checkinPin, { backgroundColor: color }]}>
          <Feather name="map-pin" size={26} color="#fff" />
        </View>
        <View style={[styles.checkinPinTip, { backgroundColor: color }]} />
      </Animated.View>
      {/* Points badge */}
      <Animated.View
        style={[
          styles.checkinBadge,
          { backgroundColor: color, transform: [{ scale: badgeScale }] },
        ]}
      >
        <Text style={styles.checkinBadgeText}>+50 pts</Text>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Slide 5: Heatmap
// ---------------------------------------------------------------------------
function HeatmapScene({ color }: { color: string }) {
  const dots = useMemo(
    () =>
      [
        { x: 60, y: 55, size: 38, opacity: 0.85, delay: 0 },
        { x: 95, y: 40, size: 28, opacity: 0.65, delay: 120 },
        { x: 115, y: 70, size: 34, opacity: 0.75, delay: 200 },
        { x: 75, y: 90, size: 24, opacity: 0.55, delay: 80 },
        { x: 45, y: 80, size: 20, opacity: 0.45, delay: 160 },
        { x: 130, y: 50, size: 18, opacity: 0.4, delay: 240 },
        { x: 50, y: 115, size: 22, opacity: 0.5, delay: 300 },
        { x: 105, y: 108, size: 30, opacity: 0.6, delay: 180 },
      ].map((d) => ({ ...d, anim: new Animated.Value(0) })),
    [],
  );
  const pulseAnims = useMemo(() => dots.map(() => new Animated.Value(0.7)), [dots]);

  useEffect(() => {
    dots.forEach((d, i) => {
      Animated.sequence([
        Animated.delay(d.delay),
        Animated.timing(d.anim, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
      Animated.loop(
        Animated.sequence([
          Animated.delay(d.delay + 400),
          Animated.timing(pulseAnims[i], { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnims[i], { toValue: 0.7, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ).start();
    });
    return () => {
      dots.forEach((d) => d.anim.stopAnimation());
      pulseAnims.forEach((a) => a.stopAnimation());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[styles.heatmapCanvas]}>
      {/* Grid lines */}
      {[30, 60, 90, 120].map((y) => (
        <View key={`h${y}`} style={[styles.heatmapGridLine, { top: y, width: "100%" }]} />
      ))}
      {[40, 80, 120].map((x) => (
        <View key={`v${x}`} style={[styles.heatmapGridLineV, { left: x, height: "100%" }]} />
      ))}
      {/* Heat blobs */}
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: d.x - d.size / 2,
            top: d.y - d.size / 2,
            width: d.size,
            height: d.size,
            borderRadius: d.size / 2,
            backgroundColor: color,
            opacity: d.anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, d.opacity],
            }),
            transform: [
              {
                scale: Animated.multiply(
                  d.anim,
                  pulseAnims[i],
                ),
              },
            ],
          }}
        />
      ))}
      {/* "You are here" dot */}
      <View style={[styles.heatmapYou, { borderColor: color }]}>
        <View style={[styles.heatmapYouInner, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Slide 6: Trust Score
// ---------------------------------------------------------------------------
function TrustScene({ color }: { color: string }) {
  const arcProgress = useRef(new Animated.Value(0)).current;
  const scoreOpacity = useRef(new Animated.Value(0)).current;
  const scoreScale = useRef(new Animated.Value(0.5)).current;
  const badgeScales = useMemo(() => [0, 1, 2].map(() => new Animated.Value(0)), []);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(arcProgress, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.parallel([
        Animated.spring(scoreScale, { toValue: 1, useNativeDriver: true, tension: 180, friction: 7 }),
        Animated.timing(scoreOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start(() => {
      Animated.stagger(150, badgeScales.map((s) =>
        Animated.spring(s, { toValue: 1, useNativeDriver: true, tension: 200, friction: 7 }),
      )).start();
    });
    return () => {
      arcProgress.stopAnimation();
      scoreOpacity.stopAnimation();
      scoreScale.stopAnimation();
      badgeScales.forEach((s) => s.stopAnimation());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const badges = [
    { label: "Encounters", icon: "users" as const, color: "#60A5FA" },
    { label: "Reveals", icon: "eye" as const, color: "#34D399" },
    { label: "Check-ins", icon: "map-pin" as const, color: "#FBBF24" },
  ];

  return (
    <View style={styles.sceneContainer}>
      {/* Arc gauge */}
      <View style={styles.trustGaugeWrap}>
        {/* Background track */}
        <View style={[styles.trustTrack, { borderColor: color + "25" }]} />
        {/* Filled arc approximation using segments */}
        {Array.from({ length: 18 }).map((_, i) => {
          const angle = -200 + i * 22;
          const filled = arcProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 18],
          });
          return (
            <Animated.View
              key={i}
              style={{
                position: "absolute",
                width: 6,
                height: 14,
                borderRadius: 3,
                backgroundColor: color,
                opacity: filled.interpolate({
                  inputRange: [i - 0.3, i + 0.3],
                  outputRange: [0, 1],
                  extrapolate: "clamp",
                }),
                transform: [
                  { rotate: `${angle}deg` },
                  { translateY: -52 },
                ],
              }}
            />
          );
        })}
        {/* Score number */}
        <Animated.View style={{ opacity: scoreOpacity, transform: [{ scale: scoreScale }], alignItems: "center" }}>
          <Text style={[styles.trustScore, { color: color }]}>87</Text>
          <Text style={[styles.trustLabel, { color: color + "99" }]}>trust score</Text>
        </Animated.View>
      </View>
      {/* Badges */}
      <View style={styles.trustBadgeRow}>
        {badges.map((b, i) => (
          <Animated.View
            key={b.label}
            style={[styles.trustBadge, { backgroundColor: b.color + "20", borderColor: b.color + "50", transform: [{ scale: badgeScales[i] }] }]}
          >
            <Feather name={b.icon} size={13} color={b.color} />
            <Text style={[styles.trustBadgeText, { color: b.color }]}>{b.label}</Text>
          </Animated.View>
        ))}
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
    {
      titleKey: "valueTour.slide4Title",
      subKey: "valueTour.slide4Sub",
      scene: <CheckinScene color={colors.primary} />,
    },
    {
      titleKey: "valueTour.slide5Title",
      subKey: "valueTour.slide5Sub",
      scene: <HeatmapScene color={colors.primary} />,
    },
    {
      titleKey: "valueTour.slide6Title",
      subKey: "valueTour.slide6Sub",
      scene: <TrustScene color={colors.primary} />,
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

  // Slide 4 – Check-in
  checkinPin: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  checkinPinTip: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: -6,
    transform: [{ scaleY: 0.5 }],
  },
  checkinBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  checkinBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#fff",
  },

  // Slide 5 – Heatmap
  heatmapCanvas: {
    width: 170,
    height: 150,
    borderRadius: 14,
    backgroundColor: "#0f172a",
    overflow: "hidden",
    position: "relative",
  },
  heatmapGridLine: {
    position: "absolute",
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  heatmapGridLineV: {
    position: "absolute",
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  heatmapYou: {
    position: "absolute",
    bottom: 18,
    right: 22,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  heatmapYouInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Slide 6 – Trust Score
  trustGaugeWrap: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  trustTrack: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
  },
  trustScore: {
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    textAlign: "center",
  },
  trustLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  trustBadgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  trustBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
  },
});
