import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import {
  reconcileEventReminders,
  type ReminderEventType,
} from "@/lib/eventReminders";

type EventReference = {
  eventType: ReminderEventType;
  id: number;
};

const FEED_LIMIT_PER_EVENT_TYPE = 100;

export function useEventReminderCleanup(
  uid: string | null,
  events: ReadonlyArray<EventReference>,
  feedReady: boolean,
  refreshEvents: () => Promise<unknown>,
): void {
  const lastReconciliation = useRef("");
  const eventSignature = events
    .map((event) => `${event.eventType}:${event.id}`)
    .sort()
    .join(",");

  useEffect(() => {
    if (!uid || !feedReady) return;

    const counts: Record<ReminderEventType, number> = { member: 0, venue: 0 };
    for (const event of events) counts[event.eventType] += 1;
    const completeEventTypes = new Set<ReminderEventType>(
      (Object.keys(counts) as ReminderEventType[]).filter(
        (eventType) => counts[eventType] < FEED_LIMIT_PER_EVENT_TYPE,
      ),
    );
    const signature = `${uid}|${[...completeEventTypes].sort().join(",")}|${eventSignature}`;
    if (signature === lastReconciliation.current) return;
    lastReconciliation.current = signature;

    void reconcileEventReminders(uid, events, completeEventTypes).catch(() => {
      // Retry when the feed changes or the screen is mounted again.
      lastReconciliation.current = "";
    });
  }, [uid, events, eventSignature, feedReady]);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasBackgrounded =
        previousState === "background" || previousState === "inactive";
      previousState = nextState;
      if (uid && wasBackgrounded && nextState === "active") {
        void refreshEvents().catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [uid, refreshEvents]);
}
