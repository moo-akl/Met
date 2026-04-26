import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { buildSeedEncounters } from "@/lib/seed";
import {
  clearEncounters,
  clearProfile,
  loadEncounters,
  loadPermissionsCompleted,
  loadProfile,
  saveEncounters,
  savePermissionsCompleted,
  saveProfile,
} from "@/lib/storage";
import type { Encounter, EncounterStatus, Profile } from "@/lib/types";

type AppContextValue = {
  ready: boolean;
  profile: Profile | null;
  encounters: Encounter[];
  blockedEncounters: Encounter[];
  allEncounters: Encounter[];
  permissionsCompleted: boolean;
  setProfile: (p: Profile) => Promise<void>;
  updateEncounterStatus: (id: string, status: EncounterStatus) => Promise<void>;
  removeEncounter: (id: string) => Promise<void>;
  setBlocked: (id: string, blocked: boolean) => Promise<void>;
  resetAll: () => Promise<void>;
  setPermissionsCompleted: (done: boolean) => Promise<void>;
  upsertEncounterFromQr: (data: { id: string; name: string }) => Promise<string>;
  sendOpeningMessage: (id: string, text: string) => Promise<void>;
};

const REPLY_SAMPLES = [
  "Hey! Great to hear from you 👋",
  "Yes, I remember you! How's it going?",
  "Glad you reached out — let's keep in touch.",
  "Hi there! Funny seeing you here.",
  "Thanks for the message! What are you up to?",
];

function pickReply(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return REPLY_SAMPLES[h % REPLY_SAMPLES.length];
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [allEncounters, setAllEncounters] = useState<Encounter[]>([]);
  const [permissionsCompleted, setPermissionsCompletedState] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [p, e, perms] = await Promise.all([
        loadProfile(),
        loadEncounters(),
        loadPermissionsCompleted(),
      ]);
      if (!mounted) return;
      if (p) {
        setProfileState({ ...p, isVisible: p.isVisible ?? true });
      } else {
        setProfileState(p);
      }
      if (e && e.length > 0) {
        setAllEncounters(e);
      } else {
        const seeded = buildSeedEncounters();
        setAllEncounters(seeded);
        await saveEncounters(seeded);
      }
      setPermissionsCompletedState(perms);
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setProfile = useCallback(async (p: Profile) => {
    setProfileState(p);
    await saveProfile(p);
  }, []);

  const updateEncounterStatus = useCallback(
    async (id: string, status: EncounterStatus) => {
      let next: Encounter[] = [];
      setAllEncounters((prev) => {
        next = prev.map((enc) => (enc.id === id ? { ...enc, status } : enc));
        return next;
      });
      await saveEncounters(next);
    },
    [],
  );

  const removeEncounter = useCallback(async (id: string) => {
    let next: Encounter[] = [];
    setAllEncounters((prev) => {
      next = prev.filter((enc) => enc.id !== id);
      return next;
    });
    await saveEncounters(next);
  }, []);

  const setBlocked = useCallback(async (id: string, blocked: boolean) => {
    let next: Encounter[] = [];
    setAllEncounters((prev) => {
      next = prev.map((enc) => (enc.id === id ? { ...enc, blocked } : enc));
      return next;
    });
    await saveEncounters(next);
  }, []);

  const resetAll = useCallback(async () => {
    await clearProfile();
    await clearEncounters();
    await savePermissionsCompleted(false);
    const seeded = buildSeedEncounters();
    setProfileState(null);
    setAllEncounters(seeded);
    setPermissionsCompletedState(false);
    await saveEncounters(seeded);
  }, []);

  const setPermissionsCompleted = useCallback(async (done: boolean) => {
    setPermissionsCompletedState(done);
    await savePermissionsCompleted(done);
  }, []);

  const sendOpeningMessage = useCallback(
    async (id: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const sentAt = Date.now();
      let next: Encounter[] = [];
      setAllEncounters((prev) => {
        next = prev.map((enc) =>
          enc.id === id
            ? {
                ...enc,
                openingMessage: { text: trimmed, sentAt },
              }
            : enc,
        );
        return next;
      });
      await saveEncounters(next);

      // Simulate the recipient replying after a short delay so the prototype
      // shows the full thread without needing real backend wiring.
      setTimeout(() => {
        let withReply: Encounter[] = [];
        setAllEncounters((prev) => {
          withReply = prev.map((enc) => {
            if (enc.id !== id) return enc;
            const om = enc.openingMessage;
            // Don't overwrite if the user already sent a follow-up that
            // somehow replaced this message, or if a reply already exists.
            if (!om || om.sentAt !== sentAt || om.reply) return enc;
            return {
              ...enc,
              openingMessage: {
                ...om,
                reply: {
                  text: pickReply(`${enc.realName}|${trimmed}`),
                  receivedAt: Date.now(),
                },
              },
            };
          });
          return withReply;
        });
        saveEncounters(withReply).catch(() => {});
      }, 4000);
    },
    [],
  );

  const upsertEncounterFromQr = useCallback(
    async (data: { id: string; name: string }) => {
      const now = Date.now();
      let resolvedId = data.id;
      let next: Encounter[] = [];
      setAllEncounters((prev) => {
        const existing = prev.find((e) => e.id === data.id);
        if (existing) {
          resolvedId = existing.id;
          next = prev.map((e) =>
            e.id === existing.id
              ? {
                  ...e,
                  blocked: false,
                  status:
                    e.status === "connected" ? "connected" : "request_sent",
                  lastSeenAt: now,
                  encounterCount: e.encounterCount + 1,
                }
              : e,
          );
          return next;
        }
        const fabricated: Encounter = {
          id: data.id,
          realName: data.name || "Met user",
          photoUri: `https://i.pravatar.cc/600?u=${encodeURIComponent(data.id)}`,
          bio: "Met via QR code",
          socials: {},
          encounterCount: 1,
          firstSeenAt: now,
          lastSeenAt: now,
          lastDistanceM: 0,
          lastLocation: "Scanned in person",
          status: "request_sent",
        };
        next = [fabricated, ...prev];
        return next;
      });
      await saveEncounters(next);
      return resolvedId;
    },
    [],
  );

  const encounters = useMemo(
    () => allEncounters.filter((e) => !e.blocked),
    [allEncounters],
  );
  const blockedEncounters = useMemo(
    () => allEncounters.filter((e) => e.blocked),
    [allEncounters],
  );

  const value = useMemo(
    () => ({
      ready,
      profile,
      encounters,
      blockedEncounters,
      allEncounters,
      permissionsCompleted,
      setProfile,
      updateEncounterStatus,
      removeEncounter,
      setBlocked,
      resetAll,
      setPermissionsCompleted,
      upsertEncounterFromQr,
      sendOpeningMessage,
    }),
    [
      ready,
      profile,
      encounters,
      blockedEncounters,
      allEncounters,
      permissionsCompleted,
      setProfile,
      updateEncounterStatus,
      removeEncounter,
      setBlocked,
      resetAll,
      setPermissionsCompleted,
      upsertEncounterFromQr,
      sendOpeningMessage,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
