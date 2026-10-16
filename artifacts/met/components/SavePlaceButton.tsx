import React from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { useColors } from "@/hooks/useColors";

export function SavePlaceButton({ placeId, placeName = "this venue", disabled = false }: { placeId: string; placeName?: string; disabled?: boolean }) {
  const colors = useColors();
  const saved = useSavedPlaces(!disabled);
  if (disabled) return null; // Screenshot/demo fixtures must never write.
  const selected = saved.data?.some((p) => p.placeId === placeId) ?? false;
  const busy = saved.pending || (saved.signedIn && saved.isLoading);
  const label = saved.isError ? "Retry saved state" : selected ? "Saved" : "Save";
  return (
    <Pressable
      testID={`save-place-${placeId}`}
      accessibilityRole="button"
      accessibilityLabel={saved.isError ? label : `${selected ? "Unsave" : "Save"} ${placeName}`}
      accessibilityState={{ selected, disabled: busy, busy }}
      disabled={busy}
      onPress={() => saved.toggle(placeId)}
      style={{ minHeight: 44, minWidth: 72, padding: 10, flexDirection: "row", alignItems: "center", gap: 6 }}
    >
      {busy ? <ActivityIndicator size="small" color={colors.text} /> : <Feather name={selected ? "check" : "bookmark"} size={19} color={colors.text} />}
      <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
