import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useVenueOwner } from "@/hooks/useVenueOwner";

/**
 * Safe landing route for notifications and direct links. The root lifecycle
 * gate replaces this loading view only after it has the current account's
 * canonical application status.
 */
export default function VenueOwnerIndexScreen() {
  const colors = useColors();
  const { error, refetch } = useVenueOwner();
  return (
    <View style={styles.root}>
      {error ? (
        <>
          <Text style={styles.errorText}>
            We couldn’t check your venue application. Your application has not changed.
          </Text>
          <Pressable onPress={refetch}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>
          </Pressable>
        </>
      ) : (
        <ActivityIndicator color={colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F0F12",
  },
  errorText: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 300,
    textAlign: "center",
    marginBottom: 16,
  },
  retryText: { fontFamily: "Inter_700Bold", fontSize: 15 },
});