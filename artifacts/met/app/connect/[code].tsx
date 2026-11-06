import { Feather } from "@expo/vector-icons";
import {
  useAcceptConnectionInvite,
  useGetConnectionInvite,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { consumePendingConnectionInviteRoute } from "../_layout";

const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/i;

export default function ConnectionInviteScreen() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { t } = useT();
  const { authedUid, profile, permissionsCompleted } = useApp();
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState("");

  const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const code = rawCode?.toUpperCase() ?? "";
  const codeIsValid = CODE_PATTERN.test(code);
  const canUseConnectionInvite = Boolean(
    authedUid && profile && permissionsCompleted,
  );

  const inviteQuery = useGetConnectionInvite(code, {
    query: { enabled: Boolean(canUseConnectionInvite && codeIsValid) },
  });
  const acceptInvite = useAcceptConnectionInvite();

  useEffect(() => {
    if (canUseConnectionInvite) consumePendingConnectionInviteRoute();
  }, [canUseConnectionInvite]);

  const openConnections = () => router.replace("/(tabs)/connections" as never);
  const handleAccept = () => {
    if (!codeIsValid || acceptInvite.isPending) return;
    setAcceptError("");
    acceptInvite.mutate(
      { code },
      {
        onSuccess: () => setAccepted(true),
        onError: (error) => {
          setAcceptError(
            error instanceof Error
              ? error.message
              : "The invitation could not be accepted. Please try again.",
          );
        },
      },
    );
  };

  const invite = inviteQuery.data;
  const isConnected = Boolean(invite?.alreadyConnected);
  const showSuccess = accepted || isConnected;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={21} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Met connection invite
        </Text>
        <View style={styles.backButton} />
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + 28 }]}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {inviteQuery.isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : null}

          {!codeIsValid ? (
            <InviteMessage
              icon="alert-circle"
              title="This invite link is not valid"
              body="Check the link and ask your friend to share it again."
              colors={colors}
            />
          ) : null}

          {codeIsValid && inviteQuery.isError ? (
            <InviteMessage
              icon="link-2"
              title="Invite unavailable"
              body="This link may have expired or been replaced. Ask your friend for a new one."
              colors={colors}
            />
          ) : null}

          {invite ? (
            <>
              {invite.photoUrl ? (
                <Image
                  source={{ uri: invite.photoUrl }}
                  style={styles.avatar}
                  accessibilityLabel={`${invite.displayName}'s profile photo`}
                />
              ) : (
                <View
                  style={[
                    styles.avatarFallback,
                    { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <Feather name="user" size={32} color={colors.primary} />
                </View>
              )}
              <Text style={[styles.title, { color: colors.text }]}>
                {showSuccess
                  ? isConnected
                    ? "You’re already connected"
                    : "You’re connected"
                  : `Connect with ${invite.displayName}`}
              </Text>
              <Text style={[styles.body, { color: colors.mutedForeground }]}>
                {showSuccess
                  ? isConnected
                    ? `${invite.displayName} is already in your Met connections.`
                    : `${invite.displayName} is now in your Met connections.`
                  : `${invite.displayName} shared a personal invite. Accept to add each other to your Met connections.`}
              </Text>
            </>
          ) : null}

          {acceptError ? (
            <Text
              accessibilityRole="alert"
              style={[styles.error, { color: colors.destructive }]}
            >
              {acceptError}
            </Text>
          ) : null}

          {invite && !showSuccess ? (
            <Pressable
              accessibilityRole="button"
              disabled={acceptInvite.isPending}
              onPress={handleAccept}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed || acceptInvite.isPending ? 0.75 : 1,
                },
              ]}
            >
              {acceptInvite.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather
                    name="user-plus"
                    size={17}
                    color={colors.primaryForeground}
                  />
                  <Text
                    style={[
                      styles.primaryButtonText,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    {t("connections.accept")}
                  </Text>
                </>
              )}
            </Pressable>
          ) : null}

          {showSuccess ? (
            <Pressable
              accessibilityRole="button"
              onPress={openConnections}
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary },
              ]}
            >
              <Feather
                name="users"
                size={17}
                color={colors.primaryForeground}
              />
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: colors.primaryForeground },
                ]}
              >
                {t("connections.connectionsSection")}
              </Text>
            </Pressable>
          ) : null}

          {inviteQuery.isError ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void inviteQuery.refetch()}
              style={styles.retryButton}
            >
              <Text style={[styles.retryText, { color: colors.primary }]}>
                Try again
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function InviteMessage({
  icon,
  title,
  body,
  colors,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  body: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.message}>
      <View
        style={[
          styles.messageIcon,
          { backgroundColor: colors.primarySoft },
        ]}
      >
        <Feather name={icon} size={21} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    minHeight: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    gap: 14,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#DDE6DF",
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 21,
    lineHeight: 28,
    textAlign: "center",
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  message: {
    alignItems: "center",
    gap: 12,
  },
  messageIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    minHeight: 50,
    alignSelf: "stretch",
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  retryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  error: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
