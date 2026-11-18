import fs from "node:fs";
import path from "node:path";

const layoutSource = fs.readFileSync(
  path.join(__dirname, "..", "_layout.tsx"),
  "utf8",
);
const navStart = layoutSource.indexOf("function RootLayoutNav()");
const navEnd = layoutSource.indexOf("\nfunction ", navStart + 1);
const rootStackSource = layoutSource.slice(
  navStart,
  navEnd === -1 ? undefined : navEnd,
);

describe("root navigation screen registration", () => {
  it("registers each Stack.Screen name only once", () => {
    const names = Array.from(
      rootStackSource.matchAll(/<Stack\.Screen\s+name="([^"]+)"/g),
      (match) => match[1],
    );

    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
  });
});
