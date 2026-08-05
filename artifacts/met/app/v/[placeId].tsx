/**
 * /v/[placeId]  — Venue QR check-in deep link entry point
 *
 * This screen is opened when a user scans a venue's printed QR code.
 * The URL shape is:  https://metapp.replit.app/v/<placeId>?t=<qrToken>
 *
 * It immediately redirects to the full venue profile screen so the user
 * lands on a rich page showing the venue's details. The `t` (token)
 * parameter is forwarded so downstream screens can validate the check-in.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export default function VenueQrEntryScreen() {
  const { placeId, t } = useLocalSearchParams<{ placeId: string; t?: string }>();
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    if (!placeId) return;
    // Replace this entry screen with the full venue profile so the user
    // sees venue info immediately and the back stack stays clean.
    router.replace({
      pathname: "/venue/[placeId]",
      params: { placeId, qrToken: t ?? "" },
    } as never);
  }, [placeId, t, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
