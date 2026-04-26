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
  setProfile: (p: Profile) => Promise<void>;
  updateEncounterStatus: (id: string, status: EncounterStatus) => Promise<void>;
  resetAll: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [p, e] = await Promise.all([loadProfile(), loadEncounters()]);
      if (!mounted) return;
      setProfileState(p);
      if (e && e.length > 0) {
        setEncounters(e);
      } else {
        const seeded = buildSeedEncounters();
        setEncounters(seeded);
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
      setEncounters((prev) => {
        next = prev.map((enc) => (enc.id === id ? { ...enc, status } : enc));
        return next;
      });
      await saveEncounters(next);
    },
    [],
  );

  const resetAll = useCallback(async () => {
    await clearProfile();
    await clearEncounters();
    const seeded = buildSeedEncounters();
    setProfileState(null);
    setEncounters(seeded);
    await saveEncounters(seeded);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      profile,
      encounters,
      setProfile,
      updateEncounterStatus,
      resetAll,
    }),
    [ready, profile, encounters, setProfile, updateEncounterStatus, resetAll],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
