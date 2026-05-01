import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

import { deleteUserAccount, subscribeToAuthState } from "@/lib/auth";
import { clearReferrals } from "@/lib/referrals";
import { buildSeedEncounters } from "@/lib/seed";
import { api } from "@/lib/api/client";
import {
  startProximity,
  stopProximity,
  type ProximityDetection,
} from "@/lib/proximity/presence";
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
      // Dev-only screenshot bootstrap: when `?demo=1` is present in the web
      // preview URL during development, synthesize a profile + completed
      // permissions so the auth gate lets us through to the tabs without
      // running real onboarding. Inert in production (`__DEV__` is false) and
      // on native (`Platform.OS !== 'web'`).
      const isDemoBootstrap =
        Platform.OS === "web" &&
        __DEV__ &&
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("demo") === "1";
      const effectiveProfile =
        p ??
        (isDemoBootstrap
          ? ({
              id: "demo-user",
              name: "Alex",
              bio: "Coffee, long walks, & spontaneous conversations.",
              photoUri: "https://i.pravatar.cc/600?u=met-demo-alex",
              socials: { instagram: "alex" },
              verified: true,
              isVisible: true,
            } satisfies Profile)
          : null);
      const effectivePermissions = perms || isDemoBootstrap;
      if (effectiveProfile) {
        setProfileState({
          ...effectiveProfile,
          isVisible: effectiveProfile.isVisible ?? true,
        });
      } else {
        setProfileState(null);
      }
      if (e && e.length > 0) {
        const swept = expireStaleRequests(e);
        setAllEncounters(swept.next);
        if (swept.changed) {
          // Persist the swept state so subsequent loads don't re-do the work.
          saveEncounters(swept.next).catch(() => {});
        }
      } else if (__DEV__) {
        // Dev-only seed: gives developers a populated app to work against
        // without having to script real encounters. NEVER runs in production
        // — App Store / Play Store policies prohibit shipping fake users in
        // dating apps (Apple Guideline 4.1, Google "Deceptive Behavior").
        const seeded = buildSeedEncounters();
        setAllEncounters(seeded);
        await saveEncounters(seeded);
      } else {
        // Production: brand-new users start with a genuinely empty list.
        // The Recent tab renders the WelcomeEmptyState in this case.
        setAllEncounters([]);
      }
      setPermissionsCompletedState(effectivePermissions);
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
    // Same dev-only gate as initial load — production reset leaves the
    // encounters list genuinely empty.
    const seeded = __DEV__ ? buildSeedEncounters() : [];
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

      // Auto-reply simulation is dev-only — fabricating messages from a
      // real-looking person in production would mislead users (App Store
      // 4.1 / Play "Deceptive Behavior"). When a real backend is wired up
      // the recipient's actual reply will arrive via push / fetch.
      if (!__DEV__) return;

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

  // Merges a proximity detection (BLE or GPS) into the local encounter
  // list. Uses the observed user's Firebase UID as the encounter id so
  // future detections of the same person update the same row, and a
  // later QR scan of that same uid also unifies into the same encounter.
  // Detected encounters land in the neutral "encounter" status — the
  // user explicitly initiates a reveal request via UI, never the system.
  const upsertEncounterFromProximity = useCallback(
    async (event: ProximityDetection) => {
      const now = event.observedAt;
      const distance = Math.round(event.distanceM);
      const sourceLabel = event.source === "gps" ? "Nearby" : "In the room";
      let next: Encounter[] = [];
      setAllEncounters((prev) => {
        const existing = prev.find((e) => e.id === event.uid);
        if (existing) {
          // Re-emit window in proximity service is 10 min; this branch
          // really fires on profile refreshes or distance changes within
          // the same session. Bump lastSeen + distance, keep status.
          next = prev.map((e): Encounter => {
            if (e.id !== existing.id) return e;
            return {
              ...e,
              realName: event.profile.displayName || e.realName,
              photoUri: event.profile.photoUrl ?? e.photoUri,
              bio: event.profile.bio ?? e.bio,
              socials: (event.profile.socials ?? e.socials) as typeof e.socials,
              lastSeenAt: now,
              lastDistanceM: distance,
              encounterCount: e.encounterCount + 1,
            };
          });
          return next;
        }
        const fresh: Encounter = {
          id: event.uid,
          realName: event.profile.displayName || "Met user",
          photoUri: event.profile.photoUrl ?? "",
          bio: event.profile.bio ?? "",
          socials: (event.profile.socials ?? {}) as Encounter["socials"],
          encounterCount: 1,
          firstSeenAt: now,
          lastSeenAt: now,
          lastDistanceM: distance,
          lastLocation: sourceLabel,
          status: "encounter",
        };
        next = [fresh, ...prev];
        return next;
      });
      await saveEncounters(next);
    },
    [],
  );

  // ---- Backend identity sync + proximity lifecycle ----
  // Push our profile to the api-server whenever it changes so other
  // users can fetch it after they detect us. Start the GPS proximity
  // loop once we have (uid + profile + location permission). We use
  // refs to keep the latest closure for the proximity callback without
  // restarting the loop on every render.
  const upsertProximityRef = useRef(upsertEncounterFromProximity);
  upsertProximityRef.current = upsertEncounterFromProximity;
  const [authedUid, setAuthedUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToAuthState((uid) => setAuthedUid(uid));
    return () => unsub();
  }, []);

  // Push profile -> backend whenever it changes (and we have an auth
  // session). Best-effort: never blocks UI, never throws.
  useEffect(() => {
    if (!authedUid || !profile || !api.isConfigured()) return;
    const ctrl = new AbortController();
    void api
      .upsertMyProfile(
        { uid: authedUid, signal: ctrl.signal },
        {
          displayName: profile.name,
          photoUrl: profile.photoUri || null,
          bio: profile.bio || null,
          socials: profile.socials as Record<string, string>,
        },
      )
      .catch((err) => {
        if ((err as { name?: string }).name !== "AbortError") {
          console.warn("[appcontext] upsertMyProfile failed", err);
        }
      });
    return () => ctrl.abort();
  }, [authedUid, profile]);

  // Start/stop proximity loop. Reruns when uid or permissions change.
  useEffect(() => {
    if (!authedUid || !permissionsCompleted || !api.isConfigured()) {
      stopProximity();
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await startProximity({
        uid: authedUid,
        listener: (event) => {
          // Always read the latest upsert callback through the ref so
          // rerenders that change it don't require restarting the loop.
          void upsertProximityRef.current(event);
        },
      });
      if (cancelled) {
        stopProximity();
        return;
      }
      if (!result.started) {
        console.warn(
          "[appcontext] proximity not started:",
          result.reason ?? "unknown",
        );
      }
    })();
    return () => {
      cancelled = true;
      stopProximity();
    };
  }, [authedUid, permissionsCompleted]);

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
        // QR scan of an unknown user — fabricate a minimal encounter.
        // Use an empty photoUri so Avatar falls back to initials/icon
        // instead of a random pravatar face. A real face placeholder
        // would misrepresent who the scanned user is (App Store 4.1).
        // In production this row will be replaced as soon as the backend
        // returns the real profile for the scanned ID.
        const fabricated: Encounter = {
          id: data.id,
          realName: data.name || "Met user",
          photoUri: "",
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
