import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { openVenueManager as openVenueManagerLink } from "@/lib/venueManagerLink";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";

export function VenueManagerHandoff() {
  const colors = useColors();
  const router = useRouter();

  const openVenueManager = async () => {
    try {
      await openVenueManagerLink();
    } catch (error) {
      Alert.alert(
        "Venue Manager unavailable",
        error instanceof Error
          ? error.message
          : "Open Venue Manager in your browser to manage venue events.",
      );
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <VenueOwnerHeader title="Events" onBack={() => router.back()} />
      <View style={styles.content}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Feather name="calendar" size={26} color={colors.primary} />
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          Manage venue events on the web
        </Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          Create and edit public venue events in Venue Manager. Hangouts and private plans
          are still available in the app.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Venue Manager"
          testID="open-venue-manager"
          onPress={() => void openVenueManager()}
          style={[styles.button, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
            Open Venue Manager
          </Text>
          <Feather name="external-link" size={16} color={colors.primaryForeground} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  icon: {
    width: 58,
    height: 58,
    borderTopLeftRadius: 22,
    borderBottomRightRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 21,
    lineHeight: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 10,
  },
  description: {
    maxWidth: 330,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
  },
  button: {
    minHeight: 48,
    borderTopLeftRadius: 18,
    borderBottomRightRadius: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  buttonText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
