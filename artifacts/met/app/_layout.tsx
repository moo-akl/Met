import React from "react";
import { View, Text } from "react-native";

// Stub for onboarding.tsx which imports this from _layout
let pendingDeepLinkReferral: string | null = null;
export function consumePendingReferral(): string | null {
  const v = pendingDeepLinkReferral;
  pendingDeepLinkReferral = null;
  return v;
}

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "#fff", fontSize: 20 }}>
        Build 222 — zero fetch, zero native imports
      </Text>
    </View>
  );
}
