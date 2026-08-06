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
 *   primaryColor — accent colour from useColors()
 *   optional     — when true the label does NOT get the " *" required marker
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
}

export function DateTimePicker({
  value,
  onChange,
  mode,
  label,
  primaryColor,
  optional = false,
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
        <Text style={styles.label}>
          {label}
          {!optional && <Text style={{ color: "#FF6B6B" }}> *</Text>}
        </Text>
        <Pressable
          onPress={openAndroid}
          style={[styles.row, { borderColor: primaryColor + "40" }]}
        >
          <Text style={styles.calIcon}>📅</Text>
          <Text style={styles.valueText}>{formatted}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>
    );
  }

  // ── iOS ───────────────────────────────────────────────────────────────────
  return (
    <View>
      <Text style={styles.label}>
        {label}
        {!optional && <Text style={{ color: "#FF6B6B" }}> *</Text>}
      </Text>
      <Pressable
        onPress={() => setShowIOS((v) => !v)}
        style={[styles.row, { borderColor: primaryColor + "40" }]}
      >
        <Text style={styles.calIcon}>📅</Text>
        <Text style={styles.valueText}>{formatted}</Text>
        <Text style={[styles.chevron, showIOS && styles.chevronOpen]}>›</Text>
      </Pressable>

      {showIOS && (
        <View style={styles.iosPickerWrap}>
          <RNDateTimePicker
            value={value}
            mode={mode}
            display="spinner"
            textColor="#fff"
            themeVariant="dark"
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
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1E",
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
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  chevron: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 20,
    lineHeight: 22,
  },
  chevronOpen: {
    transform: [{ rotate: "90deg" }],
  },
  iosPickerWrap: {
    marginTop: 4,
    backgroundColor: "#1A1A1E",
    borderRadius: 10,
    overflow: "hidden",
  },
  iosPicker: {
    height: 160,
  },
});
