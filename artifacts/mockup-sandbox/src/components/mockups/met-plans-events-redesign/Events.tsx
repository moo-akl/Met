import React, { useState } from "react";
import "./_group.css";
import { Feather, Pressable, ScrollView, StyleSheet, Text, View, useColors } from "./rnDom";

type PublicEvent = {
  id: string;
  title: string;
  startsAt: Date;
  kind: string;
  place: string;
  description: string;
  going: number;
  rsvp: "going" | "interested" | "none";
};
const future = (days: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
};
const eventSeed: PublicEvent[] = [
  { id: "venue-301", title: "Live jazz at The Chapel", startsAt: future(1, 19), kind: "VENUE EVENT", place: "The Chapel · Mission", description: "An intimate evening of live jazz in the heart of the Mission.", going: 48, rsvp: "going" },
  { id: "member-302", title: "Sunday ceramics and coffee", startsAt: future(4, 11), kind: "MET MEMBER", place: "Clayroom · San Francisco", description: "A relaxed beginner-friendly pottery session, then coffee around the corner.", going: 12, rsvp: "interested" },
  { id: "member-303", title: "Neighborhood book swap", startsAt: future(7, 15), kind: "MET MEMBER", place: "Mission Dolores", description: "Bring a book you loved. Leave with a story you haven’t read yet.", going: 9, rsvp: "none" },
];

export function Events() {
  const colors = useColors();
  const [rsvps, setRsvps] = useState<Record<string, PublicEvent["rsvp"]>>({});
  const [showNetworks, setShowNetworks] = useState(false);
  const grouped = eventSeed.reduce((groups, event) => {
    const key = event.startsAt.toDateString();
    const found = groups.find((group) => group.key === key);
    if (found) found.events.push(event);
    else groups.push({ key, label: event.startsAt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }), events: [event] });
    return groups;
  }, [] as { key: string; label: string; events: PublicEvent[] }[]);
  const chooseRsvp = (id: string, current: PublicEvent["rsvp"], next: PublicEvent["rsvp"]) => setRsvps((old) => ({ ...old, [id]: current === next ? "none" : next }));

  return (
    <View className="met-plans-events met-open-notes" style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.topline}>
          <Text style={[styles.kicker, { color: colors.primary }]}>THE CITY, IN GOOD COMPANY</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Create an event" onPress={() => setShowNetworks((value) => !value)} style={[styles.add, { backgroundColor: colors.primary }]}><Feather name="plus" size={20} color={colors.primaryForeground} /></Pressable>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Events<span style={{ color: colors.primary }}>.</span></Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Small reasons to get out there.</Text>
        <Pressable accessibilityRole="button" onPress={() => setShowNetworks((value) => !value)} style={[styles.networkRow, { borderColor: colors.border }]}>
          <View style={[styles.networkMark, { backgroundColor: colors.primarySoft }]}><Feather name="users" size={18} color={colors.primary} /></View>
          <View style={styles.networkCopy}><Text style={[styles.networkTitle, { color: colors.text }]}>{showNetworks ? "Your groups and invites" : "From your local networks"}</Text><Text style={[styles.networkHint, { color: colors.mutedForeground }]}>{showNetworks ? "Friends, groups, and invitations in one place." : "Browse gatherings from venues and Met members."}</Text></View>
          <Feather name="arrow-up-right" size={18} color={colors.primary} />
        </Pressable>
        <View style={styles.timeline}>
          <View style={[styles.timelineRail, { backgroundColor: colors.border }]} />
          {grouped.map((group, groupIndex) => (
            <View key={group.key} style={styles.dateGroup}>
              <View style={styles.dateHead}>
                <View style={[styles.dateDot, { backgroundColor: colors.primary, borderColor: colors.background }]} />
                <Text style={[styles.dateLabel, { color: colors.text }]}>{group.label}</Text>
                {groupIndex === 0 ? <Text style={[styles.firstMarker, { color: colors.primary }]}>NEXT UP</Text> : null}
              </View>
              {group.events.map((event) => {
                const current = rsvps[event.id] ?? event.rsvp;
                return (
                  <View key={event.id} style={[styles.event, { borderColor: colors.border }]}>
                    <View style={styles.metaLine}>
                      <Text style={[styles.type, { color: colors.primary }]}>{event.kind}</Text>
                      <Text style={[styles.time, { color: colors.mutedForeground }]}>{event.startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</Text>
                    </View>
                    <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
                    <Text style={[styles.place, { color: colors.mutedForeground }]}><Feather name="map-pin" size={13} color={colors.primary} />  {event.place}</Text>
                    <Text style={[styles.description, { color: colors.mutedForeground }]}>{event.description}</Text>
                    <View style={styles.rsvpRow}>
                      <Text style={[styles.attending, { color: colors.mutedForeground }]}>{event.going} going</Text>
                      <Pressable accessibilityRole="button" accessibilityState={{ selected: current === "going" }} onPress={() => chooseRsvp(event.id, current, "going")} style={[styles.rsvp, current === "going" && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                        <Text style={[styles.rsvpText, { color: current === "going" ? colors.primaryForeground : colors.text }]}>{current === "going" ? "Going" : "Join"}</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityState={{ selected: current === "interested" }} onPress={() => chooseRsvp(event.id, current, "interested")} style={[styles.interest, { borderColor: colors.border }]}>
                        <Text style={[styles.interestText, { color: current === "interested" ? colors.primary : colors.mutedForeground }]}>{current === "interested" ? "Interested ✓" : "Interested"}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        <Text style={[styles.endNote, { color: colors.mutedForeground }]}>A good plan starts somewhere.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: "100vh" },
  page: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 34 },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: { fontSize: 9, fontWeight: "700", letterSpacing: 1.55 },
  add: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Georgia, serif", fontSize: 47, letterSpacing: -1.5, marginTop: 15 },
  subtitle: { fontSize: 14, marginTop: 3 },
  networkRow: { minHeight: 72, borderTopWidth: 1, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", gap: 12, marginTop: 21, paddingVertical: 10 },
  networkMark: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  networkCopy: { flex: 1 },
  networkTitle: { fontSize: 13, fontWeight: "700" },
  networkHint: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  timeline: { position: "relative", paddingTop: 23 },
  timelineRail: { position: "absolute", left: 6, top: 35, bottom: 12, width: 1 },
  dateGroup: { marginBottom: 17 },
  dateHead: { minHeight: 25, flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 7 },
  dateDot: { width: 13, height: 13, borderRadius: 7, borderWidth: 3, zIndex: 1 },
  dateLabel: { fontFamily: "Georgia, serif", fontSize: 17, flex: 1 },
  firstMarker: { fontSize: 8, fontWeight: "700", letterSpacing: 1 },
  event: { borderBottomWidth: 1, marginLeft: 21, paddingTop: 11, paddingBottom: 14 },
  metaLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  type: { fontSize: 8, fontWeight: "700", letterSpacing: 1.15 },
  time: { fontSize: 10 },
  eventTitle: { fontFamily: "Georgia, serif", fontSize: 20, lineHeight: 25, marginTop: 5 },
  place: { fontSize: 10, marginTop: 7, display: "flex", alignItems: "center" },
  description: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  rsvpRow: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10 },
  attending: { flex: 1, fontSize: 10 },
  rsvp: { minWidth: 62, minHeight: 30, borderWidth: 1, borderColor: "var(--met-primary)", borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  rsvpText: { fontSize: 10, fontWeight: "700" },
  interest: { minHeight: 30, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 9 },
  interestText: { fontSize: 9, fontWeight: "700" },
  endNote: { fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 13, textAlign: "center", marginTop: 9 },
});
