import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useVenueOwner } from "@/hooks/useVenueOwner";
import { resolveLifecycleRedirect } from "@/lib/venueOwnerLifecycle";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";
import { api } from "@/lib/api/client";

const VENUE_MANAGER_URL = "https://met-app.org/venue-manager/";

export default function VenueOwnerDashboardScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile: application, isLoading, error } = useVenueOwner();
  const [opening, setOpening] = useState(false);
  const [fetchingLink, setFetchingLink] = useState(false);

  useEffect(() => {
    const redirect = resolveLifecycleRedirect({
      isLoading,
      error,
      authedUid,
      application,
      currentDestination: "/venue-owner/dashboard",
    });
    if (redirect) router.replace(redirect);
  }, [isLoading, error, application, authedUid, router]);

  const openPortal = async () => {
    setOpening(true);
    try {
      await Linking.openURL(VENUE_MANAGER_URL);
    } catch {
      Alert.alert("Couldn't open Venue Manager", "Please try again in a moment.");
    } finally {
      setOpening(false);
    }
  };

  const getSetupLink = async () => {
    if (!authedUid) return;
    setFetchingLink(true);
    try {
      const { url } = await api.getMyVenueManagerRegistrationLink({ uid: authedUid });
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Couldn't get setup link",
        "We weren't able to generate your setup link. Please try again in a moment.",
      );
    } finally {
      setFetchingLink(false);
    }
  };

  if (isLoading) {
    return <View style={[styles.root, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  const showSetupCta = application?.applicationStatus === "approved" && application?.hasClaimedVenueManager === false;

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}>
      <VenueOwnerHeader title="Your venue" onBack={() => router.back()} />
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>VENUE MANAGEMENT HAS MOVED</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Run your venue from the web.</Text>
        <Text style={[styles.copy, { color: colors.mutedForeground }]}>
          Events, rewards, announcements, venue information, analytics, and team access now live in Venue Manager — a secure workspace built for your business.
        </Text>
        <Pressable disabled={opening} onPress={() => void openPortal()} style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed || opening ? 0.78 : 1 }]}>
          <Text style={styles.buttonText}>{opening ? "Opening Venue Manager…" : "Open Venue Manager"}</Text>
        </Pressable>
        {showSetupCta && (
          <Pressable
            disabled={fetchingLink}
            onPress={() => void getSetupLink()}
            style={({ pressed }) => [
              styles.setupButton,
              { borderColor: colors.border, opacity: pressed || fetchingLink ? 0.6 : 1 },
            ]}
          >
            <Text style={[styles.setupButtonText, { color: colors.foreground }]}>
              {fetchingLink ? "Getting your link…" : "Get your setup link"}
            </Text>
          </Pressable>
        )}
        <Text style={[styles.note, { color: colors.mutedForeground }]}>Sign in with the business account created during your venue migration. Your personal Met account stays separate.</Text>
      </View>
      {!showSetupCta && (
        <View style={[styles.statusCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Text style={[styles.statusTitle, { color: colors.foreground }]}>Need access?</Text>
          <Text style={[styles.statusCopy, { color: colors.mutedForeground }]}>If you have not claimed your business account yet, start the migration from Venue Manager. A venue owner can also invite managers and editors from the portal.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 14 },
  card: { borderWidth: 1, borderRadius: 18, padding: 23, marginTop: 10 },
  eyebrow: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  title: { fontSize: 27, fontFamily: "Inter_700Bold", marginTop: 13 },
  copy: { fontSize: 15, lineHeight: 23, marginTop: 12 },
  button: { borderRadius: 11, alignItems: "center", paddingVertical: 14, marginTop: 24 },
  buttonText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  setupButton: { borderWidth: 1, borderRadius: 11, alignItems: "center", paddingVertical: 12, marginTop: 10 },
  setupButtonText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  note: { fontSize: 12, lineHeight: 18, marginTop: 15 },
  statusCard: { borderWidth: 1, borderRadius: 14, padding: 17 },
  statusTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statusCopy: { fontSize: 13, lineHeight: 19, marginTop: 6 },
});
