import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeSyntheticEvent, TextLayoutEventData } from "react-native";

import { useT } from "@/lib/i18n";
import {
  DEFAULT_EVENT_WELCOME_NOTE_STYLE,
} from "@/lib/eventWelcomeNoteStyle";
import { VENUE_GUESTBOOK_THEME } from "@/lib/venueGuestbookTheme";
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
  const isGuestbook = style.card === "guestbook";
  const textColor = style.color === "forest"
    ? colors.secondaryForeground
    : style.color === "soft"
      ? colors.mutedForeground
      : isGuestbook
        ? VENUE_GUESTBOOK_THEME.ink
        : colors.foreground;
  const fontFamily = style.font === "handwritten"
    ? isGuestbook
      ? VENUE_GUESTBOOK_THEME.handFont
      : "Caveat_500Medium"
    : style.font === "serif"
      ? "PlayfairDisplay_400Regular"
      : "Inter_400Regular";
  const [guestbookLayout, setGuestbookLayout] = useState({
    ruleOffsets: [27, 54],
    minHeight: 54,
  });
  const handleGuestbookTextLayout = (
    event: NativeSyntheticEvent<TextLayoutEventData>,
  ) => {
    const lines = event.nativeEvent.lines;
    if (lines.length === 0) return;

    const ruleOffsets = lines.map((line) =>
      Math.round(line.y + line.height),
    );
    if (ruleOffsets.length < 2) {
      const lastLine = lines[lines.length - 1];
      ruleOffsets.push(Math.round(lastLine.y + lastLine.height * 2));
    }
    const minHeight = Math.max(54, ruleOffsets[ruleOffsets.length - 1] ?? 54);

    setGuestbookLayout((current) => {
      const unchanged = current.minHeight === minHeight
        && current.ruleOffsets.length === ruleOffsets.length
        && current.ruleOffsets.every((offset, index) => offset === ruleOffsets[index]);
      return unchanged ? current : { ruleOffsets, minHeight };
    });
  };

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
        isGuestbook ? styles.guestbookShadow : null,
      ]}
    >
      <View style={styles.headingRow}>
        <View style={[styles.icon, { backgroundColor: card.iconBackground }]}>
          <Feather
            name={isGuestbook ? "book-open" : "message-circle"}
            size={18}
            color={isGuestbook ? VENUE_GUESTBOOK_THEME.accent : colors.primary}
          />
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: isGuestbook ? VENUE_GUESTBOOK_THEME.ink : colors.text }]}>
          {title}
        </Text>
        {isGuestbook ? (
          <View
            accessible={false}
            importantForAccessibility="no"
            testID={testID ? `${testID}-heart` : undefined}
            style={styles.guestbookDecoration}
          >
            <Feather name="heart" size={14} color={VENUE_GUESTBOOK_THEME.accent} />
          </View>
        ) : null}
      </View>
      <View
        style={styles.bodyWrap}
      >
        {isGuestbook ? (
          <View
            pointerEvents="none"
            testID={testID ? `${testID}-rules` : undefined}
            style={[StyleSheet.absoluteFill, styles.guestbookRules]}
          >
            {guestbookLayout.ruleOffsets.map((offset, index) => (
              <View
                key={`${index}-${offset}`}
                style={[styles.guestbookRule, { top: offset }]}
              />
            ))}
          </View>
        ) : null}
        {isGuestbook ? (
          <View
            pointerEvents="none"
            testID={testID ? `${testID}-margin` : undefined}
            style={styles.guestbookMargin}
          />
        ) : null}
        <Text
          testID={bodyTestID}
          allowFontScaling
          onTextLayout={isGuestbook ? handleGuestbookTextLayout : undefined}
          style={[
            styles.body,
            {
              color: textColor,
              fontFamily,
              fontSize: style.font === "handwritten" ? (isGuestbook ? 18 : 21) : 15,
              lineHeight: style.font === "handwritten" ? 27 : 23,
            },
            isGuestbook
              ? [styles.guestbookBody, { minHeight: guestbookLayout.minHeight }]
              : null,
          ]}
        >
          {note}
        </Text>
      </View>
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
  if (card === "guestbook") {
    return {
      backgroundColor: VENUE_GUESTBOOK_THEME.paper,
      borderColor: VENUE_GUESTBOOK_THEME.rule,
      borderRadius: 4,
      borderWidth: 1,
      iconBackground: VENUE_GUESTBOOK_THEME.paperAlt,
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
  bodyWrap: {
    position: "relative",
    width: "100%",
  },
  guestbookShadow: {
    shadowColor: VENUE_GUESTBOOK_THEME.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  guestbookDecoration: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  guestbookRules: {
    left: 24,
    right: 0,
  },
  guestbookRule: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: VENUE_GUESTBOOK_THEME.rule,
  },
  guestbookMargin: {
    position: "absolute",
    left: 18,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: `${VENUE_GUESTBOOK_THEME.accent}88`,
  },
  guestbookBody: {
    minHeight: 54,
    marginLeft: 30,
    paddingLeft: 0,
    paddingRight: 8,
    flexShrink: 1,
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
