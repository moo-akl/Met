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
  loadProfile,
  saveEncounters,
  saveProfile,
} from "@/lib/storage";
import type { Encounter, EncounterStatus, Profile } from "@/lib/types";

type AppContextValue = {
  ready: boolean;
  profile: Profile | null;
  encounters: Encounter[];
  blockedEncounters: Encounter[];
  allEncounters: Encounter[];
  setProfile: (p: Profile) => Promise<void>;
  updateEncounterStatus: (id: string, status: EncounterStatus) => Promise<void>;
  removeEncounter: (id: string) => Promise<void>;
  setBlocked: (id: string, blocked: boolean) => Promise<void>;
  resetAll: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [allEncounters, setAllEncounters] = useState<Encounter[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [p, e] = await Promise.all([loadProfile(), loadEncounters()]);
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
    const seeded = buildSeedEncounters();
    setProfileState(null);
    setAllEncounters(seeded);
    await saveEncounters(seeded);
  }, []);

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
      setProfile,
      updateEncounterStatus,
      removeEncounter,
      setBlocked,
      resetAll,
    }),
    [
      ready,
      profile,
      encounters,
      blockedEncounters,
      allEncounters,
      setProfile,
      updateEncounterStatus,
      removeEncounter,
      setBlocked,
      resetAll,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
