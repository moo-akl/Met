import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { venueCategoryVisuals, type VenueCategory } from "@/lib/venueCategories";

export function VenueCategoryPicker({ value, onChange }: {
  value: VenueCategory;
  onChange: (value: VenueCategory) => void;
}) {
  const colors = useColors();
  return <View style={styles.container}>
    <Text style={[styles.label, { color: colors.foreground }]}>Venue type</Text>
    <Text style={[styles.help, { color: colors.foreground }]}>
      Suggested by Google when available. Choose the best match to change your map icon.
    </Text>
    <View style={styles.options}>
      {(Object.entries(venueCategoryVisuals) as [VenueCategory, { label: string }][]).map(([category, visual]) =>
        <Pressable key={category} onPress={() => onChange(category)}
          accessibilityRole="radio" accessibilityState={{ checked: value === category }}
          style={[styles.option, { borderColor: value === category ? colors.primary : colors.border, backgroundColor: colors.muted }]}>
          <Text style={{ color: value === category ? colors.primary : colors.foreground }}>{visual.label}</Text>
        </Pressable>,
      )}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  help: { fontSize: 12, opacity: 0.65, marginBottom: 12 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderRadius: 10 },
});
