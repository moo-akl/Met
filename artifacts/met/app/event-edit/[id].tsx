import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import React from "react";

import CommunityEventForm from "@/components/CommunityEventForm";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { getGetCommunityEventForEditQueryOptions } from "@workspace/api-client-react";

export default function EditCommunityEventScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const eventId = Number(rawId);
  const isValidId = Number.isSafeInteger(eventId) && eventId > 0;
  const colors = useColors();
  const { t } = useT();
  const eventQuery = useQuery({
    ...getGetCommunityEventForEditQueryOptions(isValidId ? eventId : 0),
    enabled: isValidId,
  });

  if (eventQuery.isLoading) {
    return (
      <View style={[styles.state, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!eventQuery.data) {
    return (
      <View style={[styles.state, { backgroundColor: colors.background }]}>
        <Text style={[styles.error, { color: colors.text }]}>
          {t("tabs.events.loadError")}
        </Text>
      </View>
    );
  }

  return (
    <CommunityEventForm
      key={eventId}
      mode="edit"
      initial={eventQuery.data}
    />
  );
}

const styles = StyleSheet.create({
  state: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  error: { fontSize: 15, fontWeight: "600", textAlign: "center" },
});
