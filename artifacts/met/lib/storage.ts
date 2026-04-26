import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Encounter, Profile } from "./types";

const PROFILE_KEY = "met:profile:v1";
const ENCOUNTERS_KEY = "met:encounters:v1";
const PERMISSIONS_KEY = "met:permissions:v1";

export async function loadProfile(): Promise<Profile | null> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  return raw ? (JSON.parse(raw) as Profile) : null;
}

export async function saveProfile(p: Profile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export async function clearProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY);
}

export async function loadEncounters(): Promise<Encounter[] | null> {
  const raw = await AsyncStorage.getItem(ENCOUNTERS_KEY);
  return raw ? (JSON.parse(raw) as Encounter[]) : null;
}

export async function saveEncounters(e: Encounter[]): Promise<void> {
  await AsyncStorage.setItem(ENCOUNTERS_KEY, JSON.stringify(e));
}

export async function clearEncounters(): Promise<void> {
  await AsyncStorage.removeItem(ENCOUNTERS_KEY);
}

export async function loadPermissionsCompleted(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PERMISSIONS_KEY);
  return raw === "1";
}

export async function savePermissionsCompleted(done: boolean): Promise<void> {
  if (done) {
    await AsyncStorage.setItem(PERMISSIONS_KEY, "1");
  } else {
    await AsyncStorage.removeItem(PERMISSIONS_KEY);
  }
}
