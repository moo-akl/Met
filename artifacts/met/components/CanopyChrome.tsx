import React, { useState, type ReactNode } from "react";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export function CanopyHeader({ onLanguage, onRequests, requestCount = 0 }: {
  onLanguage: () => void;
  onRequests: () => void;
  requestCount?: number;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return <View style={[s.header, { paddingTop: insets.top + 8, backgroundColor: c.background }]}>
    <View style={s.brand}>
      <Image source={require("../assets/images/icon.png")} style={s.logo} accessibilityLabel="Met" />
      <Text style={[s.wordmark, { color: c.text }]}>met</Text>
    </View>
    <View style={s.headerActions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Change language" onPress={onLanguage} style={s.iconButton}>
        <Feather name="globe" size={21} color={c.text} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Connection requests${requestCount ? `, ${requestCount} pending` : ""}`} onPress={onRequests} style={s.iconButton}>
        <Feather name="users" size={21} color={c.text} />
        {requestCount > 0 && <View style={[s.requestDot, { backgroundColor: c.primary, borderColor: c.background }]} />}
      </Pressable>
    </View>
  </View>;
}

export function CanopyVisibility({ visible, onToggle, title, subtitle }: {
  visible: boolean;
  onToggle: () => void;
  title: string;
  subtitle: string;
}) {
  const c = useColors();
  return <View style={[s.visibility, { backgroundColor: c.brandPanel }]}>
    <View style={s.radio}><Feather name={visible ? "radio" : "eye-off"} size={20} color={c.brandPanelText} /></View>
    <View style={s.visibilityCopy}>
      <Text style={[s.visibilityTitle, { color: c.brandPanelText }]}>{title}</Text>
      <Text style={[s.visibilitySub, { color: c.brandPanelText }]}>{subtitle}</Text>
    </View>
    <Switch testID="home-visibility-switch" accessibilityLabel={title} value={visible} onValueChange={onToggle} trackColor={{ false: c.mutedForeground, true: c.primary }} />
  </View>;
}

/** Resizes the existing real map instead of mounting a second polling/location instance. */
export function CanopyMapCard({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const c = useColors();
  return <View testID="home-map-card" style={[s.map, { height: expanded ? 470 : 232, borderColor: c.border, backgroundColor: c.primarySoft }]}>
    {children}
    <Pressable
      testID="home-map-expand"
      accessibilityRole="button"
      accessibilityLabel={expanded ? "Collapse map" : "Expand map"}
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((value) => !value)}
      style={[s.expand, { backgroundColor: c.card, borderColor: c.border }]}
    >
      <Feather name={expanded ? "minimize-2" : "maximize-2"} color={c.text} size={15} />
      <Text style={[s.expandText, { color: c.text }]}>{expanded ? "Close map" : "Explore map"}</Text>
    </Pressable>
    <View pointerEvents="none" style={[s.mapPrivacy, { backgroundColor: c.card }]}>
      <Feather name="shield" size={12} color={c.mutedForeground} />
      <Text style={[s.mapPrivacyText, { color: c.mutedForeground }]}>Venue activity · no live guest pins</Text>
    </View>
  </View>;
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { flexDirection: "row", gap: 8, alignItems: "center" },
  logo: { width: 29, height: 29, borderRadius: 9 },
  wordmark: { fontFamily: "Inter_700Bold", fontSize: 24, letterSpacing: -1.2 },
  headerActions: { flexDirection: "row", gap: 3 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  requestDot: { position: "absolute", right: 7, top: 7, width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  visibility: { marginHorizontal: 16, marginBottom: 9, minHeight: 68, padding: 12, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 10 },
  radio: { width: 32, alignItems: "center" },
  visibilityCopy: { flex: 1 },
  visibilityTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  visibilitySub: { fontSize: 11, lineHeight: 16, marginTop: 3, opacity: 0.85 },
  map: { marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderRadius: 20, overflow: "hidden", position: "relative" },
  expand: { position: "absolute", top: 10, right: 10, minHeight: 44, paddingHorizontal: 12, borderRadius: 15, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 7 },
  expandText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  mapPrivacy: { position: "absolute", bottom: 9, left: 9, right: 9, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, padding: 7, borderRadius: 9 },
  mapPrivacyText: { fontSize: 10, flexShrink: 1 },
});
