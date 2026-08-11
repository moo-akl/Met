/**
 * Shared DateTimePicker component.
 *
 * iOS  — inline spinner wheel, toggled open/closed by tapping the row.
 * Android — modal picker opened via DateTimePickerAndroid.open().
 *
 * Props:
 *   value        — current Date value
 *   onChange     — called with the new Date when the user confirms a selection
 *   mode         — 'date' (date only) or 'datetime' (date + time)
 *   label        — field label shown above the picker row
 *   primaryColor — accent colour used for the border
 *   optional     — when true the label does NOT get the " *" required marker
 *
 * Theme props (all optional — defaults to the original Aurora/dark values):
 *   labelColor   — colour of the field label text
 *   rowBg        — background colour of the picker row
 *   valueColor   — colour of the formatted date/time text
 *   chevronColor — colour of the "›" arrow
 *   isDark       — drives iOS themeVariant + textColor (true = dark, false = light)
 */
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import RNDateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDatetime(date: Date): string {
  return (
    date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) +
    "  " +
    date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

// ─── component ──────────────────────────────────────────────────────────────

interface DateTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  mode: "date" | "datetime";
  label: string;
  primaryColor: string;
  optional?: boolean;
  /** Colour of the field label. Defaults to dark-theme muted white. */
  labelColor?: string;
  /** Background of the picker row. Defaults to #1A1A1E. */
  rowBg?: string;
  /** Colour of the formatted date/time text. Defaults to #fff. */
  valueColor?: string;
  /** Colour of the "›" chevron. Defaults to rgba(255,255,255,0.35). */
  chevronColor?: string;
  /** Drives iOS themeVariant ("dark" | "light") and textColor. Defaults to true (dark). */
  isDark?: boolean;
}

export function DateTimePicker({
  value,
  onChange,
  mode,
  label,
  primaryColor,
  optional = false,
  labelColor = "rgba(255,255,255,0.55)",
  rowBg = "#1A1A1E",
  valueColor = "#fff",
  chevronColor = "rgba(255,255,255,0.35)",
  isDark = true,
}: DateTimePickerProps) {
  const [showIOS, setShowIOS] = useState(false);

  const formatted =
    mode === "datetime" ? formatDatetime(value) : formatDate(value);

  // ── Android ───────────────────────────────────────────────────────────────
  if (Platform.OS === "android") {
    const openAndroid = () => {
      DateTimePickerAndroid.open({
        value,
        mode: "date",
        onChange: (_evt, picked) => {
          if (!picked) return;
          if (mode === "date") {
            onChange(picked);
            return;
          }
          // For datetime: after picking date, open time picker
          DateTimePickerAndroid.open({
            value: picked,
            mode: "time",
            is24Hour: true,
            onChange: (_evt2, pickedTime) => {
              if (!pickedTime) return;
              onChange(pickedTime);
            },
          });
        },
      });
    };

    return (
      <View>
        {!!label && (
          <Text style={[styles.label, { color: labelColor }]}>
            {label}
            {!optional && <Text style={{ color: "#FF6B6B" }}> *</Text>}
          </Text>
        )}
        <Pressable
          onPress={openAndroid}
          style={[styles.row, { backgroundColor: rowBg, borderColor: primaryColor + "40" }]}
        >
          <Text style={styles.calIcon}>📅</Text>
          <Text style={[styles.valueText, { color: valueColor }]}>{formatted}</Text>
          <Text style={[styles.chevron, { color: chevronColor }]}>›</Text>
        </Pressable>
      </View>
    );
  }

  // ── iOS ───────────────────────────────────────────────────────────────────
  return (
    <View>
      {!!label && (
        <Text style={[styles.label, { color: labelColor }]}>
          {label}
          {!optional && <Text style={{ color: "#FF6B6B" }}> *</Text>}
        </Text>
      )}
      <Pressable
        onPress={() => setShowIOS((v) => !v)}
        style={[styles.row, { backgroundColor: rowBg, borderColor: primaryColor + "40" }]}
      >
        <Text style={styles.calIcon}>📅</Text>
        <Text style={[styles.valueText, { color: valueColor }]}>{formatted}</Text>
        <Text style={[styles.chevron, { color: chevronColor }, showIOS && styles.chevronOpen]}>›</Text>
      </Pressable>

      {showIOS && (
        <View style={[styles.iosPickerWrap, { backgroundColor: rowBg }]}>
          <RNDateTimePicker
            value={value}
            mode={mode}
            display="spinner"
            textColor={isDark ? "#fff" : "#0D0D0D"}
            themeVariant={isDark ? "dark" : "light"}
            onChange={(_evt, picked) => {
              if (picked) onChange(picked);
            }}
            style={styles.iosPicker}
          />
        </View>
      )}
    </View>
  );
}

// ─── styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  calIcon: {
    fontSize: 16,
  },
  valueText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  chevron: {
    fontSize: 20,
    lineHeight: 22,
  },
  chevronOpen: {
    transform: [{ rotate: "90deg" }],
  },
  iosPickerWrap: {
    marginTop: 4,
    borderRadius: 10,
    overflow: "hidden",
  },
  iosPicker: {
    height: 160,
  },
});
