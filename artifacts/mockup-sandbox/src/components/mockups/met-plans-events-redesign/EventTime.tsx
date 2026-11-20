import React, { useState } from "react";
import "./_group.css";
import { Feather, Pressable, StyleSheet, Text, View, useColors } from "./rnDom";

function plusDays(days: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}
function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function timeInput(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function describeDate(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function EventTime() {
  const colors = useColors();
  const [startsAt, setStartsAt] = useState(() => plusDays(1, 19));
  const [draft, setDraft] = useState(() => new Date(startsAt));
  const [expanded, setExpanded] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const setTime = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    setDraft((old) => {
      const next = new Date(old);
      next.setHours(hours, minutes, 0, 0);
      return next;
    });
    setConfirmed(false);
  };
  const setDate = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    setDraft((old) => {
      const next = new Date(old);
      next.setFullYear(year, month - 1, day);
      return next;
    });
    setConfirmed(false);
  };
  const confirm = () => {
    setStartsAt(new Date(draft));
    setConfirmed(true);
  };
  const dateLabel = describeDate(startsAt);
  const shortTime = startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <View className="met-plans-events met-open-notes" style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.page}>
        <View style={styles.topline}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to event details" onPress={() => {}} style={styles.back}><Feather name="arrow-left" size={19} color={colors.text} /></Pressable>
          <Text style={[styles.kicker, { color: colors.primary }]}>NEW GATHERING · 02 / 04</Text>
          <View style={{ width: 34 }} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>When should we meet?</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Pick the moment. You can always change it later.</Text>
        <View style={styles.stepRow}>
          <View style={[styles.stepDone, { backgroundColor: colors.primary }]} />
          <View style={[styles.stepDone, { backgroundColor: colors.primary }]} />
          <View style={[styles.stepRest, { backgroundColor: colors.border }]} />
          <View style={[styles.stepRest, { backgroundColor: colors.border }]} />
          <Text style={[styles.stepText, { color: colors.mutedForeground }]}>STEP TWO</Text>
        </View>

        <Text style={[styles.label, { color: colors.mutedForeground }]}>STARTS</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={[styles.summary, { borderBottomColor: colors.border }]}>
          <View style={[styles.calendarMark, { backgroundColor: colors.primarySoft }]}><Feather name="calendar" size={19} color={colors.primary} /></View>
          <View style={styles.summaryCopy}>
            <Text style={[styles.summaryDate, { color: colors.text }]}>{dateLabel}</Text>
            <Text style={[styles.summaryTime, { color: colors.primary }]}>{shortTime}</Text>
          </View>
          <View style={[styles.chevronWrap, { backgroundColor: colors.primarySoft }, expanded && styles.chevronOpen]}>
            <Feather name="chevron-right" size={17} color={colors.primary} />
          </View>
        </Pressable>
        {expanded ? (
          <View style={[styles.editor, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.editorEyebrow, { color: colors.primary }]}>CHOOSE A DATE & TIME</Text>
            <label style={styles.inputLabel}>
              <span style={{ color: colors.mutedForeground }}>DATE</span>
              <input aria-label="Choose event date" type="date" value={dateInput(draft)} onChange={(event) => setDate(event.target.value)} style={{ ...inputStyle, color: colors.text, borderColor: colors.border, backgroundColor: colors.background }} />
            </label>
            <label style={styles.inputLabel}>
              <span style={{ color: colors.mutedForeground }}>TIME</span>
              <input aria-label="Choose event time" type="time" value={timeInput(draft)} onChange={(event) => setTime(event.target.value)} style={{ ...inputStyle, color: colors.text, borderColor: colors.border, backgroundColor: colors.background }} />
            </label>
            <View style={styles.quickTimes}>
              {["18:00", "19:00", "19:30", "20:00"].map((time) => <Pressable key={time} accessibilityRole="button" accessibilityState={{ selected: timeInput(draft) === time }} onPress={() => setTime(time)} style={[styles.quickTime, { borderColor: timeInput(draft) === time ? colors.primary : colors.border, backgroundColor: timeInput(draft) === time ? colors.primarySoft : "transparent" }]}>
                <Text style={[styles.quickLabel, { color: timeInput(draft) === time ? colors.primary : colors.mutedForeground }]}>{new Date(`2000-01-01T${time}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</Text>
              </Pressable>)}
            </View>
            <Pressable accessibilityRole="button" onPress={confirm} style={[styles.confirm, { backgroundColor: colors.primary }]}>
              <Text style={[styles.confirmText, { color: colors.primaryForeground }]}>{confirmed ? "Time confirmed" : "Confirm time"}</Text>
              <Feather name={confirmed ? "check-circle" : "arrow-up-right"} size={16} color={colors.primaryForeground} />
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setExpanded(true)} style={[styles.collapsedHint, { borderBottomColor: colors.border }]}>
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>Tap to adjust the date or choose another time.</Text>
            <Text style={[styles.changeText, { color: colors.primary }]}>Change</Text>
          </Pressable>
        )}
        <View style={[styles.context, { borderColor: colors.border }]}>
          <Text style={[styles.contextLabel, { color: colors.primary }]}>YOUR INVITATION, SO FAR</Text>
          <Text style={[styles.contextTitle, { color: colors.text }]}>Golden hour picnic</Text>
          <Text style={[styles.contextMeta, { color: colors.mutedForeground }]}>Dolores Park · San Francisco</Text>
          <View style={[styles.contextRule, { backgroundColor: colors.border }]} />
          <Text style={[styles.contextMeta, { color: colors.mutedForeground }]}>{describeDate(startsAt)} · {shortTime}</Text>
        </View>
        <View style={styles.bottom}>
          <Text style={[styles.bottomNote, { color: colors.mutedForeground }]}>{confirmed ? "Saved to this preview." : "Your date and time stay together as you edit."}</Text>
          <Pressable accessibilityRole="button" onPress={confirm} style={styles.next}>
            <Text style={[styles.nextText, { color: colors.primary }]}>Continue</Text><Feather name="arrow-up-right" size={17} color={colors.primary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", minHeight: 42, borderWidth: 1, borderStyle: "solid", borderRadius: 10, padding: "8px 10px", fontFamily: "inherit", fontSize: 14, outlineColor: "var(--met-primary)" };
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: "100vh" },
  page: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 24 },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 34, height: 38, justifyContent: "center" },
  kicker: { fontSize: 8, fontWeight: "700", letterSpacing: 1.35 },
  title: { fontFamily: "Georgia, serif", fontSize: 31, letterSpacing: -0.7, lineHeight: 37, marginTop: 25, maxWidth: 290 },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: 7, maxWidth: 285 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 22, marginBottom: 27 },
  stepDone: { width: 20, height: 3, borderRadius: 2 },
  stepRest: { width: 20, height: 3, borderRadius: 2 },
  stepText: { fontSize: 8, letterSpacing: 1, fontWeight: "700", marginLeft: 5 },
  label: { fontSize: 9, fontWeight: "700", letterSpacing: 1.4, marginBottom: 7 },
  summary: { minHeight: 72, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", paddingBottom: 12, gap: 12 },
  calendarMark: { width: 40, height: 40, borderTopLeftRadius: 16, borderBottomRightRadius: 16, alignItems: "center", justifyContent: "center" },
  summaryCopy: { flex: 1 },
  summaryDate: { fontSize: 13, fontWeight: "700" },
  summaryTime: { fontFamily: "Georgia, serif", fontSize: 16, marginTop: 3 },
  chevronWrap: { width: 31, height: 31, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  chevronOpen: { transform: [{ rotate: "90deg" }] },
  editor: { borderWidth: 1, borderTopRightRadius: 25, borderBottomLeftRadius: 25, padding: 15, marginTop: 10 },
  editorEyebrow: { fontSize: 8, fontWeight: "700", letterSpacing: 1.2, marginBottom: 12 },
  inputLabel: { display: "block", fontSize: 8, letterSpacing: 1, fontWeight: 700, marginBottom: 11 },
  quickTimes: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 1, marginBottom: 13 },
  quickTime: { minHeight: 29, borderWidth: 1, borderRadius: 15, paddingHorizontal: 9, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 9, fontWeight: "700" },
  confirm: { minHeight: 42, borderRadius: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  confirmText: { fontSize: 12, fontWeight: "700" },
  collapsedHint: { minHeight: 48, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hintText: { fontSize: 10 },
  changeText: { fontSize: 10, fontWeight: "700" },
  context: { marginTop: 20, borderLeftWidth: 2, borderTopWidth: 1, borderBottomWidth: 1, borderRightWidth: 0, paddingVertical: 12, paddingHorizontal: 13 },
  contextLabel: { fontSize: 8, fontWeight: "700", letterSpacing: 1.2 },
  contextTitle: { fontFamily: "Georgia, serif", fontSize: 18, marginTop: 7 },
  contextMeta: { fontSize: 10, marginTop: 4 },
  contextRule: { height: 1, marginTop: 10, marginBottom: 8 },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 20 },
  bottomNote: { flex: 1, fontSize: 9, lineHeight: 14 },
  next: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36 },
  nextText: { fontSize: 11, fontWeight: "700" },
});
