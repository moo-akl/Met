import React from "react";
import { View, Text } from "react-native";

export default function DebugScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "#fff", fontSize: 20 }}>Build 220 — no components</Text>
    </View>
  );
}
