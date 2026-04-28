import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { deleteUserAccount } from "@/lib/auth";
import { clearReferrals } from "@/lib/referrals";
import { buildSeedEncounters } from "@/lib/seed";
import {
  DEFAULT_PREFERENCES,
  REQUEST_TTL_MS,
  clearEncounters,
  clearPreferences,
  clearProfile,
  loadEncounters,
  loadPermissionsCompleted,
  loadPreferences,
  loadProfile,
  saveEncounters,
  savePermissionsCompleted,
  savePreferences,
  saveProfile,
  type Preferences,
} from "@/lib/storage";
import type { Encounter, EncounterStatus, Profile } from "@/lib/types";

type AppContextValue = {
  ready: boolean;
  profile: Profile | null;
  encounters: Encounter[];
  blockedEncounters: Encounter[];
  allEncounters: Encounter[];
  permissionsCompleted: boolean;
  preferences: Preferences;
  setProfile: (p: Profile) => Promise<void>;
  updateEncounterStatus: (
    id: string,
    status: EncounterStatus,
    opts?: { revealMessage?: string },
  ) => Promise<void>;
  removeEncounter: (id: string) => Promise<void>;
  setBlocked: (id: string, blocked: boolean) => Promise<void>;
  setNote: (id: string, note: string) => Promise<void>;
  setTags: (id: string, tags: string[]) => Promise<void>;
  resetAll: () => Promise<void>;
  setPermissionsCompleted: (done: boolean) => Promise<void>;
  upsertEncounterFromQr: (data: { id: string; name: string }) => Promise<string>;
  sendOpeningMessage: (id: string, text: string) => Promise<void>;
  updatePreferences: (patch: Partial<Preferences>) => Promise<void>;
  markPhotoVerified: () => Promise<void>;
};

// Sweep stale pending reveal requests back to "encounter". Outgoing requests
// use `requestSentAt`; incoming use `lastSeenAt` (we don't track when the
// other side hit "send" so the encounter timestamp is the closest proxy).
function expireStaleRequests(encs: Encounter[]): {
  next: Encounter[];
  changed: boolean;
} {
  const now = Date.now();
  let changed = false;
  const next = encs.map((e) => {
    if (e.status === "request_sent") {
      const sentAt = e.requestSentAt ?? e.lastSeenAt;
      if (now - sentAt > REQUEST_TTL_MS) {
        changed = true;
        const { requestSentAt: _r, ...rest } = e;
        return { ...rest, status: "encounter" as const };
      }
    } else if (e.status === "request_received") {
      if (now - e.lastSeenAt > REQUEST_TTL_MS) {
        changed = true;
        return { ...e, status: "encounter" as const };
      }
    }
    return e;
  });
  return { next, changed };
}

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
  const [preferences, setPreferencesState] = useState<Preferences>(
    DEFAULT_PREFERENCES,
  );

  // Refs mirror the latest committed state so async write callbacks
  // (`updatePreferences`, `markPhotoVerified`) never race on a stale closure
  // when called back-to-back before the next render commits.
  const preferencesRef = useRef<Preferences>(DEFAULT_PREFERENCES);
  preferencesRef.current = preferences;
  const profileRef = useRef<Profile | null>(null);
  profileRef.current = profile;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [p, e, perms, prefs] = await Promise.all([
        loadProfile(),
        loadEncounters(),
        loadPermissionsCompleted(),
        loadPreferences(),
      ]);
      if (!mounted) return;
      if (p) {
        setProfileState({ ...p, isVisible: p.isVisible ?? true });
      } else {
        setProfileState(p);
      }
      if (e && e.length > 0) {
        const swept = expireStaleRequests(e);
        setAllEncounters(swept.next);
        if (swept.changed) {
          // Persist the swept state so subsequent loads don't re-do the work.
          saveEncounters(swept.next).catch(() => {});
        }
      } else {
        const seeded = buildSeedEncounters();
        setAllEncounters(seeded);
        await saveEncounters(seeded);
      }
      setPermissionsCompletedState(perms);
      setPreferencesState(prefs);
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
    async (
      id: string,
      status: EncounterStatus,
      opts?: { revealMessage?: string },
    ) => {
      let next: Encounter[] = [];
      const trimmedMsg = opts?.revealMessage?.trim();
      setAllEncounters((prev) => {
        next = prev.map((enc) => {
          if (enc.id !== id) return enc;
          // Stamp `requestSentAt` when the user actively fires a reveal so the
          // 24h sweep can later expire it. Clear it on any other transition.
          if (status === "request_sent") {
            const base: Encounter = {
              ...enc,
              status,
              requestSentAt: Date.now(),
            };
            if (trimmedMsg) {
              return { ...base, revealMessage: trimmedMsg };
            }
            // No message provided — drop any prior one so a re-send without a
            // note doesn't carry over a stale message.
            const { revealMessage: _rm, ...rest } = base;
            return rest;
          }
          // request_received: preserve the sender's revealMessage so the
          // receiver's lock card still shows the personal note. Allow the
          // caller to override via opts.revealMessage.
          if (status === "request_received") {
            const base: Encounter = { ...enc, status };
            if (base.requestSentAt !== undefined) {
              delete (base as { requestSentAt?: number }).requestSentAt;
            }
            if (trimmedMsg) {
              return { ...base, revealMessage: trimmedMsg };
            }
            return base;
          }
          // Terminal transitions (connected, encounter, blocked, expired):
          // clear timestamp and revealMessage so leftover note text doesn't
          // leak across status changes.
          const stripped: Encounter = { ...enc, status };
          if (stripped.requestSentAt !== undefined) {
            delete (stripped as { requestSentAt?: number }).requestSentAt;
          }
          if (stripped.revealMessage !== undefined) {
            delete (stripped as { revealMessage?: string }).revealMessage;
          }
          return stripped;
        });
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

  const setNote = useCallback(async (id: string, note: string) => {
    const trimmed = note.trim();
    let next: Encounter[] = [];
    setAllEncounters((prev) => {
      next = prev.map((enc) => {
        if (enc.id !== id) return enc;
        if (!trimmed) {
          const { note: _n, ...rest } = enc;
          return rest;
        }
        return { ...enc, note: trimmed };
      });
      return next;
    });
    await saveEncounters(next);
  }, []);

  const setTags = useCallback(async (id: string, tags: string[]) => {
    // Normalize to lowercase, trim, dedupe, drop empties.
    const cleaned = Array.from(
      new Set(
        tags
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0 && t.length <= 24),
      ),
    );
    let next: Encounter[] = [];
    setAllEncounters((prev) => {
      next = prev.map((enc) => {
        if (enc.id !== id) return enc;
        if (cleaned.length === 0) {
          const { tags: _t, ...rest } = enc;
          return rest;
        }
        return { ...enc, tags: cleaned };
      });
      return next;
    });
    await saveEncounters(next);
  }, []);

  const resetAll = useCallback(async () => {
    // Tear down the Firebase identity FIRST so the user truly starts
    // fresh on next onboarding. Best-effort: never throws.
    await deleteUserAccount();
    await clearProfile();
    await clearEncounters();
    await clearPreferences();
    await clearReferrals();
    await savePermissionsCompleted(false);
    const seeded = buildSeedEncounters();
    setProfileState(null);
    setAllEncounters(seeded);
    setPermissionsCompletedState(false);
    setPreferencesState(DEFAULT_PREFERENCES);
    await saveEncounters(seeded);
  }, []);

  const updatePreferences = useCallback(
    async (patch: Partial<Preferences>) => {
      const next: Preferences = { ...preferencesRef.current, ...patch };
      preferencesRef.current = next;
      setPreferencesState(next);
      await savePreferences(next);
    },
    [],
  );

  const markPhotoVerified = useCallback(async () => {
    const current = profileRef.current;
    if (!current) return;
    const next: Profile = {
      ...current,
      verified: true,
      photoVerifiedAt: Date.now(),
    };
    profileRef.current = next;
    setProfileState(next);
    await saveProfile(next);
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
          next = prev.map((e): Encounter => {
            if (e.id !== existing.id) return e;
            const nextStatus: EncounterStatus =
              e.status === "connected" ? "connected" : "request_sent";
            // Mirror updateEncounterStatus: stamp requestSentAt fresh on every
            // re-issued request so the 24h sweep doesn't read a stale timestamp.
            // Clear it on any other transition.
            const base = {
              ...e,
              blocked: false,
              status: nextStatus,
              lastSeenAt: now,
              encounterCount: e.encounterCount + 1,
            };
            if (nextStatus === "request_sent") {
              return { ...base, requestSentAt: now };
            }
            if (base.requestSentAt !== undefined) {
              const { requestSentAt: _r, ...rest } = base;
              return rest;
            }
            return base;
          });
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
          requestSentAt: now,
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
      preferences,
      setProfile,
      updateEncounterStatus,
      removeEncounter,
      setBlocked,
      setNote,
      setTags,
      resetAll,
      setPermissionsCompleted,
      upsertEncounterFromQr,
      sendOpeningMessage,
      updatePreferences,
      markPhotoVerified,
    }),
    [
      ready,
      profile,
      encounters,
      blockedEncounters,
      allEncounters,
      permissionsCompleted,
      preferences,
      setProfile,
      updateEncounterStatus,
      removeEncounter,
      setBlocked,
      setNote,
      setTags,
      resetAll,
      setPermissionsCompleted,
      upsertEncounterFromQr,
      sendOpeningMessage,
      updatePreferences,
      markPhotoVerified,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
