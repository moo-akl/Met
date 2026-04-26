import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

type Props = {
  visible: boolean;
  onClose: () => void;
};

type SheetView = "menu" | "blocked";

export function SettingsSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webBot = Platform.OS === "web" ? 34 : 0;
  const { blockedEncounters, setBlocked, resetAll } = useApp();

  const [view, setView] = useState<SheetView>("menu");
  const [confirmReset, setConfirmReset] = useState(false);

  const close = () => {
    setView("menu");
    setConfirmReset(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + webBot + 20,
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            {view === "blocked" ? (
              <Pressable onPress={() => setView("menu")} hitSlop={12}>
                <Feather name="chevron-left" size={24} color={colors.foreground} />
              </Pressable>
            ) : (
              <View style={{ width: 24 }} />
            )}
            <Text style={[styles.title, { color: colors.foreground }]}>
              {view === "menu" ? "Settings" : "Blocked people"}
            </Text>
            <Pressable onPress={close} hitSlop={12}>
              <Feather name="x" size={24} color={colors.foreground} />
            </Pressable>
          </View>

          {view === "menu" ? (
            <View style={{ gap: 10 }}>
              <Pressable
                onPress={() => setView("blocked")}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: colors.background },
                  ]}
                >
                  <Feather name="slash" size={18} color={colors.foreground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                    Blocked people
                  </Text>
                  <Text
                    style={[styles.rowSub, { color: colors.mutedForeground }]}
                  >
                    {blockedEncounters.length === 0
                      ? "No one blocked"
                      : `${blockedEncounters.length} ${
                          blockedEncounters.length === 1 ? "person" : "people"
                        } blocked`}
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={20}
                  color={colors.mutedForeground}
                />
              </Pressable>

              {confirmReset ? (
                <View
                  style={[
                    styles.confirmCard,
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.destructive,
                    },
                  ]}
                >
                  <Text
                    style={[styles.confirmTitle, { color: colors.foreground }]}
                  >
                    Reset profile?
                  </Text>
                  <Text
                    style={[styles.confirmSub, { color: colors.mutedForeground }]}
                  >
                    Your profile and encounter history will be cleared and
                    sample encounters reseeded.
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      onPress={() => setConfirmReset(false)}
                      style={({ pressed }) => [
                        styles.confirmBtn,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.confirmBtnText,
                          { color: colors.foreground },
                        ]}
                      >
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        await resetAll();
                        close();
                      }}
                      style={({ pressed }) => [
                        styles.confirmBtn,
                        {
                          backgroundColor: colors.destructive,
                          borderColor: colors.destructive,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.confirmBtnText,
                          { color: "#FFFFFF" },
                        ]}
                      >
                        Reset
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => setConfirmReset(true)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.rowIcon,
                      { backgroundColor: colors.background },
                    ]}
                  >
                    <Feather
                      name="refresh-ccw"
                      size={18}
                      color={colors.destructive}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.rowLabel,
                        { color: colors.destructive },
                      ]}
                    >
                      Reset profile
                    </Text>
                    <Text
                      style={[
                        styles.rowSub,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Clear profile + reseed sample encounters
                    </Text>
                  </View>
                </Pressable>
              )}
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 360 }}
              contentContainerStyle={{ gap: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {blockedEncounters.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Feather name="check-circle" size={30} color={colors.primary} />
                  <Text
                    style={[styles.emptyTitle, { color: colors.foreground }]}
                  >
                    No one is blocked
                  </Text>
                  <Text
                    style={[styles.emptySub, { color: colors.mutedForeground }]}
                  >
                    Blocked encounters and connections will show up here so you
                    can unblock them.
                  </Text>
                </View>
              ) : (
                blockedEncounters.map((e) => (
                  <View
                    key={e.id}
                    style={[
                      styles.blockedRow,
                      {
                        backgroundColor: colors.muted,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Avatar uri={e.photoUri} size={42} />
                    <Text
                      style={[styles.blockedName, { color: colors.foreground }]}
                    >
                      {e.realName}
                    </Text>
                    <Pressable
                      onPress={() => setBlocked(e.id, false)}
                      style={({ pressed }) => [
                        styles.unblockBtn,
                        {
                          backgroundColor: colors.primary,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text style={styles.unblockText}>Unblock</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    gap: 14,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 17 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  rowSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  confirmCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  confirmTitle: { fontFamily: "Inter_700Bold", fontSize: 15 },
  confirmSub: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  confirmBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  emptySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 19,
  },
  blockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  blockedName: { fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1 },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  unblockText: { color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
