import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
} from "react-native-reanimated";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useHasUnreadChats } from "@/hooks/useHasUnreadChats";
import { useSessionCount } from "@/hooks/useSessionCount";
import { useT } from "@/lib/i18n";
import {
  dismissDiscoveryHints,
  initDiscoveryState,
  isDiscoveryDismissedSync,
  subscribeDiscovery,
} from "@/lib/discoveryHints";

function ChatTabIcon({ color }: { color: string }) {
  const { authedUid } = useApp();
  const colors = useColors();
  const hasUnread = useHasUnreadChats(authedUid);
  return (
    <View>
      <Feather name="message-circle" size={22} color={color} />
      {hasUnread && (
        <View
          style={[styles.unreadDot, { backgroundColor: colors.primary }]}
        />
      )}
    </View>
  );
}

function HomeTabIcon({ color }: { color: string }) {
  const sessionCount = useSessionCount();
  const colors = useColors();
  const [discoveryDismissed, setDiscoveryDismissed] = useState(
    isDiscoveryDismissedSync,
  );

  useEffect(() => {
    initDiscoveryState().then(() => {
      if (isDiscoveryDismissedSync()) setDiscoveryDismissed(true);
    }).catch(() => {});
    return subscribeDiscovery(() => setDiscoveryDismissed(true));
  }, []);

  const showPulse =
    !discoveryDismissed && sessionCount > 0 && sessionCount <= 3;

  const scaleAnim = useSharedValue(1);
  const opacityAnim = useSharedValue(0.6);

  useEffect(() => {
    if (!showPulse) {
      cancelAnimation(scaleAnim);
      cancelAnimation(opacityAnim);
      scaleAnim.value = 1;
      opacityAnim.value = 0.6;
      return;
    }
    scaleAnim.value = withRepeat(
      withSpring(1.7, { damping: 10, stiffness: 60 }),
      -1,
      true,
    );
    opacityAnim.value = withRepeat(
      withSpring(0, { damping: 20, stiffness: 80 }),
      -1,
      true,
    );
  }, [showPulse, scaleAnim, opacityAnim]);

  const pulseAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
    opacity: opacityAnim.value,
  }));

  return (
    <View style={styles.tabIconWrap}>
      {showPulse && (
        <Animated.View
          style={[styles.pulseRing, { borderColor: colors.primary }, pulseAnimStyle]}
          pointerEvents="none"
        />
      )}
      <Feather name="home" size={22} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const isWeb = Platform.OS === "web";
  const { t } = useT();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 9,
          marginTop: 2,
          letterSpacing: 1.4,
          textTransform: "uppercase",
        },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () => (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          // HomeTabIcon shows the pulsing discovery ring; tapping the tab
          // permanently dismisses both the ring and the HubStatusBadge tooltip.
          tabBarIcon: ({ color }) => <HomeTabIcon color={color} />,
        }}
        listeners={{
          tabPress: () => {
            dismissDiscoveryHints();
          },
        }}
      />
      <Tabs.Screen
        name="recent"
        options={{
          title: t("tabs.recent"),
          tabBarIcon: ({ color }) => (
            <Feather name="users" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="connections"
        options={{
          title: t("tabs.connections"),
          tabBarIcon: ({ color }) => <ChatTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="networks"
        options={{
          title: t("tabs.networks"),
          tabBarIcon: ({ color }) => (
            <Feather name="globe" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color }) => (
            <Feather name="user" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  unreadDot: {
    position: "absolute",
    top: -1,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tabIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
  },
  pulseRing: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
  },
});
