import { useCallback } from "react";

import { useApp } from "@/contexts/AppContext";

/**
 * Single source of truth for the user's beacon visibility, used by every
 * tab's header pill so Visible/Hidden can be toggled from anywhere without
 * opening Settings.
 */
export function useVisibility() {
  const { profile, setProfile } = useApp();
  const isVisible = profile?.isVisible ?? true;

  const toggle = useCallback(() => {
    if (!profile) return;
    setProfile({ ...profile, isVisible: !isVisible });
  }, [profile, isVisible, setProfile]);

  return { isVisible, toggle, hasProfile: !!profile };
}
