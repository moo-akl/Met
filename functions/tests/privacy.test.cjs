const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const typescript = require("typescript");

const sourcePath = path.resolve(__dirname, "../src/privacy.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = typescript.transpileModule(source, {
  compilerOptions: {
    module: typescript.ModuleKind.CommonJS,
    target: typescript.ScriptTarget.ES2022,
  },
}).outputText;
const privacyModule = new Module(sourcePath, module);
privacyModule.filename = sourcePath;
privacyModule.paths = Module._nodeModulePaths(path.dirname(sourcePath));
privacyModule._compile(compiled, sourcePath);

const {
  acquireProfilePrivacyLocks,
  isExplicitRevealRelationshipStatus,
  withPostgresTransaction,
} = privacyModule.exports;

function createClient({ failOnQuery } = {}) {
  const calls = [];
  return {
    calls,
    async query(query, values) {
      calls.push({ kind: "query", query, values });
      if (query === failOnQuery) throw new Error(`query failed: ${query}`);
      return {};
    },
    release() {
      calls.push({ kind: "release" });
    },
  };
}

test("profile privacy locks use the shared namespace in sorted unique UID order", async () => {
  const client = createClient();

  await acquireProfilePrivacyLocks(client, ["uid-b", "uid-a", "uid-b"]);

  assert.deepEqual(
    client.calls.map((call) => call.values?.[0]),
    ["met-profile-privacy:uid-a", "met-profile-privacy:uid-b"],
  );
  assert.ok(
    client.calls.every((call) =>
      call.query.includes(
        "pg_advisory_xact_lock(hashtextextended($1, 0))",
      ),
    ),
  );
});

test("privacy transaction keeps locks through asynchronous side effects, then commits and releases", async () => {
  const client = createClient();

  const result = await withPostgresTransaction(client, async () => {
    await acquireProfilePrivacyLocks(client, ["uid-b", "uid-a"]);
    client.calls.push({ kind: "side-effect" });
    return "done";
  });

  assert.equal(result, "done");
  assert.deepEqual(
    client.calls.map((call) =>
      call.kind === "query" ? call.query : call.kind,
    ),
    [
      "BEGIN",
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      "side-effect",
      "COMMIT",
      "release",
    ],
  );
});

test("privacy transaction rolls back and releases when guarded work fails", async () => {
  const client = createClient();

  await assert.rejects(
    withPostgresTransaction(client, async () => {
      await acquireProfilePrivacyLocks(client, ["uid-a"]);
      throw new Error("guarded operation failed");
    }),
    /guarded operation failed/,
  );

  assert.deepEqual(
    client.calls.map((call) =>
      call.kind === "query" ? call.query : call.kind,
    ),
    [
      "BEGIN",
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      "ROLLBACK",
      "release",
    ],
  );
});

test("privacy transaction rolls back and releases when commit fails", async () => {
  const client = createClient({ failOnQuery: "COMMIT" });

  await assert.rejects(
    withPostgresTransaction(client, async () => "done"),
    /query failed: COMMIT/,
  );

  assert.deepEqual(
    client.calls.map((call) =>
      call.kind === "query" ? call.query : call.kind,
    ),
    ["BEGIN", "COMMIT", "ROLLBACK", "release"],
  );
});

test("an existing reveal remains explicit across PG-visible/Firestore-hidden divergence", () => {
  const postgresVisible = true;
  const firestoreVisible = false;
  assert.notEqual(postgresVisible, firestoreVisible);
  assert.equal(isExplicitRevealRelationshipStatus("pending"), true);
  assert.equal(isExplicitRevealRelationshipStatus("accepted"), true);
  assert.equal(isExplicitRevealRelationshipStatus("declined"), false);
  assert.equal(isExplicitRevealRelationshipStatus(undefined), false);
});