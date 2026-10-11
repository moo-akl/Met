const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const packageDir = path.resolve(__dirname, "..");
const orvalBin = path.join(path.dirname(require.resolve("orval/package.json")), "dist/bin/orval.mjs");
const outputs = ["api-client-react", "api-zod"];
const validSpec = `openapi: 3.0.3
info:
  title: Api
  version: 1.0.0
paths:
  /ping:
    get:
      operationId: ping
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: string
`;

function fixture(t, spec) {
  const root = mkdtempSync(path.join(os.tmpdir(), "api-codegen-safety-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const specDir = path.join(root, "lib/api-spec");
  mkdirSync(specDir, { recursive: true });
  copyFileSync(path.join(packageDir, "orval.config.ts"), path.join(specDir, "orval.config.ts"));
  copyFileSync(path.join(packageDir, "package.json"), path.join(specDir, "package.json"));
  symlinkSync(path.join(packageDir, "node_modules"), path.join(specDir, "node_modules"), "dir");
  // pnpm's command shim also references the workspace-root virtual store.
  symlinkSync(path.resolve(packageDir, "../../node_modules"), path.join(root, "node_modules"), "dir");
  writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - lib/*\n");
  // If a failed validation ever reaches the compiler gate, leave evidence.
  writeFileSync(path.join(root, "package.json"), JSON.stringify({
    private: true,
    scripts: { "typecheck:libs": 'node -e "require(\'fs\').writeFileSync(\'compiler-ran\', \'yes\')"' },
  }));
  writeFileSync(path.join(specDir, "openapi.yaml"), spec);
  for (const output of outputs) {
    const src = path.join(root, "lib", output, "src");
    mkdirSync(path.join(src, "generated/nested"), { recursive: true });
    writeFileSync(path.join(src, "generated/previous.ts"), `// working ${output}\n`);
    writeFileSync(path.join(src, "generated/nested/model.ts"), Buffer.from([0, 1, 2, 255]));
  }
  writeFileSync(path.join(root, "lib/api-client-react/src/custom-fetch.ts"),
    "export async function customFetch<T>(url: string, options?: RequestInit): Promise<T> { return {} as T; }\n");
  return { root, specDir };
}

function snapshot(root) {
  const files = {};
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else files[path.relative(root, file)] = readFileSync(file).toString("base64");
    }
  }
  for (const output of outputs) walk(path.join(root, "lib", output, "src"));
  return files;
}

function generate(specDir, command = "direct") {
  return command === "codegen"
    ? spawnSync("pnpm", ["run", "codegen"], { cwd: specDir, encoding: "utf8", timeout: 60000 })
    : spawnSync(process.execPath, [orvalBin, "--config", "./orval.config.ts"], {
      cwd: specDir, encoding: "utf8", timeout: 60000,
    });
}

const invalidSpecs = [
  ["malformed YAML", `${validSpec}components:\n  schemas: [unterminated\n`, /flow sequence|YAML/i],
  ["duplicate top-level mapping", `${validSpec}paths: {}\n`, /unique/i],
  ["conflicting nested mapping", validSpec.replace("    get:\n", "    get: {}\n    get:\n"), /unique/i],
  ["identical nested mapping", validSpec.replace("  version: 1.0.0\n", "  version: 1.0.0\n  version: 1.0.0\n"), /unique/i],
];

for (const [name, spec, diagnostic] of invalidSpecs) {
  test(`${name} fails before either generated directory is changed`, (t) => {
    const { root, specDir } = fixture(t, spec);
    const before = snapshot(root);
    const result = generate(specDir);
    assert.ifError(result.error);
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /Invalid API specification/);
    assert.match(result.stdout + result.stderr, diagnostic);
    assert.deepEqual(snapshot(root), before);
  });
}

test("the public codegen command also preserves outputs and skips the compiler on invalid YAML", (t) => {
  const { root, specDir } = fixture(t, invalidSpecs[1][1]);
  const before = snapshot(root);
  const result = generate(specDir, "codegen");
  assert.ifError(result.error);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /Invalid API specification/);
  assert.deepEqual(snapshot(root), before);
  assert.ok(!readdirSync(root).includes("compiler-ran"));
});

test("valid YAML still generates both outputs and removes stale generated files", (t) => {
  const { root, specDir } = fixture(t, validSpec);
  const result = generate(specDir);
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const output of outputs) {
    const generated = path.join(root, "lib", output, "src/generated");
    assert.ok(!readdirSync(generated).includes("previous.ts"));
    assert.match(readFileSync(path.join(generated, "api.ts"), "utf8"), /ping/i);
  }
  assert.match(readFileSync(path.join(root, "lib/api-client-react/src/custom-fetch.ts"), "utf8"), /customFetch/);
});
