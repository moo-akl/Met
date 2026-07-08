import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useHasUnreadChats } from "@/hooks/useHasUnreadChats";
import { useT } from "@/lib/i18n";

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
          tabBarIcon: ({ color }) => (
            <Feather name="home" size={22} color={color} />
          ),
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
});
