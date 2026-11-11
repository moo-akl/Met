/**
 * Shared DateTimePicker component.
 *
 * iOS  — native calendar popover with an in-app time sheet that requires Save.
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
import React, { useRef, useState } from "react";
import { Feather } from "@expo/vector-icons";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import RNDateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "@/lib/i18n";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDatetime(date: Date, locale: string): string {
  return (
    date.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) +
    "  " +
    date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
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
  /** Use an expandable time control instead of the default time sheet. */
  timePickerPresentation?: "sheet" | "dropdown" | "wheels";
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
  timePickerPresentation = "sheet",
}: DateTimePickerProps) {
  const [showIOS, setShowIOS] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showWheelModal, setShowWheelModal] = useState(false);
  const [timeDraft, setTimeDraft] = useState<Date>(value);
  const [wheelDraft, setWheelDraft] = useState<Date>(value);
  const [calendarTop, setCalendarTop] = useState(100);
  const calendarAnchorRef = useRef<View | null>(null);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t, lang } = useT();
  const useTimeDropdown =
    mode === "datetime" && timePickerPresentation === "dropdown";
  const useTimeWheels =
    mode === "datetime" && timePickerPresentation === "wheels";

  const formatted =
    mode === "datetime" ? formatDatetime(value, lang) : formatDate(value, lang);
  const formattedTime = value.toLocaleTimeString(lang, {
    hour: "numeric",
    minute: "2-digit",
  });

  const openTimePicker = () => {
    setTimeDraft(new Date(value));
    setShowTimeModal(true);
  };

  const toggleTimeDropdown = () => {
    if (!showTimeDropdown) setTimeDraft(new Date(value));
    setShowTimeDropdown((current) => !current);
  };

  const closeTimePicker = () => setShowTimeModal(false);

  const saveTime = () => {
    const combined = new Date(value);
    combined.setHours(timeDraft.getHours(), timeDraft.getMinutes(), 0, 0);
    onChange(combined);
    setShowTimeModal(false);
    setShowIOS(false);
  };

  const saveDropdownTime = () => {
    const combined = new Date(value);
    combined.setHours(timeDraft.getHours(), timeDraft.getMinutes(), 0, 0);
    onChange(combined);
    setShowTimeDropdown(false);
  };

  const openWheelPicker = () => {
    setWheelDraft(new Date(value));
    setShowWheelModal(true);
  };

  const saveWheelSelection = () => {
    onChange(new Date(wheelDraft));
    setShowWheelModal(false);
  };

  const openCalendar = () => {
    calendarAnchorRef.current?.measureInWindow?.((_x, y, _width, height) => {
      const belowAnchor = y + height + 8;
      const estimatedCalendarHeight = 420;
      setCalendarTop(
        belowAnchor + estimatedCalendarHeight <= windowHeight
          ? belowAnchor
          : Math.max(12, y - estimatedCalendarHeight - 8),
      );
    });
    setShowIOS(true);
  };

  // Hangout creation uses one explicit-save date/time editor on native
  // platforms so wheel changes never partially update the form.
  if (useTimeWheels && Platform.OS !== "web") {
    return (
      <View>
        {!!label && (
          <Text style={[styles.label, { color: labelColor }]}>
            {label}
            {!optional && <Text style={{ color: "#FF6B6B" }}> *</Text>}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${formatted}`}
          testID={`date-time-picker-${mode}`}
          onPress={openWheelPicker}
          style={[styles.row, { backgroundColor: rowBg, borderColor: primaryColor + "40" }]}
        >
          <Feather name="calendar" size={16} color={valueColor} />
          <Text style={[styles.valueText, { color: valueColor }]}>{formatted}</Text>
          <Text style={[styles.chevron, { color: chevronColor }]}>›</Text>
        </Pressable>
        <Modal
          animationType="slide"
          transparent
          visible={showWheelModal}
          onRequestClose={() => setShowWheelModal(false)}
          presentationStyle="overFullScreen"
          testID="date-time-picker-wheels-modal"
        >
          <View
            style={[
              styles.wheelModalRoot,
              { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              testID="date-time-picker-wheels-backdrop"
              onPress={() => setShowWheelModal(false)}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.wheelModalCard,
                { backgroundColor: rowBg, borderColor: primaryColor + "40" },
              ]}
            >
              <View style={styles.wheelModalHeader}>
                <Text style={[styles.wheelModalTitle, { color: valueColor }]}>{label}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("common.close")}
                  testID="date-time-picker-wheels-close"
                  onPress={() => setShowWheelModal(false)}
                  hitSlop={10}
                >
                  <Feather name="x" size={21} color={valueColor} />
                </Pressable>
              </View>
              <RNDateTimePicker
                testID="date-time-picker-date-wheel"
                value={wheelDraft}
                mode="date"
                display="spinner"
                themeVariant={isDark ? "dark" : "light"}
                textColor={valueColor}
                onChange={(_event, picked) => {
                  if (!picked) return;
                  setWheelDraft((current) => {
                    const next = new Date(current);
                    next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
                    return next;
                  });
                }}
                style={styles.wheelPicker}
              />
              <View style={[styles.wheelTimeDivider, { borderTopColor: primaryColor + "30" }]}>
                <Text style={[styles.wheelTimeLabel, { color: labelColor }]}>{t("dateTime.time")}</Text>
              </View>
              <RNDateTimePicker
                testID="date-time-picker-time-wheel"
                value={wheelDraft}
                mode="time"
                display="spinner"
                themeVariant={isDark ? "dark" : "light"}
                textColor={valueColor}
                onChange={(_event, picked) => {
                  if (!picked) return;
                  setWheelDraft((current) => {
                    const next = new Date(current);
                    next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
                    return next;
                  });
                }}
                style={styles.wheelPicker}
              />
              <Pressable
                accessibilityRole="button"
                testID="date-time-picker-wheels-save"
                onPress={saveWheelSelection}
                style={[styles.wheelSaveButton, { backgroundColor: primaryColor }]}
              >
                <Text style={styles.wheelSaveText}>{t("common.save")}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── Android ───────────────────────────────────────────────────────────────
  if (Platform.OS === "android") {
    if (useTimeDropdown) {
      const openAndroidDate = () => {
        DateTimePickerAndroid.open({
          value,
          mode: "date",
          onChange: (_evt, picked) => {
            if (!picked) return;
            const combined = new Date(value);
            combined.setFullYear(
              picked.getFullYear(),
              picked.getMonth(),
              picked.getDate(),
            );
            onChange(combined);
          },
        });
      };

      const openAndroidTime = () => {
        DateTimePickerAndroid.open({
          value,
          mode: "time",
          is24Hour: true,
          onChange: (_evt, picked) => {
            if (!picked) return;
            const combined = new Date(value);
            combined.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
            onChange(combined);
            setShowTimeDropdown(false);
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
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${formatDate(value, lang)}`}
            testID={`date-time-picker-${mode}`}
            onPress={openAndroidDate}
            style={[styles.row, { backgroundColor: rowBg, borderColor: primaryColor + "40" }]}
          >
            <Feather name="calendar" size={16} color={valueColor} />
            <Text style={[styles.valueText, { color: valueColor }]}>{formatDate(value, lang)}</Text>
            <Feather name="chevron-down" size={18} color={chevronColor} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t("dateTime.time")}, ${formattedTime}`}
            accessibilityState={{ expanded: showTimeDropdown }}
            testID="date-time-picker-time-toggle"
            onPress={toggleTimeDropdown}
            style={[
              styles.timeDropdownToggle,
              { backgroundColor: rowBg, borderColor: primaryColor + "40" },
            ]}
          >
            <Feather name="clock" size={16} color={primaryColor} />
            <Text style={[styles.valueText, { color: valueColor }]}>{formattedTime}</Text>
            <Feather
              name="chevron-down"
              size={18}
              color={chevronColor}
              style={showTimeDropdown ? styles.chevronDropdownOpen : undefined}
            />
          </Pressable>
          {showTimeDropdown ? (
            <View
              testID="date-time-picker-time-dropdown"
              style={[styles.timeDropdown, { backgroundColor: rowBg, borderColor: primaryColor + "25" }]}
            >
              <Text style={[styles.timeDropdownHint, { color: labelColor }]}>
                {t("dateTime.time")}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("dateTime.time")}, ${formattedTime}`}
                testID="date-time-picker-time-open"
                onPress={openAndroidTime}
                style={[styles.timeOpenButton, { borderColor: primaryColor + "40" }]}
              >
                <Text style={[styles.iosTimeText, { color: valueColor }]}>{formattedTime}</Text>
                <Feather name="arrow-up-right" size={16} color={primaryColor} />
              </Pressable>
            </View>
          ) : null}
        </View>
      );
    }

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
          // Preserve the selected time while choosing a date, then combine
          // the picked date and time explicitly.
          const dateWithCurrentTime = new Date(picked);
          dateWithCurrentTime.setHours(value.getHours(), value.getMinutes(), 0, 0);
          DateTimePickerAndroid.open({
            value: dateWithCurrentTime,
            mode: "time",
            is24Hour: true,
            onChange: (_evt2, pickedTime) => {
              if (!pickedTime) return;
              const combined = new Date(dateWithCurrentTime);
              combined.setHours(pickedTime.getHours(), pickedTime.getMinutes(), 0, 0);
              onChange(combined);
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
          accessibilityRole="button"
          testID={`date-time-picker-${mode}`}
          onPress={openAndroid}
          style={[styles.row, { backgroundColor: rowBg, borderColor: primaryColor + "40" }]}
        >
          <Feather name="calendar" size={16} color={valueColor} />
          <Text style={[styles.valueText, { color: valueColor }]}>{formatted}</Text>
          <Text style={[styles.chevron, { color: chevronColor }]}>›</Text>
        </Pressable>
      </View>
    );
  }

  // ── iOS ───────────────────────────────────────────────────────────────────
  return (
    <View ref={calendarAnchorRef} collapsable={false}>
      {!!label && (
        <Text style={[styles.label, { color: labelColor }]}>
          {label}
          {!optional && <Text style={{ color: "#FF6B6B" }}> *</Text>}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
          accessibilityLabel={`${label}, ${useTimeDropdown ? formatDate(value, lang) : formatted}`}
        testID={`date-time-picker-${mode}`}
        onPress={() => (showIOS ? setShowIOS(false) : openCalendar())}
        style={[styles.row, { backgroundColor: rowBg, borderColor: primaryColor + "40" }]}
      >
        <Feather name="calendar" size={16} color={valueColor} />
        <Text style={[styles.valueText, { color: valueColor }]}>
          {useTimeDropdown ? formatDate(value, lang) : formatted}
        </Text>
        <Text style={[styles.chevron, { color: chevronColor }, showIOS && styles.chevronOpen]}>›</Text>
      </Pressable>

      {showIOS ? (
        <Modal
          animationType="fade"
          transparent
          visible
          onRequestClose={() => setShowIOS(false)}
          presentationStyle="overFullScreen"
          testID="date-time-picker-calendar-modal"
        >
          <View style={styles.calendarModalRoot}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              testID="date-time-picker-calendar-backdrop"
              onPress={() => setShowIOS(false)}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.iosPickerWrap,
                {
                  top: calendarTop,
                  left: Math.max(12, (windowWidth - Math.min(windowWidth - 24, 400)) / 2),
                  width: Math.min(windowWidth - 24, 400),
                  backgroundColor: rowBg,
                  borderColor: primaryColor + "25",
                },
              ]}
            >
              <RNDateTimePicker
                testID={`date-time-picker-${mode}-calendar`}
                value={value}
                mode="date"
                display="inline"
                textColor={isDark ? "#fff" : "#0D0D0D"}
                themeVariant={isDark ? "dark" : "light"}
                onChange={(_evt, picked) => {
                  if (!picked) return;
                  const combined = new Date(value);
                  combined.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
                  onChange(combined);
                }}
                style={styles.iosCalendar}
              />
              {mode === "datetime" && !useTimeDropdown ? (
                <View style={[styles.iosTimeRow, { borderTopColor: primaryColor + "25" }]}>
                  <View style={styles.iosTimeLabel}>
                    <Feather name="clock" size={15} color={primaryColor} />
                    <Text style={[styles.iosTimeText, { color: valueColor }]}>{t("dateTime.time")}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t("dateTime.time")}, ${formattedTime}`}
                    testID="date-time-picker-edit-time"
                    onPress={openTimePicker}
                    style={styles.timeValueButton}
                  >
                    <Text style={[styles.iosTimeText, { color: valueColor }]}>{formattedTime}</Text>
                    <Feather name="edit-2" size={14} color={primaryColor} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        </Modal>
      ) : null}
      {useTimeDropdown ? (
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t("dateTime.time")}, ${formattedTime}`}
            accessibilityState={{ expanded: showTimeDropdown }}
            testID="date-time-picker-time-toggle"
            onPress={toggleTimeDropdown}
            style={[
              styles.timeDropdownToggle,
              { backgroundColor: rowBg, borderColor: primaryColor + "40" },
            ]}
          >
            <Feather name="clock" size={16} color={primaryColor} />
            <Text style={[styles.valueText, { color: valueColor }]}>{formattedTime}</Text>
            <Feather
              name="chevron-down"
              size={18}
              color={chevronColor}
              style={showTimeDropdown ? styles.chevronDropdownOpen : undefined}
            />
          </Pressable>
          {showTimeDropdown ? (
            <View
              testID="date-time-picker-time-dropdown"
              style={[styles.timeDropdown, { backgroundColor: rowBg, borderColor: primaryColor + "25" }]}
            >
              <RNDateTimePicker
                testID="date-time-picker-time"
                value={timeDraft}
                mode="time"
                display="spinner"
                textColor={isDark ? "#fff" : "#0D0D0D"}
                themeVariant={isDark ? "dark" : "light"}
                onChange={(_evt, picked) => {
                  if (picked) setTimeDraft(new Date(picked));
                }}
                style={styles.iosTimePicker}
              />
              <View style={styles.timeDropdownActions}>
                <Pressable
                  accessibilityRole="button"
                  testID="date-time-picker-time-cancel"
                  onPress={() => setShowTimeDropdown(false)}
                  hitSlop={8}
                >
                  <Text style={[styles.timeSheetAction, { color: labelColor }]}>{t("common.cancel")}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  testID="date-time-picker-time-save"
                  onPress={saveDropdownTime}
                  hitSlop={8}
                >
                  <Text style={[styles.timeSheetAction, { color: primaryColor }]}>{t("common.save")}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
      {mode === "datetime" && !useTimeDropdown ? (
        <Modal
          animationType="slide"
          transparent
          visible={showTimeModal}
          onRequestClose={closeTimePicker}
          testID="date-time-picker-time-modal"
        >
          <View style={styles.modalRoot}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              testID="date-time-picker-time-backdrop"
              onPress={closeTimePicker}
              style={styles.modalBackdrop}
            />
            <View
              style={[
                styles.timeSheet,
                {
                  backgroundColor: rowBg,
                  borderColor: primaryColor + "35",
                  paddingBottom: Math.max(insets.bottom, 18),
                },
              ]}
            >
              <View style={styles.timeSheetHeader}>
                <Pressable
                  accessibilityRole="button"
                  testID="date-time-picker-time-cancel"
                  onPress={closeTimePicker}
                  hitSlop={8}
                >
                  <Text style={[styles.timeSheetAction, { color: labelColor }]}>{t("common.cancel")}</Text>
                </Pressable>
                <Text style={[styles.timeSheetTitle, { color: valueColor }]}>{t("dateTime.time")}</Text>
                <Pressable
                  accessibilityRole="button"
                  testID="date-time-picker-time-save"
                  onPress={saveTime}
                  hitSlop={8}
                >
                  <Text style={[styles.timeSheetAction, { color: primaryColor }]}>{t("common.save")}</Text>
                </Pressable>
              </View>
              <RNDateTimePicker
                testID="date-time-picker-time"
                value={timeDraft}
                mode="time"
                display="spinner"
                textColor={isDark ? "#fff" : "#0D0D0D"}
                themeVariant={isDark ? "dark" : "light"}
                onChange={(_evt, picked) => {
                  if (picked) setTimeDraft(new Date(picked));
                }}
                style={styles.iosTimePicker}
              />
            </View>
          </View>
        </Modal>
      ) : null}
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
  chevronDropdownOpen: {
    transform: [{ rotate: "180deg" }],
  },
  iosPickerWrap: {
    position: "absolute",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  calendarModalRoot: { flex: 1 },
  iosCalendar: {
    alignSelf: "center",
    width: "100%",
  },
  iosTimeRow: {
    minHeight: 52,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iosTimeLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  iosTimeText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  timeValueButton: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 44, paddingHorizontal: 8 },
  timeDropdownToggle: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timeDropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: "hidden",
  },
  timeDropdownHint: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  timeOpenButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeDropdownActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.42)" },
  timeSheet: {
    borderTopLeftRadius: 34,
    borderTopRightRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingTop: 14,
  },
  timeSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 42,
  },
  timeSheetTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  timeSheetAction: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  iosTimePicker: { alignSelf: "center", width: "100%", height: 190 },
  wheelModalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  wheelModalCard: {
    borderWidth: 1,
    borderTopLeftRadius: 28,
    borderBottomRightRadius: 24,
    padding: 16,
    overflow: "hidden",
  },
  wheelModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 4,
  },
  wheelModalTitle: { fontSize: 17, fontWeight: "700" },
  wheelPicker: { height: 160 },
  wheelTimeDivider: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9 },
  wheelTimeLabel: { fontSize: 12, fontWeight: "600" },
  wheelSaveButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 18,
    borderBottomRightRadius: 18,
    marginTop: 10,
  },
  wheelSaveText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
