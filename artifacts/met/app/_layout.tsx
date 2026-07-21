import React, { useEffect } from "react";
import { View, Text } from "react-native";

// Startup breadcrumb logger (build 221)
const _SLOG_URL =
  (process.env.EXPO_PUBLIC_API_URL ?? "https://metapp.replit.app") +
  "/api/debug/startup";
const _SLOG_BUILD = "221";
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
    <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "#fff", fontSize: 20 }}>
        Build 221 — zero native imports
      </Text>
    </View>
  );
}
