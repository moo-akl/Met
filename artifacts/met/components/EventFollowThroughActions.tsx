import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { EventFeedItem } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { addEventToCalendar } from "@/lib/addToCalendar";
import {
  cancelEventReminder,
  DEFAULT_EVENT_REMINDER_SETTINGS,
  loadEventReminder,
  scheduleEventReminder,
  type EventReminderLeadMinutes,
  type EventReminderSettings,
  type QuietHoursChoice,
  type StoredEventReminder,
} from "@/lib/eventReminders";
import { requestNotificationPermission } from "@/lib/notifications";

type Props = {
  event: EventFeedItem;
  uid: string | null;
};

const LEAD_OPTIONS: { value: EventReminderLeadMinutes; labelKey: string }[] = [
  { value: 0, labelKey: "atStart" },
  { value: 15, labelKey: "mins15" },
  { value: 60, labelKey: "hour1" },
  { value: 360, labelKey: "hours6" },
];

const QUIET_OPTIONS: { value: QuietHoursChoice; labelKey: string }[] = [
  { value: "22-08", labelKey: "quiet10" },
  { value: "23-07", labelKey: "quiet11" },
  { value: "off", labelKey: "quietOff" },
];

export default function EventFollowThroughActions({ event, uid }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const [reminder, setReminder] = useState<StoredEventReminder | null>(null);
  const [settings, setSettings] = useState<EventReminderSettings>(
    DEFAULT_EVENT_REMINDER_SETTINGS,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState<"calendar" | "reminder" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!uid) {
      setReminder(null);
      return () => {
        active = false;
      };
    }

    void loadEventReminder(uid, event.eventType, event.id)
      .then(async (saved) => {
        if (!active) return;
        if (saved && saved.startsAt !== event.startsAt) {
          try {
            const updated = await scheduleEventReminder({
              uid,
              event: { ...event, location: event.location ?? event.venueName },
              settings: saved.settings,
              notificationTitle: t("eventFollowThrough.reminder"),
              genericBody: t("eventFollowThrough.genericBody"),
            });
            if (active) setReminder(updated);
            return;
          } catch {
            await cancelEventReminder(uid, event.eventType, event.id).catch(() => {});
            if (active) setReminder(null);
            return;
          }
        }
        if (active) setReminder(saved);
      })
      .catch(() => {
        if (active) setReminder(null);
      });

    return () => {
      active = false;
    };
  }, [event, uid, t]);

  const exportToCalendar = async () => {
    if (Platform.OS === "web") {
      setError(t("eventFollowThrough.unsupported"));
      return;
    }
    setBusy("calendar");
    setError("");
    setMessage("");
    try {
      const result = await addEventToCalendar(event, uid);
      if (result.status === "permission-denied") {
        setError(t("eventFollowThrough.calendarPermissionRequired"));
        if (!result.canAskAgain) {
          Alert.alert(
            t("eventFollowThrough.calendar"),
            t("eventFollowThrough.calendarPermissionRequired"),
            [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("common.open"),
                onPress: () => void Linking.openSettings().catch(() => undefined),
              },
            ],
          );
        }
        return;
      }
      setMessage(t("eventFollowThrough.calendarAdded"));
    } catch (cause) {
      console.warn("[calendar] couldn't add event to the device calendar", cause);
      setError(t("eventFollowThrough.calendarError"));
    } finally {
      setBusy(null);
    }
  };

  const saveReminder = async () => {
    if (!uid) return;
    setBusy("reminder");
    setError("");
    setMessage("");
    try {
      if (Platform.OS === "web") {
        setError(t("eventFollowThrough.unsupported"));
        return;
      }
      const granted = await requestNotificationPermission();
      if (!granted) {
        setError(t("eventFollowThrough.denied"));
        Alert.alert(t("eventFollowThrough.reminder"), t("eventFollowThrough.denied"), [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.open"), onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
      const saved = await scheduleEventReminder({
        uid,
        event: { ...event, location: event.location ?? event.venueName },
        settings,
        notificationTitle: t("eventFollowThrough.reminder"),
        genericBody: t("eventFollowThrough.genericBody"),
      });
      setReminder(saved);
      setMessage(t("eventFollowThrough.saved"));
      setSheetOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "REMINDER_TIME_UNAVAILABLE"
          ? t("eventFollowThrough.unavailable")
          : t("common.error"),
      );
    } finally {
      setBusy(null);
    }
  };

  const turnOffReminder = async () => {
    if (!uid) return;
    setBusy("reminder");
    setError("");
    setMessage("");
    try {
      await cancelEventReminder(uid, event.eventType, event.id);
      setReminder(null);
      setMessage(t("eventFollowThrough.removed"));
      setSheetOpen(false);
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("eventFollowThrough.calendar")}
          testID="event-add-to-calendar"
          disabled={busy !== null}
          onPress={() => void exportToCalendar()}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed || busy === "calendar" ? 0.7 : 1 },
          ]}
        >
          {busy === "calendar" ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="calendar" size={17} color={colors.primary} />
          )}
          <Text style={[styles.actionText, { color: colors.text }]}>
            {busy === "calendar"
              ? t("eventFollowThrough.calendarAdding")
              : t("eventFollowThrough.calendar")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("eventFollowThrough.remindAt")}
          testID="event-reminder-open"
          disabled={!uid || busy !== null}
          onPress={() => {
            setSettings(reminder?.settings ?? DEFAULT_EVENT_REMINDER_SETTINGS);
            setError("");
            setSheetOpen(true);
          }}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: reminder ? colors.primarySoft : colors.card, borderColor: reminder ? colors.primary : colors.border, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Feather name="bell" size={17} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.text }]}>
            {t("eventFollowThrough.remindAt")}
          </Text>
        </Pressable>
      </View>
      {message ? (
        <Text accessibilityRole="text" testID="event-follow-through-message" style={[styles.feedback, { color: colors.primary }]}>
          {message}
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" testID="event-follow-through-error" style={[styles.feedback, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}

      <Modal
        transparent
        animationType="slide"
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            testID="event-reminder-backdrop"
            onPress={() => setSheetOpen(false)}
            style={styles.backdrop}
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 18),
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeading}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                  {t("eventFollowThrough.reminder")}
                </Text>
                <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {event.title}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
                testID="event-reminder-close"
                onPress={() => setSheetOpen(false)}
                hitSlop={10}
                style={styles.closeButton}
              >
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                {t("eventFollowThrough.remindAt")}
              </Text>
              <View style={styles.optionList}>
                {LEAD_OPTIONS.map(({ value, labelKey }) => {
                  const selected = settings.leadMinutes === value;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      testID={`event-reminder-lead-${value}`}
                      onPress={() => setSettings((current) => ({ ...current, leadMinutes: value }))}
                      style={[
                        styles.option,
                        {
                          backgroundColor: selected ? colors.primarySoft : colors.card,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.optionText, { color: selected ? colors.primary : colors.text }]}>
                        {t(`eventFollowThrough.${labelKey}`)}
                      </Text>
                      {selected ? <Feather name="check" size={17} color={colors.primary} /> : null}
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                {t("eventFollowThrough.quiet")}
              </Text>
              <View style={styles.quietChoices}>
                {QUIET_OPTIONS.map(({ value, labelKey }) => {
                  const selected = settings.quietHours === value;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      testID={`event-reminder-quiet-${value}`}
                      onPress={() => setSettings((current) => ({ ...current, quietHours: value }))}
                      style={[
                        styles.quietChoice,
                        {
                          backgroundColor: selected ? colors.primarySoft : colors.card,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.quietText, { color: selected ? colors.primary : colors.text }]}>
                        {t(`eventFollowThrough.${labelKey}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                {t("eventFollowThrough.localTimeHint")}
              </Text>

              <View style={[styles.privacyRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <View style={styles.privacyCopy}>
                  <Text style={[styles.privacyTitle, { color: colors.text }]}>
                    {t("eventFollowThrough.showDetails")}
                  </Text>
                  <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                    {t("eventFollowThrough.privateHint")}
                  </Text>
                </View>
                <Switch
                  testID="event-reminder-show-details"
                  value={settings.showDetails}
                  onValueChange={(showDetails) => setSettings((current) => ({ ...current, showDetails }))}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.card}
                />
              </View>

              {error ? (
                <Text accessibilityRole="alert" style={[styles.feedback, { color: colors.destructive }]}>
                  {error}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                testID="event-reminder-save"
                disabled={busy !== null}
                onPress={() => void saveReminder()}
                style={({ pressed }) => [
                  styles.saveButton,
                  { backgroundColor: colors.primary, opacity: pressed || busy === "reminder" ? 0.72 : 1 },
                ]}
              >
                {busy === "reminder" ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={[styles.saveText, { color: colors.primaryForeground }]}>
                    {t("eventFollowThrough.save")}
                  </Text>
                )}
              </Pressable>
              {reminder ? (
                <Pressable
                  accessibilityRole="button"
                  testID="event-reminder-turn-off"
                  disabled={busy !== null}
                  onPress={() => void turnOffReminder()}
                  style={styles.turnOffButton}
                >
                  <Text style={[styles.turnOffText, { color: colors.destructive }]}>
                    {t("eventFollowThrough.turnOff")}
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  actions: { flexDirection: "row", gap: 10 },
  actionButton: {
    minHeight: 48,
    flex: 1,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 24,
    borderBottomRightRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionText: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  feedback: { fontSize: 12, lineHeight: 17, paddingHorizontal: 4 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.44)" },
  sheet: {
    maxHeight: "90%",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 18,
    paddingHorizontal: 20,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 14, paddingBottom: 14 },
  sheetHeading: { flex: 1, gap: 4 },
  sheetTitle: { fontSize: 21, fontWeight: "700" },
  sheetSubtitle: { fontSize: 13 },
  closeButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { gap: 9, paddingBottom: 4 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 4 },
  optionList: { gap: 7 },
  option: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 20,
    borderBottomRightRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionText: { fontSize: 14, fontWeight: "600" },
  quietChoices: { flexDirection: "row", gap: 7 },
  quietChoice: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 18,
    borderBottomRightRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quietText: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  hint: { fontSize: 12, lineHeight: 17 },
  privacyRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 26,
    borderBottomRightRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 5,
  },
  privacyCopy: { flex: 1, gap: 4 },
  privacyTitle: { fontSize: 13, fontWeight: "700", lineHeight: 18 },
  saveButton: {
    minHeight: 50,
    borderTopLeftRadius: 26,
    borderBottomRightRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 7,
  },
  saveText: { fontSize: 15, fontWeight: "700" },
  turnOffButton: { minHeight: 42, alignItems: "center", justifyContent: "center" },
  turnOffText: { fontSize: 14, fontWeight: "600" },
});
