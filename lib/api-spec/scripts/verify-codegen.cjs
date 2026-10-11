// Runs on the checkout being verified, never against another checkout's links.
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { readdirSync, readFileSync, realpathSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const ts = require("typescript");

const root = path.resolve(__dirname, "../../..");
const generatedDirs = [
  "lib/api-client-react/src/generated",
  "lib/api-zod/src/generated",
];

function run(args) {
  const result = spawnSync("pnpm", args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `pnpm ${args.join(" ")} failed`);
}

function checkWorkspaceLinks() {
  const consumers = [
    "artifacts/met",
    ...readdirSync(path.join(root, "lib"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "integrations")
      .map((entry) => `lib/${entry.name}`),
  ];
  for (const consumer of consumers) {
    const manifest = JSON.parse(readFileSync(path.join(root, consumer, "package.json"), "utf8"));
    const dependencies = { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies };
    for (const [name, version] of Object.entries(dependencies)) {
      if (!version.startsWith("workspace:")) continue;
      const target = realpathSync(path.join(root, consumer, "node_modules", name));
      assert.ok(
        target.startsWith(`${root}${path.sep}`),
        `${consumer}: ${name} resolves outside this checkout: ${target}`,
      );
    }
  }
}

function snapshot() {
  const files = new Map();
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else {
        const content = readFileSync(file);
        files.set(path.relative(root, file), createHash("sha256").update(content).digest("hex"));
        if (file.endsWith(".ts")) checkDeclarations(file, content.toString());
      }
    }
  }
  for (const dir of generatedDirs) walk(path.join(root, dir));
  return [...files].sort(([a], [b]) => a.localeCompare(b));
}

function checkDeclarations(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const seen = new Set();
  function record(kind, name) {
    const key = `${kind}:${name}`;
    assert.ok(!seen.has(key), `Duplicate ${kind} declaration ${name} in ${file}`);
    seen.add(key);
  }
  for (const statement of source.statements) {
    // Function overloads are intentional; the compiler checks their signatures.
    // A schema's type and value may also intentionally have the same name.
    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      record("type", statement.name.text);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) record("value", declaration.name.text);
      }
    }
  }
}

checkWorkspaceLinks();
run(["--filter", "@workspace/api-spec", "run", "codegen"]);
const first = snapshot();
run(["--filter", "@workspace/api-spec", "run", "codegen"]);
assert.deepEqual(snapshot(), first, "A second generation changed the generated files");
run(["--filter", "@workspace/met", "run", "typecheck"]);
console.info("Repeat generation, declaration uniqueness, shared-library and mobile typechecks passed.");
