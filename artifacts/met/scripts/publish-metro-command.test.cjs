"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { getMetroCommand } = require("./build.js");

test("publishing launches the same observer-compatible CLI as development", () => {
  const { command, args } = getMetroCommand();
  assert.equal(command, process.execPath);
  assert.equal(args[0], path.join(__dirname, "start-expo-with-metro-observer-fix.cjs"));
  assert.equal(fs.existsSync(args[0]), true);
  assert.deepEqual(args.slice(1), [
    "start", "--no-dev", "--minify", "--localhost",
    "--port", "8081", "--max-workers", "1",
  ]);
});