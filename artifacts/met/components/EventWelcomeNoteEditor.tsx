import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { EventWelcomeNoteCard, welcomeNoteCardColors } from "@/components/EventWelcomeNoteCard";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import {
  WELCOME_NOTE_CARDS,
  WELCOME_NOTE_COLORS,
  WELCOME_NOTE_FONTS,
} from "@/lib/eventWelcomeNoteStyle";
import type { EventWelcomeNoteStyle } from "@workspace/api-client-react";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  style: EventWelcomeNoteStyle;
  onStyleChange: (style: EventWelcomeNoteStyle) => void;
  colors: ReturnType<typeof useColors>;
  testIDPrefix: string;
};

const fontFamilies: Record<EventWelcomeNoteStyle["font"], string> = {
  classic: "Inter_500Medium",
  handwritten: "Caveat_600SemiBold",
  serif: "PlayfairDisplay_400Regular",
};

export function EventWelcomeNoteEditor({
  value,
  onChangeText,
  style,
  onStyleChange,
  colors,
  testIDPrefix,
}: Props) {
  const { t } = useT();
  const updateStyle = <K extends keyof EventWelcomeNoteStyle>(
    key: K,
    nextValue: EventWelcomeNoteStyle[K],
  ) => onStyleChange({ ...style, [key]: nextValue });

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t("tabs.events.welcomeNoteTitle")}
        </Text>
        <Text style={[styles.counter, { color: colors.mutedForeground }]}>
          {value.length}/300
        </Text>
      </View>
      <Text style={[styles.helper, { color: colors.mutedForeground }]}>
        {t("tabs.events.welcomeNoteHint")}
      </Text>
      <TextInput
        accessibilityLabel={t("tabs.events.welcomeNoteTitle")}
        testID={testIDPrefix}
        value={value}
        onChangeText={onChangeText}
        placeholder={t("tabs.events.welcomeNoteTitle")}
        placeholderTextColor={colors.mutedForeground}
        maxLength={300}
        multiline
        textAlignVertical="top"
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      />

      <Text accessibilityRole="header" style={[styles.groupHeading, { color: colors.text }]}>
        {t("tabs.events.welcomeNoteStyleTitle")}
      </Text>
      <Text style={[styles.optionLabel, { color: colors.mutedForeground }]}>
        {t("tabs.events.welcomeNoteFontLabel")}
      </Text>
      <View style={styles.optionsRow}>
        {WELCOME_NOTE_FONTS.map((option) => {
          const selected = style.font === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={t(option.labelKey)}
              accessibilityState={{ checked: selected }}
              testID={`${testIDPrefix}-font-${option.value}`}
              onPress={() => updateStyle("font", option.value)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: selected ? colors.primarySoft : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.optionText,
                  { color: colors.text, fontFamily: fontFamilies[option.value] },
                ]}
              >
                {t(option.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.optionLabel, { color: colors.mutedForeground }]}>
        {t("tabs.events.welcomeNoteColorLabel")}
      </Text>
      <View style={styles.optionsRow}>
        {WELCOME_NOTE_COLORS.map((option) => {
          const selected = style.color === option.value;
          const swatch = option.value === "forest"
            ? colors.secondaryForeground
            : option.value === "soft"
              ? colors.mutedForeground
              : colors.foreground;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={t(option.labelKey)}
              accessibilityState={{ checked: selected }}
              testID={`${testIDPrefix}-color-${option.value}`}
              onPress={() => updateStyle("color", option.value)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: selected ? colors.primarySoft : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <View style={[styles.swatch, { backgroundColor: swatch }]} />
              <Text numberOfLines={1} style={[styles.optionText, { color: colors.text }]}>
                {t(option.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.optionLabel, { color: colors.mutedForeground }]}>
        {t("tabs.events.welcomeNoteCardLabel")}
      </Text>
      <View style={styles.optionsRow}>
        {WELCOME_NOTE_CARDS.map((option) => {
          const selected = style.card === option.value;
          const preview = welcomeNoteCardColors(option.value, colors);
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={t(option.labelKey)}
              accessibilityState={{ checked: selected }}
              testID={`${testIDPrefix}-card-${option.value}`}
              onPress={() =>
                option.value === "guestbook"
                  ? onStyleChange({
                      ...style,
                      font: "handwritten",
                      color: "ink",
                      card: "guestbook",
                    })
                  : updateStyle("card", option.value)
              }
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: selected ? colors.primarySoft : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.cardSwatch,
                  {
                    backgroundColor: preview.backgroundColor,
                    borderColor: preview.borderColor,
                    borderRadius: preview.borderRadius,
                    borderWidth: preview.borderWidth,
                  },
                ]}
              >
                {option.value === "guestbook" ? (
                  <View
                    pointerEvents="none"
                    testID={`${testIDPrefix}-card-guestbook-rules`}
                    style={styles.cardSwatchRules}
                  >
                    {[0, 1, 2].map((line) => (
                      <View
                        key={line}
                        style={[
                          styles.cardSwatchRule,
                          { backgroundColor: preview.borderColor },
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={[styles.optionText, { color: colors.text }]}>
                {t(option.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        accessibilityLabel={t("tabs.events.welcomeNotePreview")}
        testID={`${testIDPrefix}-preview`}
        style={[
          styles.preview,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <View style={styles.previewLabelRow}>
          <Feather name="eye" size={14} color={colors.primary} />
          <Text style={[styles.optionLabel, { color: colors.mutedForeground }]}>
            {t("tabs.events.welcomeNotePreview")}
          </Text>
        </View>
        <EventWelcomeNoteCard
          note={value.trim() || t("tabs.events.welcomeNotePreviewEmpty")}
          style={style}
          colors={colors}
          title={t("tabs.events.welcomeCardTitle")}
          dismissLabel={t("tabs.events.welcomeCardDismiss")}
          testID={`${testIDPrefix}-preview-card`}
          bodyTestID={`${testIDPrefix}-preview-body`}
          dismissTestID={`${testIDPrefix}-preview-dismiss`}
        />
      </View>

      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("tabs.events.welcomeNoteClear")}
          testID={`${testIDPrefix}-clear`}
          onPress={() => onChangeText("")}
          style={({ pressed }) => [
            styles.clearButton,
            { opacity: pressed ? 0.72 : 1 },
          ]}
        >
          <Feather name="x-circle" size={15} color={colors.destructive} />
          <Text style={[styles.clearText, { color: colors.destructive }]}>
            {t("tabs.events.welcomeNoteClear")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 9,
    marginTop: 4,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  counter: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  helper: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
  },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  groupHeading: {
    marginTop: 5,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  optionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  option: {
    minHeight: 40,
    flexGrow: 1,
    flexBasis: "30%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  optionText: {
    flexShrink: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    textAlign: "center",
  },
  swatch: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  cardSwatch: {
    width: 24,
    height: 17,
    overflow: "hidden",
    position: "relative",
  },
  cardSwatchRules: {
    position: "absolute",
    top: 3,
    left: 3,
    right: 3,
    gap: 3,
  },
  cardSwatchRule: {
    height: 1,
  },
  preview: {
    gap: 10,
    padding: 11,
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 5,
  },
  previewLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clearButton: {
    alignSelf: "flex-start",
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  clearText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
});
