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

import {
  deleteUserAccount,
  signOut as firebaseSignOut,
  subscribeToAuthState,
} from "@/lib/auth";
import { clearReferrals } from "@/lib/referrals";
import { buildSeedEncounters } from "@/lib/seed";
import { api, type RemoteRevealRequestWithProfile } from "@/lib/api/client";
import {
  startProximity,
  stopProximity,
  type ProximityDetection,
} from "@/lib/proximity/presence";
import {
  startBleProximity,
  stopBleProximity,
  type BleProximityDetection,
} from "@/lib/ble";
import {
  startFirestoreProximity,
  stopFirestoreProximity,
} from "@/lib/firestore/presence";
import {
  subscribeToMetPeople,
  subscribeToRequestsChange,
  type MetPersonDoc,
} from "@/lib/firestore/encounters";
import {
  clearCooldownsFor,
  isInCooldown,
  markCooldown,
} from "@/lib/firestore/cooldown";
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
  signOutAndClear: () => Promise<void>;
  setPermissionsCompleted: (done: boolean) => Promise<void>;
  upsertEncounterFromQr: (data: { id: string; name: string }) => Promise<string>;
  // Reveal-request lifecycle (server-backed). These are the production
  // path the encounter screen should call instead of `updateEncounterStatus`
  // for the request_sent / accept / decline transitions, because they
  // also tell the recipient (or sender) about the action via the backend.
  sendRevealRequest: (
    recipientUid: string,
    message?: string,
  ) => Promise<void>;
  acceptRevealRequest: (senderUid: string) => Promise<void>;
  declineRevealRequest: (senderUid: string) => Promise<void>;
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
    const previousUid = profileRef.current?.id ?? null;
    await deleteUserAccount();
    await clearProfile();
    await clearEncounters();
    await clearPreferences();
    await clearReferrals();
    if (previousUid) await clearCooldownsFor(previousUid);
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

  // Sign out of Firebase and wipe local app state, but DO NOT delete the
  // Firebase account. Distinct from `resetAll` (Delete Account) because
  // the user can sign back in later and recreate their profile under the
  // same identity. We still clear local profile/encounters/preferences
  // because everything user-specific lives on-device — leaving them in
  // place would leak the previous user's data to whoever signs in next.
  const signOutAndClear = useCallback(async () => {
    const previousUid = profileRef.current?.id ?? null;
    await firebaseSignOut();
    await clearProfile();
    await clearEncounters();
    await clearPreferences();
    await clearReferrals();
    if (previousUid) await clearCooldownsFor(previousUid);
    await savePermissionsCompleted(false);
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
    async (event: ProximityDetection | BleProximityDetection) => {
      const now = event.observedAt;
      const distance = Math.round(event.distanceM);
      const sourceLabel = event.source === "ble" ? "In the room" : "Nearby";
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

  // Start/stop legacy api-server-backed proximity loop. Kept running
  // alongside the Firestore loop because it exercises /api/encounters
  // (Postgres source-of-truth) — the Firestore loop only writes to
  // users/{me}/met_people via /api/encounters/record. Per-peer dedup
  // windows in each module prevent duplicate UI emissions.
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

  // Firestore-backed proximity loop. Replaces the legacy api-server
  // pipeline on native: writes our location+geohash to users/{uid},
  // queries other users within 50m, and calls /api/encounters/record
  // (which batch-writes to BOTH users' met_people subcollections via
  // Admin SDK). Falls back to a noop on web / Expo Go where the native
  // Firebase bridge isn't linked — the legacy loop above carries the
  // load there.
  useEffect(() => {
    if (!authedUid || !permissionsCompleted || !api.isConfigured()) {
      stopFirestoreProximity();
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await startFirestoreProximity({
        uid: authedUid,
        listener: (event) => {
          void upsertProximityRef.current(event);
        },
      });
      if (cancelled) {
        stopFirestoreProximity();
        return;
      }
      if (!result.started) {
        console.warn(
          "[appcontext] firestore proximity not started:",
          result.reason ?? "unknown",
        );
      }
    })();
    return () => {
      cancelled = true;
      stopFirestoreProximity();
    };
  }, [authedUid, permissionsCompleted]);

  // Per-peer watermarks track the latest reveal `updatedAt` (epoch ms)
  // we've already applied to local state. They protect against two
  // categories of races:
  //   1. Out-of-order / stale poll responses — a slow-returning poll can
  //      deliver server state that's older than what we've already merged.
  //      Without a watermark, a stale `declined` outbox entry could revert
  //      a freshly re-sent `request_sent` back to neutral.
  //   2. User-driven actions racing against an in-flight poll — when the
  //      user accepts/declines/sends, we bump the watermark to the
  //      response's `updatedAt`, so any older poll response that arrives
  //      later won't undo the action.
  //
  // Keys are peer uids (sender for inbound, recipient for outbound).
  // `pollInFlight` is single-flight protection: skip ticks while a prior
  // poll is still running so concurrent polls can't fight each other.
  const pollInFlight = useRef(false);
  const revealWatermarks = useRef<{
    inbound: Map<string, number>;
    outbound: Map<string, number>;
  }>({ inbound: new Map(), outbound: new Map() });

  // Reset on auth identity change so a previous user's reveal state can't
  // leak into a new session if the same provider instance is reused.
  useEffect(() => {
    revealWatermarks.current = { inbound: new Map(), outbound: new Map() };
    pollInFlight.current = false;
  }, [authedUid]);

  const bumpInboundWatermark = useCallback((senderUid: string, ts: number) => {
    const cur = revealWatermarks.current.inbound.get(senderUid) ?? 0;
    if (ts > cur) revealWatermarks.current.inbound.set(senderUid, ts);
  }, []);
  const bumpOutboundWatermark = useCallback(
    (recipientUid: string, ts: number) => {
      const cur = revealWatermarks.current.outbound.get(recipientUid) ?? 0;
      if (ts > cur) revealWatermarks.current.outbound.set(recipientUid, ts);
    },
    [],
  );

  // Merges the current state of the server-side reveal-request inbox /
  // outbox into local encounters in a single setState. Returns true if
  // anything actually changed so we can avoid pointless AsyncStorage writes
  // on idle polls.
  //
  // Inbox semantics (we are the recipient, status="pending"):
  //   - existing encounter in "encounter" / "request_sent" → "request_received"
  //   - existing in "request_received" → refresh message/profile only
  //   - existing in "connected" or `blocked` → leave alone
  //   - no existing encounter → fabricate one in "request_received"
  // Outbox semantics (we are the sender):
  //   - server "accepted" + local not connected/blocked → "connected"
  //   - server "declined" + local "request_sent" → "encounter" (silent revert)
  //   - server "pending" → no change (lock card already shows the spinner)
  // All entries are watermark-gated: an entry whose `updatedAt` is not
  // strictly newer than our last applied value for that peer is skipped.
  const applyRemoteRevealState = useCallback(
    (
      inbox: RemoteRevealRequestWithProfile[],
      outbox: RemoteRevealRequestWithProfile[],
    ) => {
      setAllEncounters((prev) => {
        let changed = false;
        const byId = new Map(prev.map((e) => [e.id, e] as const));
        const created: Encounter[] = [];

        for (const r of inbox) {
          const ts = Date.parse(r.updatedAt);
          if (!Number.isFinite(ts)) continue;
          const wm = revealWatermarks.current.inbound.get(r.senderUid) ?? 0;
          if (ts <= wm) continue; // stale — a later action already won
          const message = r.message ?? undefined;
          const existing = byId.get(r.senderUid);
          if (existing) {
            if (existing.status === "connected" || existing.blocked) continue;
            const sameMsg =
              (existing.revealMessage ?? undefined) === message &&
              existing.status === "request_received";
            if (sameMsg) continue;
            const next: Encounter = {
              ...existing,
              status: "request_received",
              realName: r.profile.displayName || existing.realName,
              photoUri: r.profile.photoUrl ?? existing.photoUri,
              bio: r.profile.bio ?? existing.bio,
              socials: (r.profile.socials ??
                existing.socials) as Encounter["socials"],
            };
            if (message) next.revealMessage = message;
            else delete (next as { revealMessage?: string }).revealMessage;
            delete (next as { requestSentAt?: number }).requestSentAt;
            byId.set(r.senderUid, next);
            revealWatermarks.current.inbound.set(r.senderUid, ts);
            changed = true;
          } else {
            // Sender isn't in our local list yet (e.g. they scanned our QR
            // and reveal-requested us before we ever detected them). Create
            // a fabricated encounter so the request surfaces in the inbox.
            const ts = Date.parse(r.createdAt) || Date.now();
            const fabricated: Encounter = {
              id: r.senderUid,
              realName: r.profile.displayName || "Met user",
              photoUri: r.profile.photoUrl ?? "",
              bio: r.profile.bio ?? "",
              socials: (r.profile.socials ?? {}) as Encounter["socials"],
              encounterCount: 1,
              firstSeenAt: ts,
              lastSeenAt: ts,
              lastDistanceM: 0,
              lastLocation: "Reveal request",
              status: "request_received",
            };
            if (message) fabricated.revealMessage = message;
            byId.set(r.senderUid, fabricated);
            created.push(fabricated);
            revealWatermarks.current.inbound.set(r.senderUid, ts);
            changed = true;
          }
        }

        for (const r of outbox) {
          const ts = Date.parse(r.updatedAt);
          if (!Number.isFinite(ts)) continue;
          const wm = revealWatermarks.current.outbound.get(r.recipientUid) ?? 0;
          if (ts <= wm) continue; // stale — a later send/accept already won
          const existing = byId.get(r.recipientUid);
          if (!existing) {
            // Still bump the watermark even if we have no local encounter
            // to update — otherwise we'll keep re-evaluating this entry on
            // every poll. The peer not being present means the user
            // removed/blocked them locally; the server row is just history.
            revealWatermarks.current.outbound.set(r.recipientUid, ts);
            continue;
          }
          if (r.status === "accepted") {
            if (existing.status === "connected" || existing.blocked) {
              revealWatermarks.current.outbound.set(r.recipientUid, ts);
              continue;
            }
            const next: Encounter = { ...existing, status: "connected" };
            delete (next as { requestSentAt?: number }).requestSentAt;
            delete (next as { revealMessage?: string }).revealMessage;
            byId.set(r.recipientUid, next);
            revealWatermarks.current.outbound.set(r.recipientUid, ts);
            changed = true;
          } else if (r.status === "declined") {
            // Silent revert: only if we're still showing "waiting" locally.
            // Don't bounce already-connected or already-neutral encounters.
            if (existing.status !== "request_sent") {
              revealWatermarks.current.outbound.set(r.recipientUid, ts);
              continue;
            }
            const next: Encounter = { ...existing, status: "encounter" };
            delete (next as { requestSentAt?: number }).requestSentAt;
            delete (next as { revealMessage?: string }).revealMessage;
            byId.set(r.recipientUid, next);
            revealWatermarks.current.outbound.set(r.recipientUid, ts);
            changed = true;
          } else {
            // pending — no state change but still bump the watermark so
            // we don't keep re-evaluating an unchanged row.
            revealWatermarks.current.outbound.set(r.recipientUid, ts);
          }
        }

        if (!changed) return prev;
        const merged = prev.map((e) => byId.get(e.id) ?? e);
        // Newly fabricated encounters land at the top so they're discoverable.
        const next = created.length > 0 ? [...created, ...merged] : merged;
        // Best-effort persist; never block render.
        saveEncounters(next).catch(() => {});
        return next;
      });
    },
    [],
  );

  // Ref to the current reveal-poll closure so external triggers (e.g.
  // the Firestore requests stream below) can request an immediate poll
  // without duplicating the inbox+outbox fetch / merge logic.
  const triggerRevealPollRef = useRef<(() => void) | null>(null);

  // Reveal-request poller. Runs every 20s while signed in and gated by
  // the same conditions as the proximity loops. The Firestore requests
  // stream subscribed below also fires this poll on any server-side
  // change, giving us near-instant accept/decline updates without
  // teaching the merge logic to consume mirror-shaped Firestore docs.
  useEffect(() => {
    if (!authedUid || !permissionsCompleted || !api.isConfigured()) {
      triggerRevealPollRef.current = null;
      return;
    }
    let cancelled = false;
    const poll = async () => {
      // Single-flight: never let two polls overlap. A slow response would
      // otherwise be able to clobber the next tick's fresher data.
      if (pollInFlight.current) return;
      pollInFlight.current = true;
      try {
        const [inbox, outbox] = await Promise.all([
          api.listInboundReveals({ uid: authedUid }),
          api.listOutboundReveals({ uid: authedUid }),
        ]);
        if (cancelled) return;
        applyRemoteRevealState(inbox, outbox);
      } catch (err) {
        if (!cancelled) {
          console.warn("[appcontext] reveal poll failed", err);
        }
      } finally {
        pollInFlight.current = false;
      }
    };
    triggerRevealPollRef.current = () => {
      void poll();
    };
    void poll();
    const id = setInterval(poll, 20_000);
    return () => {
      cancelled = true;
      triggerRevealPollRef.current = null;
      clearInterval(id);
    };
  }, [authedUid, permissionsCompleted, applyRemoteRevealState]);

  // Firestore real-time subscription for met_people. The legacy GPS
  // and BLE pipelines already maintain the encounter list for peers
  // we detect ourselves; this stream catches the inverse case — peers
  // who detected US first (e.g. their device was awake while ours was
  // backgrounded) so the next time we open the app we see them
  // immediately instead of waiting to detect them again.
  //
  // Lazy profile fetch: each unknown peer triggers a single
  // /api/profiles/<uid> roundtrip. Repeated on every snapshot would
  // waste bandwidth, so we track which uids we've already fabricated
  // an encounter for in a ref and skip them on subsequent snapshots.
  const fabricatedFromMetPeopleRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!authedUid || !permissionsCompleted || !api.isConfigured()) {
      fabricatedFromMetPeopleRef.current = new Set();
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    void (async () => {
      unsubscribe = await subscribeToMetPeople(
        authedUid,
        (people: MetPersonDoc[]) => {
          if (cancelled) return;
          // Snapshot the local list once per stream tick; the actual
          // mutation happens inside setAllEncounters so we always see
          // the freshest committed state.
          const knownIds = new Set<string>();
          setAllEncounters((prev) => {
            for (const e of prev) knownIds.add(e.id);
            return prev;
          });
          for (const p of people) {
            if (knownIds.has(p.otherUid)) continue;
            if (fabricatedFromMetPeopleRef.current.has(p.otherUid)) continue;
            fabricatedFromMetPeopleRef.current.add(p.otherUid);
            // Off-thread: fetch profile, then synthesize an encounter
            // via the same upsertEncounterFromProximity callback the
            // local detection paths use, so the merge logic stays in
            // one place.
            void (async () => {
              try {
                const profile = await api.getProfile(
                  { uid: authedUid },
                  p.otherUid,
                );
                if (cancelled) return;
                await upsertProximityRef.current({
                  uid: p.otherUid,
                  distanceM: 0,
                  source: "gps",
                  profile,
                  observedAt: p.lastMet || Date.now(),
                });
              } catch (err) {
                if ((err as { name?: string }).name !== "AbortError") {
                  console.warn(
                    "[appcontext] met_people profile fetch failed",
                    p.otherUid,
                    err,
                  );
                }
                // Allow retry on the next snapshot tick.
                fabricatedFromMetPeopleRef.current.delete(p.otherUid);
              }
            })();
          }
        },
      );
      if (cancelled && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    })();
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [authedUid, permissionsCompleted]);

  // Firestore real-time subscription for reveal requests. Fires the
  // existing REST poll on any server-side change so accept/decline
  // updates land in the UI within a second instead of waiting for the
  // next 20s tick. Initial snapshot is intentionally skipped (the
  // mount-time poll already covers it).
  useEffect(() => {
    if (!authedUid || !permissionsCompleted || !api.isConfigured()) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    void (async () => {
      unsubscribe = await subscribeToRequestsChange(authedUid, () => {
        if (cancelled) return;
        triggerRevealPollRef.current?.();
      });
      if (cancelled && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    })();
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [authedUid, permissionsCompleted]);

  const sendRevealRequest = useCallback(
    async (recipientUid: string, message?: string) => {
      if (!authedUid) throw new Error("Not signed in");
      if (!api.isConfigured()) throw new Error("API not configured");
      const trimmed = message?.trim();
      // Pessimistic order: API first, then local state. If the network
      // call fails we throw and the encounter screen surfaces an error
      // rather than leaving the user with a fake "waiting" spinner.
      const created = await api.sendReveal(
        { uid: authedUid },
        {
          recipientUid,
          message: trimmed && trimmed.length > 0 ? trimmed : null,
        },
      );
      // Bump the outbound watermark BEFORE the local update so any
      // in-flight poll that started before this send and lands later
      // can't downgrade us based on stale server state.
      const ts = Date.parse(created.updatedAt);
      if (Number.isFinite(ts)) bumpOutboundWatermark(recipientUid, ts);
      await updateEncounterStatus(recipientUid, "request_sent", {
        revealMessage: trimmed && trimmed.length > 0 ? trimmed : undefined,
      });
    },
    [authedUid, updateEncounterStatus, bumpOutboundWatermark],
  );

  const acceptRevealRequest = useCallback(
    async (senderUid: string) => {
      if (!authedUid) throw new Error("Not signed in");
      if (!api.isConfigured()) throw new Error("API not configured");
      const accepted = await api.acceptReveal({ uid: authedUid }, senderUid);
      const ts = Date.parse(accepted.updatedAt);
      if (Number.isFinite(ts)) {
        // Both directions: the inbound row we accepted, AND any reverse
        // outbound row the server auto-accepted as part of mutual consent.
        bumpInboundWatermark(senderUid, ts);
        bumpOutboundWatermark(senderUid, ts);
      }
      await updateEncounterStatus(senderUid, "connected");
    },
    [
      authedUid,
      updateEncounterStatus,
      bumpInboundWatermark,
      bumpOutboundWatermark,
    ],
  );

  const declineRevealRequest = useCallback(
    async (senderUid: string) => {
      if (!authedUid) throw new Error("Not signed in");
      if (!api.isConfigured()) throw new Error("API not configured");
      const declined = await api.declineReveal({ uid: authedUid }, senderUid);
      const ts = Date.parse(declined.updatedAt);
      if (Number.isFinite(ts)) bumpInboundWatermark(senderUid, ts);
      await updateEncounterStatus(senderUid, "encounter");
    },
    [authedUid, updateEncounterStatus, bumpInboundWatermark],
  );

  // Start/stop BLE proximity (scan + advertise). Same gating as GPS.
  // Independent effect so a failure in one pipeline doesn't tear down
  // the other. In Expo Go both halves no-op cleanly.
  useEffect(() => {
    if (!authedUid || !permissionsCompleted || !api.isConfigured()) {
      void stopBleProximity();
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await startBleProximity({
        uid: authedUid,
        listener: (event) => {
          void upsertProximityRef.current(event);
          // Mirror the BLE detection into Firestore via the symmetric
          // recordEncounter endpoint. BLE has no GPS fix, so we omit
          // location — the server is happy to record with location null.
          // Cooldown-gate it locally so a fast re-emit doesn't spam the
          // server (the persistent 2h cooldown is shared with the GPS
          // loop's own cooldown check, so the two pipelines never
          // double-record the same pair within the window).
          void (async () => {
            if (await isInCooldown(authedUid, event.uid)) return;
            // Stamp cooldown BEFORE the API call so a concurrent BLE
            // re-emit (or a GPS-triggered recordEncounter for the same
            // pair) can't read "not cooled" while our request is in
            // flight and double-write. See firestore/presence.ts for
            // the matching pattern.
            await markCooldown(authedUid, event.uid);
            try {
              await api.recordEncounter(
                { uid: authedUid },
                { otherUid: event.uid, location: null },
              );
            } catch (err) {
              console.warn(
                "[appcontext] BLE recordEncounter failed",
                event.uid,
                err,
              );
            }
          })();
        },
      });
      if (cancelled) {
        void stopBleProximity();
        return;
      }
      if (!result.scanner.started) {
        console.warn(
          "[appcontext] BLE scanner not started:",
          result.scanner.reason ?? "unknown",
        );
      }
      if (!result.advertiser.started) {
        console.warn(
          "[appcontext] BLE advertiser not started:",
          result.advertiser.reason ?? "unknown",
        );
      }
    })();
    return () => {
      cancelled = true;
      void stopBleProximity();
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
            // QR scan is a "you've met IRL" signal — same semantic as a
            // BLE / GPS detection. The user must tap "Send reveal request"
            // explicitly; we never auto-fire a reveal on their behalf.
            // Preserve any existing reveal-flow progress so re-scanning a
            // peer mid-flow doesn't undo what's already been sent/accepted.
            const nextStatus: EncounterStatus =
              e.status === "connected" ||
              e.status === "request_sent" ||
              e.status === "request_received"
                ? e.status
                : "encounter";
            return {
              ...e,
              blocked: false,
              status: nextStatus,
              lastSeenAt: now,
              encounterCount: e.encounterCount + 1,
            };
          });
          return next;
        }
        // QR scan of an unknown user — fabricate a minimal encounter in the
        // neutral "encounter" status. The user lands on the lock card and
        // taps "Send reveal request" to initiate. Use an empty photoUri so
        // Avatar falls back to initials/icon instead of a random pravatar
        // face — a real face placeholder would misrepresent who the
        // scanned user is (App Store 4.1).
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
          status: "encounter",
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
      signOutAndClear,
      setPermissionsCompleted,
      upsertEncounterFromQr,
      sendRevealRequest,
      acceptRevealRequest,
      declineRevealRequest,
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
      signOutAndClear,
      setPermissionsCompleted,
      upsertEncounterFromQr,
      sendRevealRequest,
      acceptRevealRequest,
      declineRevealRequest,
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
