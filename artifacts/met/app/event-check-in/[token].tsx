import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useCheckInEventByQr, type EventCheckinResponse } from "@workspace/api-client-react";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

export default function EventCheckInScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const validToken = TOKEN_PATTERN.test(token);
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const checkinMutation = useCheckInEventByQr();
  const startedRef = useRef(false);
  const [result, setResult] = useState<EventCheckinResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!validToken || !authedUid || startedRef.current) return;
    startedRef.current = true;
    void checkinMutation.mutateAsync({ data: { token } })
      .then(setResult)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Could not verify event attendance.");
      });
  }, [authedUid, checkinMutation.mutateAsync, token, validToken]);

  const openEvent = () => {
    if (!result) return;
    router.replace(`/event-details/${result.eventType}/${result.eventId}` as never);
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      {!validToken ? (
        <>
          <View style={[styles.iconCircle, { backgroundColor: colors.destructive + "18" }]}>
            <Feather name="x-circle" size={42} color={colors.destructive} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Invalid check-in code</Text>
          <Text style={[styles.copy, { color: colors.mutedForeground }]}>
            Ask the event organizer for a current QR code.
          </Text>
        </>
      ) : error ? (
        <>
          <View style={[styles.iconCircle, { backgroundColor: colors.destructive + "18" }]}>
            <Feather name="alert-circle" size={42} color={colors.destructive} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Check-in not completed</Text>
          <Text accessibilityRole="alert" style={[styles.copy, { color: colors.mutedForeground }]}>
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            testID="button-retry-event-check-in"
            onPress={() => {
              startedRef.current = false;
              setError("");
              setResult(null);
              if (authedUid) {
                startedRef.current = true;
                void checkinMutation.mutateAsync({ data: { token } })
                  .then(setResult)
                  .catch((cause: unknown) => setError(
                    cause instanceof Error ? cause.message : "Could not verify event attendance.",
                  ));
              }
            }}
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Try again</Text>
          </Pressable>
        </>
      ) : result ? (
        <>
          <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
            <Feather name="check-circle" size={42} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {result.alreadyCheckedIn ? "Already checked in" : "Attendance confirmed"}
          </Text>
          <Text style={[styles.copy, { color: colors.mutedForeground }]}>
            {result.title} · {result.checkInMethod === "qr" ? "QR check-in" : "Location check-in"}
          </Text>
          <Pressable
            accessibilityRole="button"
            testID="button-open-checked-in-event"
            onPress={openEvent}
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>View event</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.title, { color: colors.text, marginTop: 18 }]}>
            {authedUid ? "Verifying your attendance" : "Waiting for your Met account"}
          </Text>
          <Text style={[styles.copy, { color: colors.mutedForeground }]}>
            {authedUid
              ? "Your check-in code is being verified."
              : "Sign in to Met to record your attendance."}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 12 },
  iconCircle: { width: 82, height: 82, borderRadius: 41, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700", textAlign: "center" },
  copy: { fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 320 },
  button: { minHeight: 50, minWidth: 160, borderTopLeftRadius: 28, borderBottomRightRadius: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, marginTop: 12 },
  buttonText: { fontSize: 14, fontWeight: "700" },
});
