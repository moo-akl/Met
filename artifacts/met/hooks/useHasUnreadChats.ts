import { useEffect, useState } from "react";
import { getFirestoreModule } from "@/lib/firestore/client";

function toMs(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof (v as { toMillis?: () => number }).toMillis === "function") {
    return (v as { toMillis: () => number }).toMillis();
  }
  return 0;
}

/**
 * Returns true when the signed-in user has at least one chat with a
 * message they haven't read yet. Drives the red-dot badge on the
 * Connections tab icon.
 *
 * Subscribes to all chats where the user is a participant via a
 * Firestore collection-group query. Unread = lastMessage.from ≠ myUid
 * AND lastMessage.sentAt > lastReadAt[myUid] AND sentAt > clearedAt[myUid].
 */
export function useHasUnreadChats(myUid: string | null): boolean {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!myUid) {
      setHasUnread(false);
      return;
    }

    let cancelled = false;
    let unsub: (() => void) | null = null;

    getFirestoreModule().then((fs) => {
      if (cancelled || !fs) return;

      unsub = fs
        .collection("chats")
        .where("participants", "array-contains", myUid)
        .onSnapshot(
          (snap) => {
            if (cancelled) return;
            const anyUnread = snap.docs.some((doc) => {
              const d = doc.data() as Record<string, unknown> | undefined;
              if (!d) return false;
              const lm = d["lastMessage"] as Record<string, unknown> | undefined;
              if (!lm) return false;
              if (lm["from"] === myUid) return false;
              const sentAt = toMs(lm["sentAt"]);
              if (!sentAt) return false;
              const lra = d["lastReadAt"] as Record<string, unknown> | undefined;
              const readAt = toMs(lra?.[myUid]);
              const cla = d["clearedAt"] as Record<string, unknown> | undefined;
              const clearedAt = toMs(cla?.[myUid]);
              return sentAt > readAt && sentAt > clearedAt;
            });
            setHasUnread(anyUnread);
          },
          () => {
            if (!cancelled) setHasUnread(false);
          },
        );
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [myUid]);

  return hasUnread;
}
