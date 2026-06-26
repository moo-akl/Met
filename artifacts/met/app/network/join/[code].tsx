import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import {
  useGetNetworkByCode,
  useJoinNetworkByCode,
} from "@workspace/api-client-react";

type Category = "university" | "work" | "neighborhood" | "custom";

export default function JoinByCodeScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const [joining, setJoining] = useState(false);
  const [done, setDone] = useState<"joined" | "pending" | null>(null);

  const upperCode = (code ?? "").toUpperCase();

  const { data: network, isLoading, isError } = useGetNetworkByCode(upperCode);

  const joinMutation = useJoinNetworkByCode();

  const catIcons: Record<Category, string> = {
    university: "book",
    work: "briefcase",
    neighborhood: "map-pin",
    custom: "users",
  };

  async function handleJoin() {
    if (!code) return;
    setJoining(true);
    try {
      const result = await joinMutation.mutateAsync({ code: upperCode });
      setDone(result.status === "pending" ? "pending" : "joined");
    } catch {
      // error handled below
    } finally {
      setJoining(false);
    }
  }

  const alreadyMember =
    network?.myMembership?.status === "active" ||
    network?.myMembership?.status === "pending";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("networks.joinByCodeTitle")}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : isError || !network ? (
          <View style={styles.centered}>
            <View
              style={[
                styles.errorCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather name="alert-circle" size={36} color={colors.mutedForeground} />
              <Text
                style={[styles.errorTitle, { color: colors.foreground }]}
              >
                {t("networks.joinByCodeError")}
              </Text>
              <Text
                style={[
                  styles.errorSub,
                  { color: colors.mutedForeground },
                ]}
              >
                {`Code: ${code?.toUpperCase() ?? ""}`}
              </Text>
            </View>
          </View>
        ) : done ? (
          <View style={styles.centered}>
            <View
              style={[
                styles.successCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.successIcon,
                  { backgroundColor: colors.primary + "22" },
                ]}
              >
                <Feather name="check-circle" size={40} color={colors.primary} />
              </View>
              <Text
                style={[styles.successTitle, { color: colors.foreground }]}
              >
                {done === "pending"
                  ? t("networks.joinByCodePending")
                  : t("networks.joinByCodeSuccess", { name: network.name })}
              </Text>
              <Pressable
                style={[styles.doneBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (done === "joined") {
                    router.replace({
                      pathname: "/network/[id]",
                      params: { id: String(network.id) },
                    } as never);
                  } else {
                    router.back();
                  }
                }}
              >
                <Text style={styles.doneBtnText}>{t("common.done")}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.networkCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.networkIcon,
                  { backgroundColor: colors.primary + "18" },
                ]}
              >
                <Feather
                  name={(catIcons[network.category as Category] ?? "users") as never}
                  size={32}
                  color={colors.primary}
                />
              </View>
              <Text
                style={[styles.networkName, { color: colors.foreground }]}
              >
                {network.name}
              </Text>
              {!!network.description && (
                <Text
                  style={[
                    styles.networkDesc,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {network.description}
                </Text>
              )}
              <View style={styles.metaRow}>
                <Feather
                  name="users"
                  size={13}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.metaText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {t("networks.members_other", {
                    count: network.memberCount,
                  })}
                </Text>
                {network.requiresApproval && (
                  <>
                    <Text
                      style={[
                        styles.metaDot,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      ·
                    </Text>
                    <Feather
                      name="lock"
                      size={13}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.metaText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {t("networks.approvalRequiredBadge")}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {alreadyMember ? (
              <View
                style={[
                  styles.alreadyBadge,
                  { backgroundColor: colors.muted },
                ]}
              >
                <Text
                  style={[
                    styles.alreadyText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {t("networks.alreadyMember")}
                </Text>
              </View>
            ) : (
              <Pressable
                style={[styles.joinBtn, { backgroundColor: colors.primary }]}
                onPress={handleJoin}
                disabled={joining}
              >
                {joining ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.joinBtnText}>
                    {network.requiresApproval
                      ? t("networks.requestToJoin")
                      : t("networks.joinByCodeButton")}
                  </Text>
                )}
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },
  centered: {
    flex: 1,
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  errorCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  errorTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    textAlign: "center",
  },
  errorSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
  successCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    gap: 16,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  doneBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  doneBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  networkCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  networkIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  networkName: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    textAlign: "center",
  },
  networkDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  metaText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  metaDot: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  joinBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  joinBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  alreadyBadge: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  alreadyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
});
