import React, { useState } from "react";
import { Feather, Modal, Platform, Pressable, StyleSheet, Text, View, useSafeAreaInsets, useT } from "./rnDom";

interface DateTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  mode: "date" | "datetime";
  label: string;
  primaryColor: string;
  optional?: boolean;
  labelColor?: string;
  rowBg?: string;
  valueColor?: string;
  chevronColor?: string;
  isDark?: boolean;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDatetime(date: Date): string {
  return `${formatDate(date)}  ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function LocalDateTimeControl({ value, mode, onChange }: { value: Date; mode: "date" | "time"; onChange: (date: Date) => void }) {
  const dateValue = mode === "date" ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}` : `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  return <input aria-label={mode === "date" ? "Choose date" : "Choose time"} type={mode} value={dateValue} onChange={(event) => {
    const next = new Date(value);
    if (mode === "date") {
      const [year, month, day] = event.target.value.split("-").map(Number);
      next.setFullYear(year, month - 1, day);
    } else {
      const [hours, minutes] = event.target.value.split(":").map(Number);
      next.setHours(hours, minutes, 0, 0);
    }
    onChange(next);
  }} style={{ display: "block", margin: "12px auto", maxWidth: "100%", color: "inherit", font: "inherit" }} />;
}

export function DateTimePicker({
  value, onChange, mode, label, primaryColor, optional = false,
  labelColor = "rgba(255,255,255,0.55)", rowBg = "#1A1A1E",
  valueColor = "#fff", chevronColor = "rgba(255,255,255,0.35)", isDark = true,
}: DateTimePickerProps) {
  const [showIOS, setShowIOS] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [timeDraft, setTimeDraft] = useState<Date>(value);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const formatted = mode === "datetime" ? formatDatetime(value) : formatDate(value);
  const formattedTime = value.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const openTimePicker = () => { setTimeDraft(new Date(value)); setShowTimeModal(true); };
  const closeTimePicker = () => setShowTimeModal(false);
  const saveTime = () => {
    const combined = new Date(value);
    combined.setHours(timeDraft.getHours(), timeDraft.getMinutes(), 0, 0);
    onChange(combined);
    setShowTimeModal(false);
    setShowIOS(false);
  };
  const labelContent = !!label && <Text style={[styles.label, { color: labelColor }]}>{label}{!optional && <Text style={{ color: "#FF6B6B" }}> *</Text>}</Text>;
  if ((Platform.OS as string) === "android") {
    return <View>{labelContent}<Pressable accessibilityRole="button" testID={`date-time-picker-${mode}`} onPress={() => setShowIOS((current) => !current)} style={[styles.row, { backgroundColor: rowBg, borderColor: primaryColor + "40" }]}><Feather name="calendar" size={16} color={valueColor} /><Text style={[styles.valueText, { color: valueColor }]}>{formatted}</Text><Text style={[styles.chevron, { color: chevronColor }]}>›</Text></Pressable>{showIOS ? <LocalDateTimeControl value={value} mode="date" onChange={onChange} /> : null}</View>;
  }
  return (
    <View>
      {labelContent}
      <Pressable accessibilityRole="button" testID={`date-time-picker-${mode}`} onPress={() => setShowIOS((v) => !v)} style={[styles.row, { backgroundColor: rowBg, borderColor: primaryColor + "40" }]}>
        <Feather name="calendar" size={16} color={valueColor} />
        <Text style={[styles.valueText, { color: valueColor }]}>{formatted}</Text>
        <Text style={[styles.chevron, { color: chevronColor }, showIOS && styles.chevronOpen]}>›</Text>
      </Pressable>
      {showIOS && (
        <View style={[styles.iosPickerWrap, { backgroundColor: rowBg, borderColor: primaryColor + "25" }]}>
          <LocalDateTimeControl value={value} mode="date" onChange={onChange} />
          {mode === "datetime" ? (
            <View style={[styles.iosTimeRow, { borderTopColor: primaryColor + "25" }]}>
              <View style={styles.iosTimeLabel}><Feather name="clock" size={15} color={primaryColor} /><Text style={[styles.iosTimeText, { color: valueColor }]}>{t("dateTime.time")}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel={`${t("dateTime.time")}, ${formattedTime}`} testID="date-time-picker-edit-time" onPress={openTimePicker} style={styles.timeValueButton}>
                <Text style={[styles.iosTimeText, { color: valueColor }]}>{formattedTime}</Text><Feather name="edit-2" size={14} color={primaryColor} />
              </Pressable>
            </View>
          ) : null}
        </View>
      )}
      {mode === "datetime" ? (
        <Modal animationType="slide" transparent visible={showTimeModal} onRequestClose={closeTimePicker} testID="date-time-picker-time-modal">
          <View style={styles.modalRoot}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")} testID="date-time-picker-time-backdrop" onPress={closeTimePicker} style={styles.modalBackdrop} />
            <View style={[styles.timeSheet, { backgroundColor: rowBg, borderColor: primaryColor + "35", paddingBottom: Math.max(insets.bottom, 18) }]}>
              <View style={styles.timeSheetHeader}>
                <Pressable accessibilityRole="button" testID="date-time-picker-time-cancel" onPress={closeTimePicker} hitSlop={8}><Text style={[styles.timeSheetAction, { color: labelColor }]}>{t("common.cancel")}</Text></Pressable>
                <Text style={[styles.timeSheetTitle, { color: valueColor }]}>{t("dateTime.time")}</Text>
                <Pressable accessibilityRole="button" testID="date-time-picker-time-save" onPress={saveTime} hitSlop={8}><Text style={[styles.timeSheetAction, { color: primaryColor }]}>{t("common.save")}</Text></Pressable>
              </View>
              <LocalDateTimeControl value={timeDraft} mode="time" onChange={(picked) => setTimeDraft(new Date(picked))} />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  valueText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  chevron: { fontSize: 20, lineHeight: 22 },
  chevronOpen: { transform: [{ rotate: "90deg" }] },
  iosPickerWrap: { marginTop: 4, borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  iosTimeRow: { minHeight: 52, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iosTimeLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  iosTimeText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  timeValueButton: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 44, paddingHorizontal: 8 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.42)" },
  timeSheet: { borderTopLeftRadius: 34, borderTopRightRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 22, paddingTop: 14 },
  timeSheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 42 },
  timeSheetTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  timeSheetAction: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
