import { Platform } from "react-native";

import type { ChatMeta, ChatMessage } from "@/lib/firestore/chat";
import { STORE_DEMO_IDS } from "@/lib/seed";

/** Paths are relative to the Expo artifact preview base (`/expo`). */
export const STORE_DEMO_CAPTURE_PATHS = {
  recent: "/recent?demo=1&storeShot=5",
  encounterDetail: `/encounter/${STORE_DEMO_IDS.detail}?demo=1&storeShot=6`,
  revealRequest: "/recent?demo=1&storeShot=7",
  revealedConnection: `/connection/${STORE_DEMO_IDS.connection}?demo=1&storeShot=8`,
  chat: `/chat/${STORE_DEMO_IDS.chat}?demo=1&storeShot=9`,
  profile: "/profile?demo=1&storeShot=10",
} as const;

/** True only for the Expo web screenshot sandbox; native and production stay live. */
export function isStoreDemoEnabled(): boolean {
  return (
    __DEV__ &&
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "1"
  );
}

/** A deterministic screenshot scene selector carried by direct route URLs. */
export function isStoreDemoShot(shot: number): boolean {
  return (
    isStoreDemoEnabled() &&
    new URLSearchParams(window.location.search).get("storeShot") === String(shot)
  );
}

export function buildStoreDemoChat(
  peerUid: string,
  myUid: string,
): { messages: ChatMessage[]; meta: ChatMeta } {
  const now = Date.now();
  const transcript = [
    { from: peerUid, text: "Hey Alex, nice meeting you at Mira." },
    { from: myUid, text: "You too! I’m glad Met helped us find each other again." },
    { from: peerUid, text: "I go there most weekends. Have you tried their new pour-over?" },
    { from: myUid, text: "Not yet, but it’s on my list. The place has such a good feel." },
    { from: peerUid, text: "You’d love it. We should compare notes next time." },
    { from: myUid, text: "That sounds great. See you around!" },
  ];
  const messages = transcript.map((message, index) => ({
    id: `store-demo-message-${index + 1}`,
    from: message.from,
    text: message.text,
    sentAt: now - (transcript.length - index) * 4 * 60_000,
  }));
  const last = messages[messages.length - 1];

  return {
    messages,
    meta: {
      lastMessage: {
        text: last.text,
        from: last.from,
        sentAt: last.sentAt,
      },
      lastReadAt: { [myUid]: now },
      nextSenderUid: null,
    },
  };
}