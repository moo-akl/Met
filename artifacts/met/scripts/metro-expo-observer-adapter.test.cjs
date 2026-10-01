"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const path = require("node:path");
const test = require("node:test");
const {
  createAdaptedObserveFileChanges,
  resolveExpoHelperPath,
} = require("./metro-expo-observer-adapter.cjs");

const expoCliEntry = require.resolve("@expo/cli");
const expoHelper = require(resolveExpoHelperPath(expoCliEntry));
const observeFileChanges = createAdaptedObserveFileChanges(
  expoHelper.observeFileChanges
);

function makeRunner(watcher) {
  const server = new EventEmitter();
  return {
    server,
    metro: {
      getBundler: () => ({
        getBundler: () => ({
          getWatcher: () => watcher,
        }),
      }),
    },
  };
}

test("legacy Metro events keep Expo's filtering and cleanup behavior", () => {
  const watcher = new EventEmitter();
  const runner = makeRunner(watcher);
  const target = path.resolve("/project/.env.local");
  let reloads = 0;
  const off = observeFileChanges(runner, [target], () => reloads++);

  watcher.emit("change", {
    eventsQueue: [
      { type: "add", filePath: "/project/node_modules/.env.local" },
      {
        type: "add",
        filePath: "/project/.env.local",
        metadata: { type: "d" },
      },
      { type: "change", filePath: target, metadata: { type: "f" } },
    ],
  });
  assert.equal(reloads, 1);

  assert.equal(runner.server.listenerCount("close"), 1);
  runner.server.emit("close");
  watcher.emit("change", { eventsQueue: [{ type: "change", filePath: target }] });
  assert.equal(reloads, 1);
  assert.equal(watcher.listenerCount("change"), 0);
  off();
});

test("Metro rootDir changes adapt added, modified, and removed paths to absolute paths", () => {
  const watcher = new EventEmitter();
  const runner = makeRunner(watcher);
  const rootDir = path.resolve("/project");
  const cases = [
    ["addedFiles", ".env.added"],
    ["modifiedFiles", ".env.modified"],
    ["removedFiles", ".env.removed"],
  ];

  for (const [category, relativePath] of cases) {
    let reloads = 0;
    const absolutePath = path.resolve(rootDir, relativePath);
    const off = observeFileChanges(runner, [absolutePath], () => reloads++);
    const changes = {
      addedFiles: new Map(),
      modifiedFiles: new Map(),
      removedFiles: new Map(),
    };
    changes[category].set(relativePath, { modifiedTime: 1 });
    watcher.emit("change", { rootDir, changes });
    assert.equal(reloads, 1, `${category} should match ${absolutePath}`);
    off();
  }
});

test("the adapter leaves unrelated Metro listeners and event objects untouched", () => {
  const watcher = new EventEmitter();
  const runner = makeRunner(watcher);
  const observedPath = path.resolve("/project/.env.local");
  let unrelatedPayload;
  const unrelatedListener = (payload) => {
    unrelatedPayload = payload;
  };
  watcher.addListener("change", unrelatedListener);

  const off = observeFileChanges(runner, [observedPath], () => {});
  const payload = {
    rootDir: path.resolve("/project"),
    changes: {
      addedFiles: new Map(),
      modifiedFiles: new Map([[".env.local", { modifiedTime: 1 }]]),
      removedFiles: new Map(),
    },
  };
  watcher.emit("change", payload);
  assert.equal(unrelatedPayload, payload);
  assert.equal(watcher.listenerCount("change"), 2);

  off();
  assert.equal(watcher.listenerCount("change"), 1);
  assert.equal(watcher.listeners("change")[0], unrelatedListener);
  watcher.removeListener("change", unrelatedListener);
});

test("unsupported watcher payloads fail explicitly", () => {
  assert.throws(
    () => require("./metro-expo-observer-adapter.cjs").getLegacyEvents({ changes: {} }),
    /Unsupported Expo\/Metro observer API/
  );
});