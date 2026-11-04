import { createContext, createElement, useContext, type ReactNode } from 'react';

export type VenueIntroProfile = {
  key: string;
  venueName: string;
  venueCategory?: string;
  venueLocation?: string;
  activationMode?: boolean;
  coverCopy: string;
  slide2Heading: string;
  slide2Copy: string;
  slide3Heading: string;
  slide3Copy: string;
};

function isProfileCopy(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length >= 2 &&
    value.trim().length <= maxLength
  );
}

export function parseVenueIntroProfile(
  value: unknown,
): VenueIntroProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const profile = value as Record<string, unknown>;
  const venueCategory = profile.venueCategory;
  const venueLocation = profile.venueLocation;
  const activationMode = profile.activationMode;
  if (
    typeof profile.key !== 'string' ||
    profile.key.trim().length < 1 ||
    profile.key.length > 120 ||
    !isProfileCopy(profile.venueName, 100) ||
    (venueCategory !== undefined && !isProfileCopy(venueCategory, 70)) ||
    (venueLocation !== undefined && !isProfileCopy(venueLocation, 100)) ||
    (activationMode !== undefined && typeof activationMode !== 'boolean') ||
    !isProfileCopy(profile.coverCopy, 240) ||
    !isProfileCopy(profile.slide2Heading, 100) ||
    !isProfileCopy(profile.slide2Copy, 300) ||
    !isProfileCopy(profile.slide3Heading, 100) ||
    !isProfileCopy(profile.slide3Copy, 300)
  ) {
    return null;
  }

  return {
    key: profile.key,
    venueName: profile.venueName.trim(),
    ...(typeof venueCategory === 'string' ? { venueCategory: venueCategory.trim() } : {}),
    ...(typeof venueLocation === 'string' ? { venueLocation: venueLocation.trim() } : {}),
    ...(activationMode === true ? { activationMode: true } : {}),
    coverCopy: profile.coverCopy.trim(),
    slide2Heading: profile.slide2Heading.trim(),
    slide2Copy: profile.slide2Copy.trim(),
    slide3Heading: profile.slide3Heading.trim(),
    slide3Copy: profile.slide3Copy.trim(),
  };
}

const VenueIntroProfileContext = createContext<VenueIntroProfile | null>(null);

export function useActiveVenueIntroProfile() {
  return useContext(VenueIntroProfileContext);
}

export function VenueIntroProfileProvider({
  profile,
  children,
}: {
  profile: VenueIntroProfile;
  children: ReactNode;
}) {
  return createElement(
    VenueIntroProfileContext.Provider,
    { value: profile },
    children,
  );
}
