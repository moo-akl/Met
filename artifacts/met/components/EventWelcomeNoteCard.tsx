import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useT } from "@/lib/i18n";
import {
  DEFAULT_EVENT_WELCOME_NOTE_STYLE,
} from "@/lib/eventWelcomeNoteStyle";
import type { EventWelcomeNoteStyle } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

type Props = {
  note: string;
  style?: EventWelcomeNoteStyle | null;
  colors: ReturnType<typeof useColors>;
  title: string;
  dismissLabel?: string;
  onDismiss?: () => void;
  testID?: string;
  bodyTestID?: string;
  dismissTestID?: string;
};

export function EventWelcomeNoteCard({
  note,
  style: noteStyle = DEFAULT_EVENT_WELCOME_NOTE_STYLE,
  colors,
  title,
  dismissLabel,
  onDismiss,
  testID,
  bodyTestID,
  dismissTestID,
}: Props) {
  const { t } = useT();
  const style = noteStyle ?? DEFAULT_EVENT_WELCOME_NOTE_STYLE;
  const card = cardStyles(style.card, colors);
  const textColor = style.color === "forest"
    ? colors.secondaryForeground
    : style.color === "soft"
      ? colors.mutedForeground
      : colors.foreground;
  const fontFamily = style.font === "handwritten"
    ? "Caveat_500Medium"
    : style.font === "serif"
      ? "PlayfairDisplay_400Regular"
      : "Inter_400Regular";

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: card.backgroundColor,
          borderColor: card.borderColor,
          borderRadius: card.borderRadius,
          borderWidth: card.borderWidth,
        },
      ]}
    >
      <View style={styles.headingRow}>
        <View style={[styles.icon, { backgroundColor: card.iconBackground }]}>
          <Feather name="message-circle" size={18} color={colors.primary} />
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
      </View>
      <Text
        testID={bodyTestID}
        style={[
          styles.body,
          {
            color: textColor,
            fontFamily,
            fontSize: style.font === "handwritten" ? 21 : 15,
            lineHeight: style.font === "handwritten" ? 27 : 23,
          },
        ]}
      >
        {note}
      </Text>
      {dismissLabel ? (
        onDismiss ? (
          <Pressable
            accessibilityRole="button"
            testID={dismissTestID}
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.dismiss,
              { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
            ]}
          >
            <Text style={[styles.dismissText, { color: colors.primaryForeground }]}>
              {dismissLabel}
            </Text>
          </Pressable>
        ) : (
          <View
            accessibilityLabel={t("tabs.events.welcomeCardDismiss")}
            testID={dismissTestID}
            style={[styles.dismiss, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.dismissText, { color: colors.primaryForeground }]}>
              {dismissLabel}
            </Text>
          </View>
        )
      ) : null}
    </View>
  );
}

export function welcomeNoteCardColors(
  card: EventWelcomeNoteStyle["card"],
  colors: ReturnType<typeof useColors>,
) {
  return cardStyles(card, colors);
}

function cardStyles(
  card: EventWelcomeNoteStyle["card"],
  colors: ReturnType<typeof useColors>,
) {
  if (card === "garden") {
    return {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primarySoft,
      borderRadius: 24,
      borderWidth: 1,
      iconBackground: colors.card,
    };
  }
  if (card === "postcard") {
    return {
      backgroundColor: colors.card,
      borderColor: colors.secondaryForeground,
      borderRadius: 8,
      borderWidth: 2,
      iconBackground: colors.primarySoft,
    };
  }
  return {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    iconBackground: colors.primarySoft,
  };
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 420,
    padding: 20,
    gap: 14,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  icon: {
    width: 42,
    height: 42,
    borderTopLeftRadius: 16,
    borderBottomRightRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    lineHeight: 24,
  },
  body: {
    minHeight: 44,
  },
  dismiss: {
    minHeight: 46,
    borderTopLeftRadius: 23,
    borderBottomRightRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 2,
  },
  dismissText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
});
