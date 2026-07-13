import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useHasUnreadChats } from "@/hooks/useHasUnreadChats";
import { useSessionCount } from "@/hooks/useSessionCount";
import { useT } from "@/lib/i18n";
import {
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

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!showPulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.7,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [showPulse, scaleAnim, opacityAnim]);

  return (
    <View style={styles.tabIconWrap}>
      {showPulse && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              borderColor: colors.primary,
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
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
          tabBarIcon: ({ color }) => <HomeTabIcon color={color} />,
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
