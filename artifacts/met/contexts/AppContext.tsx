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
};

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
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
