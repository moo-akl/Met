import { useQuery } from "@tanstack/react-query";
import { usePathname } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Modal, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EventWelcomeNoteCard } from "@/components/EventWelcomeNoteCard";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import {
  getGetMyPendingCommunityEventWelcomeNotesQueryKey,
  getGetMyPendingCommunityEventWelcomeNotesQueryOptions,
  useAcknowledgeEventWelcomeNote,
  type PendingCommunityEventWelcomeNote,
} from "@workspace/api-client-react";

function noteKey(note: PendingCommunityEventWelcomeNote) {
  return `member:${note.eventId}`;
}

export function EventWelcomeNoteReturnVisitController() {
  const { ready, authedUid } = useApp();
  const pathname = usePathname();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const acknowledge = useAcknowledgeEventWelcomeNote();
  const isEventDetailsRoute = pathname.startsWith("/event-details/");
  const queryEnabled = ready && !!authedUid && !isEventDetailsRoute;
  const baseQueryKey = getGetMyPendingCommunityEventWelcomeNotesQueryKey();
  const pendingNotesQuery = useQuery({
    ...getGetMyPendingCommunityEventWelcomeNotesQueryOptions(),
    queryKey: [
      ...baseQueryKey,
      authedUid ?? "signed-out",
      isEventDetailsRoute ? "event-details" : "return-visit",
    ],
    enabled: queryEnabled,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);
  const inFlightAcknowledgments = useRef(new Set<string>());
  const completedAcknowledgments = useRef(new Set<string>());
  const pendingNotes = pendingNotesQuery.data?.welcomeNotes ?? [];
  const currentNote = pendingNotes.find(
    (note) => !dismissedKeys.includes(noteKey(note)),
  );

  useEffect(() => {
    setDismissedKeys([]);
    inFlightAcknowledgments.current.clear();
    completedAcknowledgments.current.clear();
  }, [authedUid]);

  useEffect(() => {
    if (!queryEnabled || currentNote) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void pendingNotesQuery.refetch();
    });
    return () => subscription.remove();
  }, [currentNote, pendingNotesQuery.refetch, queryEnabled]);

  const acknowledgeDisplayedNote = useCallback(
    (note: PendingCommunityEventWelcomeNote) => {
      const key = noteKey(note);
      if (
        completedAcknowledgments.current.has(key) ||
        inFlightAcknowledgments.current.has(key)
      ) {
        return;
      }
      inFlightAcknowledgments.current.add(key);
      void acknowledge
        .mutateAsync({ eventType: "member", eventId: note.eventId })
        .then(() => {
          completedAcknowledgments.current.add(key);
        })
        .catch(() => {
          // The server keeps unacknowledged notes available for a later retry.
        })
        .finally(() => {
          inFlightAcknowledgments.current.delete(key);
        });
    },
    [acknowledge.mutateAsync],
  );

  const dismissCurrentNote = () => {
    if (!currentNote) return;
    acknowledgeDisplayedNote(currentNote);
    const key = noteKey(currentNote);
    setDismissedKeys((current) =>
      current.includes(key) ? current : [...current, key],
    );
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={dismissCurrentNote}
      onShow={
        currentNote
          ? () => acknowledgeDisplayedNote(currentNote)
          : undefined
      }
      presentationStyle="overFullScreen"
      statusBarTranslucent
      testID="return-visit-welcome-note-modal"
      transparent
      visible={queryEnabled && Boolean(currentNote)}
    >
      {currentNote ? (
        <View
          accessibilityViewIsModal
          style={[
            styles.overlay,
            {
              backgroundColor: colors.background,
              paddingTop: Math.max(insets.top, 24),
              paddingBottom: Math.max(insets.bottom, 24),
            },
          ]}
        >
          <View style={styles.content}>
            <Text
              accessibilityRole="header"
              numberOfLines={2}
              style={[styles.eventTitle, { color: colors.mutedForeground }]}
            >
              {currentNote.eventTitle}
            </Text>
            <EventWelcomeNoteCard
              note={currentNote.welcomeNote}
              style={currentNote.welcomeNoteStyle}
              colors={colors}
              title={t("tabs.events.welcomeCardTitle")}
              dismissLabel={t("tabs.events.welcomeCardDismiss")}
              onDismiss={dismissCurrentNote}
              testID="return-visit-welcome-note-card"
              bodyTestID="return-visit-welcome-note-body"
              dismissTestID="return-visit-welcome-note-dismiss"
            />
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  content: {
    width: "100%",
    maxWidth: 460,
    gap: 12,
  },
  eventTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
