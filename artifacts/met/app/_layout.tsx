import { Stack } from "expo-router";
import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Startup breadcrumb logger (build 220)
const _SLOG_URL =
  (process.env.EXPO_PUBLIC_API_URL ?? "https://metapp.replit.app") +
  "/api/debug/startup";
const _SLOG_BUILD = "220";
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

// Stub for onboarding.tsx which imports this from _layout
let pendingDeepLinkReferral: string | null = null;
export function consumePendingReferral(): string | null {
  const v = pendingDeepLinkReferral;
  pendingDeepLinkReferral = null;
  return v;
}

export default function RootLayout() {
  slog("root-layout-render");

  useEffect(() => {
    slog("root-layout-mounted");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#000" },
          }}
        >
          <Stack.Screen name="debug-only" />
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
            Build 220 — no fonts / no splash / debug-only route
          </Text>
        </View>
      </View>
    </SafeAreaProvider>
  );
}
