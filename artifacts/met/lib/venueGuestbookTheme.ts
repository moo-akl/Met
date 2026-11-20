import { Platform } from "react-native";

import themeColors from "@/constants/colors";

export const VENUE_GUESTBOOK_THEME = {
  accent: themeColors.light.brandPanel,
  ink: "#2B2A4C",
  inkSoft: "#5A5876",
  paper: "#FFF9EE",
  paperAlt: "#FBF3E4",
  rule: "#EADFCB",
  shadow: "#7A5A2E",
  handFont: Platform.select({
    ios: "Noteworthy",
    android: "cursive",
    default: "cursive",
  }),
  handBoldFont: Platform.select({
    ios: "Noteworthy-Bold",
    android: "cursive",
    default: "cursive",
  }),
} as const;
