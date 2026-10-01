const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const { createRequire } = require("node:module");
const { test } = require("node:test");
const { stripOverridesBlock } = require("./eas-pre-install");

// Exercise Expo's actual Metro instance, not an independently resolved copy.
const expoRequire = createRequire(require.resolve("expo/metro-config"));
const metroRequire = createRequire(expoRequire.resolve("@expo/metro/package.json"));
const { parse: parseYaml } = expoRequire("yaml");
const { getAssetSize, getAssetData } = metroRequire("@expo/metro/metro/Assets");
const appRoot = path.resolve(__dirname, "..");
const workspacePath = path.resolve(appRoot, "../../pnpm-workspace.yaml");
const iconPath = path.join(appRoot, "assets/images/icon.png");
const icon = fs.readFileSync(iconPath);
const dimensions = {
  width: icon.readUInt32BE(16),
  height: icon.readUInt32BE(20),
};

test("Expo resolves the security-fixed Metro patch release", () => {
  assert.equal(metroRequire("metro/package.json").version, "0.83.8");
  assert.throws(() => metroRequire.resolve("image-size"), { code: "MODULE_NOT_FOUND" });
});

test("Metro reads real app PNG dimensions and rejects malformed assets", () => {
  assert.deepEqual(getAssetSize("png", icon, iconPath), dimensions);
  assert.throws(() => getAssetSize("png", Buffer.alloc(0), "empty.png"));
  assert.throws(() => getAssetSize("png", Buffer.from("not an image"), "invalid.png"));
  assert.equal(getAssetSize("txt", Buffer.from("text"), "file.txt"), null);
});

for (const platform of ["ios", "android", "web"]) {
  test(`Metro builds asset metadata for ${platform}`, async () => {
    const asset = await getAssetData(iconPath, "assets/images/icon.png", [], platform, "/assets");
    assert.equal(asset.width, dimensions.width);
    assert.equal(asset.height, dimensions.height);
    assert.equal(asset.type, "png");
    assert.ok(asset.hash);
    assert.ok(asset.files.includes(iconPath));
  });
}

test("EAS keeps all portable security overrides but removes platform exclusions", () => {
  const original = fs.readFileSync(workspacePath, "utf8");
  const stripped = stripOverridesBlock(original);
  const pins = original.match(/^  metro(?:-[a-z-]+)?: .+$/gm);
  assert.equal(pins.length, 14);
  assert.deepEqual(stripped.match(/^  metro(?:-[a-z-]+)?: .+$/gm), pins);
  assert.ok(!stripped.includes("esbuild>@esbuild/darwin"));
  const originalOverrides = parseYaml(original).overrides;
  const expected = Object.fromEntries(
    Object.entries(originalOverrides).filter(([, value]) => value !== "-"),
  );
  assert.deepEqual(parseYaml(stripped).overrides, expected);
  assert.equal(parseYaml(stripped).overrides.esbuild, "0.28.1");
  assert.equal(parseYaml(stripped).overrides["picomatch@2"], "2.3.2");
  assert.equal(parseYaml(stripped).overrides["@esbuild-kit/esm-loader"], "npm:tsx@^4.21.0");
  assert.ok(stripped.includes("packages:"));
  assert.ok(stripped.includes("catalog:"));
  assert.equal(stripOverridesBlock(stripped), stripped);
});

test("EAS override filtering retains later top-level configuration", () => {
  assert.equal(
    stripOverridesBlock("overrides:\n  metro: 0.83.8\n  esbuild: 0.27.3\nnextKey: true\n"),
    "overrides:\n  metro: 0.83.8\n  esbuild: 0.27.3\nnextKey: true\n",
  );
  assert.equal(stripOverridesBlock("overrides:\n  esbuild>@esbuild/darwin-arm64: '-'\n"), "");
});

test("EAS removes only binary tombstones, not portable removals or binary version pins", () => {
  const input = [
    "overrides:",
    "  'esbuild>@esbuild/darwin-arm64': '-' # allow this binary on EAS",
    '  "rollup>@rollup/rollup-darwin-x64": "-"',
    "  'vulnerable-package': '-'",
    "  esbuild>@esbuild/darwin-x64: 0.28.1",
    "  '@parent/pkg>child': '^2.3.4'",
    "nextKey: true",
    "",
  ].join("\n");
  const result = parseYaml(stripOverridesBlock(input));
  assert.deepEqual(result.overrides, {
    "vulnerable-package": "-",
    "esbuild>@esbuild/darwin-x64": "0.28.1",
    "@parent/pkg>child": "^2.3.4",
  });
  assert.equal(result.nextKey, true);
});

test("regenerated EAS graph keeps safe esbuild through Vite/tsx and allows Darwin binaries", { timeout: 180000 }, (t) => {
  const root = path.dirname(workspacePath);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "met-eas-security-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const lockPath = path.join(root, "pnpm-lock.yaml");
  const lock = fs.readFileSync(lockPath, "utf8");
  const workspace = stripOverridesBlock(fs.readFileSync(workspacePath, "utf8"));
  fs.writeFileSync(path.join(temp, "pnpm-workspace.yaml"), workspace);
  fs.writeFileSync(path.join(temp, "pnpm-lock.yaml"), lock);
  // Copy only manifests: no app files, node_modules, credentials, or lifecycle scripts.
  for (const importer of Object.keys(parseYaml(lock).importers)) {
    const dir = path.join(temp, importer);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(root, importer, "package.json"), path.join(dir, "package.json"));
  }
  // Mirror the hook's root Expo injection before lockfile regeneration.
  const rootPkgPath = path.join(temp, "package.json");
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8"));
  const appPkg = JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8"));
  rootPkg.devDependencies.expo = appPkg.devDependencies.expo;
  fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg));
  try {
    execFileSync("pnpm", [
      "install", "--lockfile-only", "--no-frozen-lockfile",
      "--no-strict-peer-dependencies", "--ignore-scripts",
    ], { cwd: temp, timeout: 150000, stdio: "pipe" });
  } catch (error) {
    throw new Error(`EAS lockfile regeneration failed:\n${error.stdout || ""}\n${error.stderr || ""}`, { cause: error });
  }
  const regenerated = parseYaml(fs.readFileSync(path.join(temp, "pnpm-lock.yaml"), "utf8"));
  assert.deepEqual(regenerated.overrides, parseYaml(workspace).overrides);
  const safeVersion = regenerated.overrides.esbuild;
  // The workspace's patched pin is stricter than GHSA-67mh-4wv8-2f99's
  // affected range (<=0.24.2). No older esbuild may sneak in via any parent.
  assert.equal(safeVersion, "0.28.1");
  assert.deepEqual(Object.keys(regenerated.packages).filter((key) => key.startsWith("esbuild@")), [`esbuild@${safeVersion}`]);
  for (const parent of ["vite@", "tsx@"]) {
    const snapshots = Object.entries(regenerated.snapshots).filter(([key]) => key.startsWith(parent));
    assert.ok(snapshots.length > 0, `${parent} must be present in the graph`);
    for (const [key, snapshot] of snapshots) {
      assert.equal(snapshot.dependencies.esbuild, safeVersion, key);
    }
  }
  const esbuild = regenerated.snapshots[`esbuild@${safeVersion}`];
  for (const arch of ["arm64", "x64"]) {
    const binary = `@esbuild/darwin-${arch}`;
    assert.equal(esbuild.optionalDependencies[binary], safeVersion);
    assert.ok(regenerated.packages[`${binary}@${safeVersion}`]);
    for (const prefix of ["@rollup/rollup-", "lightningcss-", "@tailwindcss/oxide-", "@expo/ngrok-bin-"]) {
      assert.ok(Object.keys(regenerated.packages).some((key) => key.startsWith(`${prefix}darwin-${arch}@`)), `${prefix}darwin-${arch} must be allowed`);
    }
  }
  // The checked-in Linux workspace must remain untouched.
  assert.equal(fs.readFileSync(lockPath, "utf8"), lock);
});