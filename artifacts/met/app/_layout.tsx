import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

SplashScreen.preventAutoHideAsync();

// Startup breadcrumb logger (build 219)
const _SLOG_URL =
  (process.env.EXPO_PUBLIC_API_URL ?? "https://metapp.replit.app") +
  "/api/debug/startup";
const _SLOG_BUILD = "219";
function slog(step: string, data?: Record<string, unknown>): void {
  try {
    fetch(_SLOG_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, build: _SLOG_BUILD, data }),
    }).catch(() => {});
  } catch {}
}
slog("module-start");

export default function RootLayout() {
  slog("root-layout-render");
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    slog("root-layout-mounted");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#000" },
          }}
        >
          <Stack.Screen name="(tabs)" />
        </Stack>
        <View
          style={{
            position: "absolute",
            bottom: 40,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 14 }}>
            Build 219 — minimal layout test
          </Text>
        </View>
      </View>
    </SafeAreaProvider>
  );
}
