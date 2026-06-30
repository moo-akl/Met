import { useEffect, useState } from "react";

import { useApp } from "@/contexts/AppContext";
import { getFirestoreModule } from "@/lib/firestore/client";

function toMs(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof (v as { toMillis?: () => number }).toMillis === "function") {
    return (v as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export function useUnreadChatCount(): number {
  const { authedUid } = useApp();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!authedUid) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;

    getFirestoreModule().then((fs) => {
      if (cancelled || !fs) return;
      unsub = fs
        .collection("chats")
        .where("participants", "array-contains", authedUid)
        .onSnapshot(
          (snap) => {
            if (cancelled) return;
            let unread = 0;
            for (const doc of snap.docs) {
              const d = doc.data() as Record<string, unknown>;
              const lm = d["lastMessage"] as Record<string, unknown> | undefined;
              if (!lm) continue;
              const from = typeof lm["from"] === "string" ? lm["from"] : "";
              if (from === authedUid) continue;
              const sentAt = toMs(lm["sentAt"]);
              const lra = d["lastReadAt"] as Record<string, unknown> | undefined;
              const readAt = toMs(lra?.[authedUid]);
              const cla = d["clearedAt"] as Record<string, unknown> | undefined;
              const clearedAt = toMs(cla?.[authedUid]);
              if (sentAt > readAt && sentAt > clearedAt) unread++;
            }
            setCount(unread);
          },
          () => {
            if (!cancelled) setCount(0);
          },
        );
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [authedUid]);

  return count;
}
