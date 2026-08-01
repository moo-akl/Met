import colors from "@/constants/colors";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Returns the design tokens for the currently active theme.
 *
 * Two themes are supported:
 *   "dark"  — Cyber-Social (near-black, amber/gold, cyan)
 *   "light" — Premium Green (light surfaces, logo-green #3DCC44)
 *
 * The user cycles through them via Settings → Appearance.
 * The preference is persisted to AsyncStorage so it survives app restarts.
 */
export function useColors() {
  const { theme } = useTheme();
  return { ...colors[theme], radius: colors.radius };
}
