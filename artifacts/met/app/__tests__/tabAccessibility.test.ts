import fs from "node:fs";
import path from "node:path";

import colors from "@/constants/colors";

const layoutSource = fs.readFileSync(
  path.join(__dirname, "..", "(tabs)", "_layout.tsx"),
  "utf8",
);

function relativeLuminance(hexColor: string): number {
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(hexColor.slice(offset + 1, offset + 3), 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function getTabBlock(routeName: string): string {
  const match = layoutSource.match(
    new RegExp(
      `<Tabs\\.Screen\\s+name="${routeName}"[\\s\\S]*?(?=\\n\\s*<Tabs\\.Screen|\\n\\s*</Tabs>)`,
    ),
  );
  return match?.[0] ?? "";
}

describe("main tab accessibility", () => {
  it.each([
    ["index", "tabs.home"],
    ["connections", "tabs.connections"],
    ["events", "tabs.networks"],
    ["profile", "tabs.profile"],
  ])("uses the localized title for the %s spoken name", (routeName, titleKey) => {
    expect(getTabBlock(routeName)).toContain(`title: t("${titleKey}")`);
  });

  it("keeps visible tab labels and focus order while hiding helper routes", () => {
    expect(layoutSource).toMatch(/tabBarShowLabel:\s*true/);

    const routes = Array.from(
      layoutSource.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g),
      (match) => match[1],
    );
    expect(routes.filter((route) => !["recent", "networks"].includes(route)))
      .toEqual(["index", "connections", "events", "profile"]);

    expect(getTabBlock("recent")).toMatch(/href:\s*null/);
    expect(getTabBlock("networks")).toMatch(/href:\s*null/);
    for (const route of ["index", "connections", "events", "profile"]) {
      expect(getTabBlock(route)).not.toMatch(/tabBarButton\s*:/);
    }
  });
});

describe("main tab label contrast", () => {
  for (const theme of ["light", "dark"] as const) {
    const palette = colors[theme];
    const activeColor =
      theme === "dark" ? palette.primary : palette.brandPanel;

    it(`${theme} active labels meet WCAG AA contrast`, () => {
      expect(contrastRatio(activeColor, palette.background)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${theme} inactive labels meet WCAG AA contrast`, () => {
      expect(
        contrastRatio(palette.mutedForeground, palette.background),
      ).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("uses the measured theme tokens for tab labels and background", () => {
    expect(layoutSource).toContain(
      "tabBarActiveTintColor: isDark ? colors.primary : colors.brandPanel,",
    );
    expect(layoutSource).toContain(
      "tabBarInactiveTintColor: colors.mutedForeground,",
    );
    expect(layoutSource).toMatch(
      /tabBarStyle:\s*\{[\s\S]*?backgroundColor:\s*colors\.background/,
    );
    expect(layoutSource).toMatch(
      /tabBarBackground:[\s\S]*?backgroundColor:\s*colors\.background/,
    );
  });
});
