import React from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { SavePlaceButton } from "@/components/SavePlaceButton";

export default function SavedPlacesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const saved = useSavedPlaces();
  const goBack = () => router.canGoBack() ? router.back() : router.replace("/(tabs)");
  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={styles.back}>
          <Feather name="arrow-left" size={23} color={colors.text} />
        </Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Saved places</Text>
      </View>
      <Text style={[styles.caption, { color: colors.mutedForeground }]}>Your favorite places, ready for another visit. Saving a place doesn’t check you in.</Text>
      {!saved.signedIn ? (
        <Text style={[styles.message, { color: colors.text }]}>Sign in to see your saved places.</Text>
      ) : saved.isLoading ? (
        <ActivityIndicator accessibilityLabel="Loading saved places" color={colors.primary} />
      ) : saved.isError ? (
        <View style={styles.message}>
          <Text accessibilityRole="alert" style={{ color: colors.text }}>Couldn’t load your saved places.</Text>
          <Pressable accessibilityRole="button" onPress={() => void saved.refetch()} style={styles.back}>
            <Text style={{ color: colors.text }}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={saved.data ?? []}
          keyExtractor={(place) => place.placeId}
          refreshing={saved.isRefetching}
          onRefresh={() => void saved.refetch()}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
          ListEmptyComponent={
            <View style={styles.message}>
              <Feather name="bookmark" size={32} color={colors.primary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Keep a place for later</Text>
              <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>Tap Save on a venue to find it here.</Text>
              <Pressable onPress={() => router.replace("/(tabs)")} accessibilityRole="button" style={styles.back}>
                <Text style={{ color: colors.text }}>Explore places</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.available ? `Open ${item.placeName}` : `${item.placeName}, currently unavailable`}
                accessibilityState={{ disabled: !item.available }}
                disabled={!item.available}
                onPress={() => router.push({ pathname: "/venue/[placeId]", params: { placeId: item.placeId } })}
                style={styles.place}
              >
                <Text style={[styles.name, { color: colors.text }]}>{item.placeName}</Text>
                <Text style={{ color: colors.mutedForeground }}>{item.available ? "View place" : "Currently unavailable"}</Text>
              </Pressable>
              <SavePlaceButton placeId={item.placeId} placeName={item.placeName} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 },
  back: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", padding: 10 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28 },
  caption: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, lineHeight: 21 },
  message: { padding: 24, alignItems: "center", gap: 12, textAlign: "center" },
  emptyTitle: { fontSize: 21, fontFamily: "Inter_600SemiBold" },
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 20, padding: 8, marginBottom: 12 },
  place: { flex: 1, padding: 10, minHeight: 64, gap: 6 },
  name: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
});
