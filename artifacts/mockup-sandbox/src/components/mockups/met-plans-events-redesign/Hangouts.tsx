import React, { useState } from "react";
import "./_group.css";
import { Feather, Pressable, ScrollView, StyleSheet, Text, View, useColors } from "./rnDom";

type NearbyPlan = {
  id: string;
  title: string;
  host: string;
  when: Date;
  place: string;
  distance: number;
  note: string;
  status: "joined" | "pending" | "open";
};
const tomorrow = (days: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
};
const nearby: NearbyPlan[] = [
  { id: "hangout-401", title: "Golden hour picnic", host: "Leah Martin", when: tomorrow(2, 18), place: "Dolores Park", distance: 0.7, note: "Bring a blanket and something to share. New friends welcome.", status: "joined" },
  { id: "hangout-402", title: "Coffee, then the coastal trail", host: "Jordan Lee", when: tomorrow(3, 9), place: "Lands End Lookout", distance: 1.4, note: "Easy pace, good views, coffee stop on the way back.", status: "pending" },
  { id: "hangout-403", title: "Sunset volleyball", host: "Alex Rivera", when: tomorrow(5, 17), place: "Ocean Beach", distance: 2.2, note: "Casual games for all levels. We have an extra ball.", status: "open" },
];

export function Hangouts() {
  const colors = useColors();
  const [sort, setSort] = useState<"nearest" | "soonest">("nearest");
  const [join, setJoin] = useState<Record<string, NearbyPlan["status"]>>({});
  const list = sort === "nearest" ? [...nearby].sort((a, b) => a.distance - b.distance) : [...nearby].sort((a, b) => a.when.getTime() - b.when.getTime());
  const stateCopy = (status: NearbyPlan["status"]) => status === "joined" ? "You’re in" : status === "pending" ? "Request pending" : "Request to join";

  return (
    <View className="met-plans-events met-open-notes" style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.headline}>
          <View>
            <Text style={[styles.kicker, { color: colors.primary }]}>OPEN INVITATIONS / SF</Text>
            <Text style={[styles.title, { color: colors.text }]}>Hangouts</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Make a hangout" onPress={() => setSort(sort === "nearest" ? "soonest" : "nearest")} style={[styles.add, { backgroundColor: colors.primary }]}><Feather name="plus" size={20} color={colors.primaryForeground} /></Pressable>
        </View>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>Public plans, hosted by people nearby. Ask to join when one feels right.</Text>
        <View style={[styles.sortArea, { borderColor: colors.border }]}>
          <Text style={[styles.sortLabel, { color: colors.mutedForeground }]}>ORDER BY</Text>
          {(["nearest", "soonest"] as const).map((mode) => <Pressable key={mode} accessibilityRole="button" accessibilityState={{ selected: sort === mode }} onPress={() => setSort(mode)} style={[styles.sortChip, sort === mode && { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.sortText, { color: sort === mode ? colors.primary : colors.mutedForeground }]}>{mode === "nearest" ? "Nearest first" : "Starting soon"}</Text>
          </Pressable>)}
        </View>
        <View style={styles.list}>
          {list.map((hangout, index) => {
            const status = join[hangout.id] ?? hangout.status;
            return (
              <View key={hangout.id} style={[styles.hangout, { borderBottomColor: colors.border }]}>
                <View style={styles.indexCol}>
                  <Text style={[styles.distance, { color: colors.primary }]}>{hangout.distance.toFixed(1)}<Text style={styles.km}> km</Text></Text>
                  <View style={[styles.route, { backgroundColor: colors.primarySoft }]}><View style={[styles.routeDot, { backgroundColor: colors.primary }]} /></View>
                  <Text style={[styles.index, { color: colors.mutedForeground }]}>0{index + 1}</Text>
                </View>
                <View style={styles.copy}>
                  <View style={styles.overline}>
                    <Text style={[styles.openLabel, { color: colors.primary }]}>PUBLIC HANGOUT</Text>
                    <Text style={[styles.host, { color: colors.mutedForeground }]}>HOST · {hangout.host}</Text>
                  </View>
                  <Text style={[styles.titleText, { color: colors.text }]}>{hangout.title}</Text>
                  <Text style={[styles.when, { color: colors.mutedForeground }]}>{hangout.when.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} · {hangout.when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</Text>
                  <Text style={[styles.place, { color: colors.mutedForeground }]}><Feather name="map-pin" size={12} color={colors.primary} />  {hangout.place}</Text>
                  <Text style={[styles.note, { color: colors.text }]}>{hangout.note}</Text>
                  <Pressable accessibilityRole="button" accessibilityState={{ selected: status !== "open" }} onPress={() => setJoin((old) => ({ ...old, [hangout.id]: status === "open" ? "pending" : status === "pending" ? "open" : "open" }))} style={[styles.joinButton, { borderColor: colors.primary }, status === "joined" && { backgroundColor: colors.primary }]}>
                    <Text style={[styles.joinText, { color: status === "joined" ? colors.primaryForeground : colors.primary }]}>{stateCopy(status)}</Text>
                    <Feather name={status === "joined" ? "check-circle" : "arrow-up-right"} size={14} color={status === "joined" ? colors.primaryForeground : colors.primary} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
        <View style={[styles.locationNote, { backgroundColor: colors.primarySoft }]}>
          <Feather name="map-pin" size={16} color={colors.primary} />
          <Text style={[styles.locationCopy, { color: colors.text }]}>Sorted by distance from your selected area. Exact host locations stay private.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: "100vh" },
  page: { paddingHorizontal: 21, paddingTop: 17, paddingBottom: 26 },
  headline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: { fontSize: 9, fontWeight: "700", letterSpacing: 1.35 },
  title: { fontFamily: "Georgia, serif", fontSize: 39, letterSpacing: -1, marginTop: 6 },
  add: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  intro: { fontSize: 12, lineHeight: 18, maxWidth: 315, marginTop: 8 },
  sortArea: { minHeight: 48, borderTopWidth: 1, borderBottomWidth: 1, marginTop: 17, flexDirection: "row", alignItems: "center", gap: 11 },
  sortLabel: { fontSize: 8, fontWeight: "700", letterSpacing: 1, marginRight: "auto" },
  sortChip: { minHeight: 29, borderRadius: 15, paddingHorizontal: 10, justifyContent: "center" },
  sortText: { fontSize: 9, fontWeight: "700" },
  list: { paddingTop: 4 },
  hangout: { flexDirection: "row", borderBottomWidth: 1, paddingTop: 17, paddingBottom: 17, gap: 12 },
  indexCol: { width: 47, alignItems: "center" },
  distance: { fontSize: 17, fontFamily: "Georgia, serif" },
  km: { fontSize: 9, fontFamily: "sans-serif" },
  route: { width: 1, height: 27, marginTop: 7, marginBottom: 4, alignItems: "center", justifyContent: "center" },
  routeDot: { width: 6, height: 6, borderRadius: 3 },
  index: { fontSize: 8, letterSpacing: 0.8 },
  copy: { flex: 1 },
  overline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 4 },
  openLabel: { fontSize: 8, fontWeight: "700", letterSpacing: 1 },
  host: { fontSize: 8, letterSpacing: 0.3 },
  titleText: { fontFamily: "Georgia, serif", fontSize: 20, lineHeight: 24, marginTop: 7 },
  when: { fontSize: 10, marginTop: 6 },
  place: { display: "flex", alignItems: "center", fontSize: 10, marginTop: 4 },
  note: { fontFamily: "Georgia, serif", fontSize: 12, lineHeight: 17, marginTop: 8 },
  joinButton: { minHeight: 33, borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 7, marginTop: 10 },
  joinText: { fontSize: 10, fontWeight: "700" },
  locationNote: { borderTopRightRadius: 23, borderBottomLeftRadius: 23, flexDirection: "row", alignItems: "center", gap: 9, padding: 12, marginTop: 16 },
  locationCopy: { flex: 1, fontSize: 10, lineHeight: 15 },
});
