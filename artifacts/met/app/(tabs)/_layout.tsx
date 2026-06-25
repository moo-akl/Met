import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";

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
          fontFamily: "Inter_500Medium",
          fontSize: 11,
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.card },
            ]}
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
          tabBarIcon: ({ color }) => (
            <Feather name="message-circle" size={22} color={color} />
          ),
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
