import React, { useMemo, useState } from "react";
import "./_group.css";
import { Feather, Pressable, ScrollView, StyleSheet, Text, View, useColors } from "./rnDom";

type Plan = {
  id: string;
  title: string;
  startsAt: Date;
  place: string;
  role: "host" | "joined" | "pending";
  note: string;
};

const buildDate = (days: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
};

const sourcePlans: Plan[] = [
  { id: "plan-201", title: "Golden hour picnic at Dolores Park", startsAt: buildDate(3, 18), place: "Dolores Park · Mission", role: "pending", note: "A blanket, a few snacks, and whoever’s free." },
  { id: "plan-202", title: "Saturday morning coastal walk", startsAt: buildDate(6, 9), place: "Lands End Trail", role: "joined", note: "Jordan saved you a spot on the path." },
  { id: "plan-203", title: "Dinner and board games", startsAt: buildDate(10, 19), place: "Mission District", role: "host", note: "Bring a game you can teach in five minutes." },
];

export function Plans() {
  const colors = useColors();
  const [statuses, setStatuses] = useState<Record<string, Plan["role"]>>({});
  const [showHosted, setShowHosted] = useState(true);
  const plans = useMemo(() => sourcePlans.filter((plan) => showHosted || plan.role !== "host"), [showHosted]);
  const fmtDay = (date: Date) => date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const statusLabel = (status: Plan["role"]) => status === "host" ? "You’re hosting" : status === "pending" ? "Request sent · awaiting host" : "You’re going";

  return (
    <View className="met-plans-events met-open-notes" style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.topline}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => {}} style={styles.back}><Feather name="arrow-left" size={20} color={colors.text} /></Pressable>
          <Text style={[styles.kicker, { color: colors.primary }]}>YOUR FIELD NOTES / 01</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Create a plan" onPress={() => setShowHosted((value) => !value)} style={[styles.add, { backgroundColor: colors.primary }]}><Feather name="plus" size={20} color={colors.primaryForeground} /></Pressable>
        </View>
        <View style={styles.heading}>
          <Text style={[styles.title, { color: colors.text }]}>Plans</Text>
          <View style={[styles.greenStroke, { backgroundColor: colors.primary }]} />
          <Text style={[styles.intro, { color: colors.mutedForeground }]}>A few good things already on the calendar.</Text>
        </View>
        <View style={styles.filterRow}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>COMING UP · {plans.length}</Text>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: showHosted }} onPress={() => setShowHosted((value) => !value)} style={styles.filter}>
            <Text style={[styles.filterText, { color: colors.primary }]}>{showHosted ? "All plans" : "Hide hosted"}</Text>
            <Feather name="chevron-right" size={15} color={colors.primary} />
          </Pressable>
        </View>
        <View style={styles.list}>
          {plans.map((plan, index) => {
            const currentRole = statuses[plan.id] ?? plan.role;
            return (
              <View key={plan.id} style={[styles.entry, { borderTopColor: colors.border }]}>
                <View style={styles.marginNote}>
                  <Text style={[styles.index, { color: colors.primary }]}>{String(index + 1).padStart(2, "0")}</Text>
                  <View style={[styles.pin, { backgroundColor: colors.primary }]} />
                </View>
                <View style={styles.entryBody}>
                  <Text style={[styles.date, { color: colors.primary }]}>{fmtDay(plan.startsAt)} <Text style={{ color: colors.mutedForeground }}>· {plan.startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</Text></Text>
                  <Text style={[styles.planTitle, { color: colors.text }]}>{plan.title}</Text>
                  <Text style={[styles.place, { color: colors.mutedForeground }]}><Feather name="map-pin" size={13} color={colors.primary} />  {plan.place}</Text>
                  <Text style={[styles.note, { color: colors.mutedForeground }]}>{plan.note}</Text>
                  <View style={styles.actionRow}>
                    <Pressable accessibilityRole="button" accessibilityLabel={statusLabel(currentRole)} onPress={() => setStatuses((old) => ({ ...old, [plan.id]: currentRole === "pending" ? "joined" : currentRole === "joined" ? "pending" : "host" }))} style={[styles.status, { borderColor: colors.primary }]}>
                      <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
                      <Text style={[styles.statusText, { color: colors.text }]}>{statusLabel(currentRole)}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Open plan conversation" onPress={() => setStatuses((old) => ({ ...old, [plan.id]: currentRole }))} style={styles.chat}>
                      <Feather name="message-circle" size={15} color={colors.primary} />
                      <Text style={[styles.chatText, { color: colors.primary }]}>Conversation</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
        <View style={[styles.footerNote, { borderTopColor: colors.border }]}>
          <Feather name="sun" size={17} color={colors.primary} />
          <Text style={[styles.footerCopy, { color: colors.mutedForeground }]}>Plans you host, join, or have asked to join live here.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: "100vh" },
  page: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30 },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  back: { width: 34, height: 40, justifyContent: "center" },
  kicker: { fontSize: 9, fontWeight: "700", letterSpacing: 1.8 },
  add: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  heading: { paddingTop: 22, paddingBottom: 26 },
  title: { fontFamily: "Georgia, serif", fontSize: 48, lineHeight: 54, letterSpacing: -1.6 },
  greenStroke: { width: 44, height: 4, marginTop: 12, marginBottom: 12, borderRadius: 2 },
  intro: { fontSize: 14, lineHeight: 21, maxWidth: 275 },
  filterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 9 },
  sectionLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1.25 },
  filter: { flexDirection: "row", alignItems: "center", gap: 3, minHeight: 32 },
  filterText: { fontSize: 11, fontWeight: "700" },
  list: { paddingLeft: 2 },
  entry: { flexDirection: "row", borderTopWidth: 1, paddingTop: 18, paddingBottom: 19, gap: 13 },
  marginNote: { width: 25, alignItems: "center", paddingTop: 2 },
  index: { fontSize: 9, fontWeight: "700", letterSpacing: 0.7 },
  pin: { width: 5, height: 5, borderRadius: 3, marginTop: 13 },
  entryBody: { flex: 1 },
  date: { fontSize: 11, fontWeight: "700", letterSpacing: 0.15 },
  planTitle: { fontFamily: "Georgia, serif", fontSize: 21, lineHeight: 26, marginTop: 7 },
  place: { fontSize: 11, marginTop: 7, display: "flex", alignItems: "center" },
  note: { fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 13, lineHeight: 19, marginTop: 9 },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 9, marginTop: 12, flexWrap: "wrap" },
  status: { minHeight: 31, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: "700" },
  chat: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 5 },
  chatText: { fontSize: 10, fontWeight: "700" },
  footerNote: { marginTop: 10, paddingTop: 15, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 9 },
  footerCopy: { flex: 1, fontSize: 11, lineHeight: 17 },
});
