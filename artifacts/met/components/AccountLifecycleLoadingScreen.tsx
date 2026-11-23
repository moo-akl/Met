import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";

export function AccountLifecycleLoadingScreen() {
  const colors = useColors();
  const { t } = useT();
  const { accountLifecycle, refreshAccountLifecycle } = useApp();
  const [retrying, setRetrying] = useState(false);
  const unavailable = accountLifecycle.status === "unavailable";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {retrying || !unavailable ? <ActivityIndicator color={colors.primary} /> : null}
      <Text style={[styles.message, { color: colors.foreground }]}>
        {unavailable ? t("accountRecovery.statusUnavailable") : t("accountRecovery.checking")}
      </Text>
      {unavailable ? (
        <Pressable
          accessibilityRole="button"
          disabled={retrying}
          onPress={async () => {
            setRetrying(true);
            await refreshAccountLifecycle();
            setRetrying(false);
          }}
          style={({ pressed }) => [
            styles.button,
            { borderColor: colors.border, opacity: pressed || retrying ? 0.65 : 1 },
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.primary }]}>
            {t("accountRecovery.retry")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  message: { marginTop: 14, fontFamily: "Inter_500Medium", fontSize: 15, textAlign: "center" },
  button: { marginTop: 18, minHeight: 44, borderWidth: 1, borderRadius: 12, justifyContent: "center", paddingHorizontal: 20 },
  buttonText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
