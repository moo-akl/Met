import colors from "@/constants/colors";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Returns the design tokens for the currently active theme.
 *
 * The user can toggle between "dark" (radar/military palette) and "light"
 * (original bright green palette) via ThemeContext. The preference is
 * persisted to AsyncStorage so it survives app restarts.
 */
export function useColors() {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
