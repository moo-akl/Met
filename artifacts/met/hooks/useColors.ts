import colors from "@/constants/colors";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Returns the design tokens for the currently active theme.
 *
 * Two themes are supported:
 *   "dark"  — Canopy dark (forest surfaces, logo-green #3DCC44)
 *   "light" — Canopy × Apple (warm paper, logo-green #3DCC44, default)
 *
 * The user cycles through them via Settings → Appearance.
 * The preference is persisted to AsyncStorage so it survives app restarts.
 */
export function useColors() {
  const { theme } = useTheme();
  return { ...colors[theme], radius: colors.radius };
}
