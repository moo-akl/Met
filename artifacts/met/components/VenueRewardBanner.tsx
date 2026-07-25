/**
 * VenueRewardBanner
 *
 * Shown at the top of LeaderboardScreen when the venue has an active reward campaign.
 * Displays prize info, end date countdown, and a CTA linking to the venue profile.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";

export interface ActiveReward {
  id: number;
  placeId: string;
  title: string;
  prizeDescription: string;
  rewardType: string;
  endDate: string;
}

interface Props {
  reward: ActiveReward;
}

function useCountdown(endDateIso: string): string {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endDateIso).getTime() - Date.now();
      if (diff <= 0) {
        setLabel("Ended");
        return;
      }
      const days = Math.floor(diff / 86_400_000);
      const hours = Math.floor((diff % 86_400_000) / 3_600_000);
      const mins = Math.floor((diff % 3_600_000) / 60_000);
      if (days > 0) setLabel(`${days}d ${hours}h left`);
      else if (hours > 0) setLabel(`${hours}h ${mins}m left`);
      else setLabel(`${mins}m left`);
    };
    calc();
    const id = setInterval(calc, 30_000);
    return () => clearInterval(id);
  }, [endDateIso]);

  return label;
}

const REWARD_TYPE_ICON: Record<string, string> = {
  free_drink: "🍹",
  discount: "💸",
  experience: "✨",
  custom: "🎁",
};

export function VenueRewardBanner({ reward }: Props) {
  const colors = useColors();
  const router = useRouter();
  const countdown = useCountdown(reward.endDate);

  // Shimmer animation
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  const shimmerOpacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  const icon = REWARD_TYPE_ICON[reward.rewardType] ?? "🎁";

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/venue/[placeId]", params: { placeId: reward.placeId } } as never)
      }
      accessibilityRole="button"
      accessibilityLabel={`Active reward: ${reward.title}. Tap to view venue.`}
    >
      <Animated.View
        style={[
          styles.banner,
          { borderColor: colors.primary + "60", opacity: shimmerOpacity },
        ]}
      >
        {/* Gold glow border */}
        <View style={[styles.accentBar, { backgroundColor: "#FFD700" }]} />

        <View style={styles.inner}>
          <Text style={styles.icon}>{icon}</Text>
          <View style={styles.textCol}>
            <Text style={styles.label}>Active Reward</Text>
            <Text numberOfLines={1} style={styles.title}>
              {reward.title}
            </Text>
            <Text numberOfLines={1} style={[styles.prize, { color: "#FFD700" }]}>
              {reward.prizeDescription}
            </Text>
          </View>
          <View style={styles.right}>
            <Text style={[styles.countdown, { color: colors.primary }]}>{countdown}</Text>
            <Text style={styles.cta}>View →</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#1A1A1E",
    overflow: "hidden",
    flexDirection: "row",
  },
  accentBar: {
    width: 4,
  },
  inner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  icon: {
    fontSize: 28,
  },
  textCol: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.92)",
    marginBottom: 2,
  },
  prize: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  right: {
    alignItems: "flex-end",
    gap: 4,
  },
  countdown: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  cta: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.5)",
  },
});
