"use strict";

const path = require("node:path");

const HELPER_RELATIVE_PATH = "../src/start/server/metro/waitForMetroToObserveTypeScriptFile.js";

function unsupported(detail) {
  return new Error(`[expo-metro-observer] Unsupported Expo/Metro observer API: ${detail}`);
}

function getWatcher(runner) {
  try {
    const watcher = runner.metro.getBundler().getBundler().getWatcher();
    if (
      watcher == null ||
      typeof watcher.addListener !== "function" ||
      typeof watcher.removeListener !== "function"
    ) {
      throw unsupported("Metro watcher must expose addListener() and removeListener().");
    }
    return watcher;
  } catch (error) {
    if (error.message.startsWith("[expo-metro-observer]")) {
      throw error;
    }
    throw unsupported(
      "Expo's runner.metro.getBundler().getBundler().getWatcher() contract is unavailable."
    );
  }
}

function getLegacyEvents(payload) {
  if (payload == null || typeof payload !== "object") {
    throw unsupported("Metro emitted a non-object watcher change.");
  }

  if (Object.prototype.hasOwnProperty.call(payload, "eventsQueue")) {
    if (!Array.isArray(payload.eventsQueue)) {
      throw unsupported("Legacy Metro change.eventsQueue must be an array.");
    }
    return payload.eventsQueue;
  }

  if (
    typeof payload.rootDir !== "string" ||
    payload.changes == null ||
    typeof payload.changes !== "object"
  ) {
    throw unsupported("Expected Metro change payload with rootDir and changes.");
  }

  const categories = [
    ["addedFiles", "add"],
    ["modifiedFiles", "change"],
    ["removedFiles", "delete"],
  ];
  const eventsQueue = [];
  for (const [category, type] of categories) {
    const changes = payload.changes[category];
    if (changes == null || typeof changes[Symbol.iterator] !== "function") {
      throw unsupported(`Metro change.changes.${category} must be iterable.`);
    }

    for (const entry of changes) {
      if (
        !Array.isArray(entry) ||
        entry.length < 1 ||
        typeof entry[0] !== "string"
      ) {
        throw unsupported(`Metro change.changes.${category} contains an invalid path entry.`);
      }
      eventsQueue.push({
        type,
        filePath: path.resolve(payload.rootDir, entry[0]),
        metadata: entry[1],
      });
    }
  }
  return eventsQueue;
}

function createWatcherFacade(watcher) {
  const subscriptions = new Map();
  return {
    addListener(eventName, listener) {
      if (eventName !== "change") {
        watcher.addListener(eventName, listener);
        return this;
      }
      if (typeof listener !== "function") {
        throw unsupported("Expo's change listener must be a function.");
      }
      const adaptedListener = (payload) => {
        listener({ eventsQueue: getLegacyEvents(payload) });
      };
      let adaptedListeners = subscriptions.get(listener);
      if (adaptedListeners == null) {
        adaptedListeners = [];
        subscriptions.set(listener, adaptedListeners);
      }
      adaptedListeners.push(adaptedListener);
      watcher.addListener(eventName, adaptedListener);
      return this;
    },
    removeListener(eventName, listener) {
      if (eventName !== "change") {
        watcher.removeListener(eventName, listener);
        return this;
      }
      const adaptedListeners = subscriptions.get(listener);
      if (adaptedListeners != null && adaptedListeners.length > 0) {
        watcher.removeListener(eventName, adaptedListeners.shift());
        if (adaptedListeners.length === 0) {
          subscriptions.delete(listener);
        }
      } else {
        watcher.removeListener(eventName, listener);
      }
      return this;
    },
  };
}

function createAdaptedObserveFileChanges(originalObserveFileChanges) {
  if (typeof originalObserveFileChanges !== "function") {
    throw unsupported("Expo does not export observeFileChanges().");
  }

  return function observeFileChanges(runner, files, callback) {
    const watcherFacade = createWatcherFacade(getWatcher(runner));
    const metroFacade = {
      getBundler() {
        return {
          getBundler() {
            return {
              getWatcher() {
                return watcherFacade;
              },
            };
          },
        };
      },
    };
    const runnerFacade = new Proxy(runner, {
      get(target, property, receiver) {
        return property === "metro"
          ? metroFacade
          : Reflect.get(target, property, receiver);
      },
    });
    return originalObserveFileChanges(runnerFacade, files, callback);
  };
}

function resolveExpoHelperPath(expoCliEntry) {
  return require.resolve(
    path.resolve(path.dirname(expoCliEntry), HELPER_RELATIVE_PATH)
  );
}

function installExpoObserverAdapter() {
  let expoCliEntry;
  try {
    expoCliEntry = require.resolve("@expo/cli");
  } catch (error) {
    throw unsupported(`Unable to resolve this project's @expo/cli (${error.message}).`);
  }

  const expoPackagePath = path.resolve(path.dirname(expoCliEntry), "../../package.json");
  let expoPackage;
  try {
    expoPackage = require(expoPackagePath);
  } catch (error) {
    throw unsupported(`Unable to read the resolved @expo/cli package (${error.message}).`);
  }
  if (typeof expoPackage.version !== "string" || !/^54\./.test(expoPackage.version)) {
    throw unsupported(`Expected Expo CLI 54.x, found ${String(expoPackage.version)}.`);
  }

  let helperPath;
  try {
    helperPath = resolveExpoHelperPath(expoCliEntry);
  } catch (error) {
    throw unsupported(`Expo 54 observer helper was not found (${error.message}).`);
  }

  let helper;
  try {
    helper = require(helperPath);
  } catch (error) {
    throw unsupported(`Expo observer helper could not be loaded (${error.message}).`);
  }
  if (
    typeof helper.observeFileChanges !== "function" ||
    typeof helper.waitForMetroToObserveTypeScriptFile !== "function" ||
    typeof helper.observeAnyFileChanges !== "function"
  ) {
    throw unsupported("Expo observer helper exports do not match the verified Expo 54 API.");
  }

  const cacheEntry = require.cache[helperPath];
  if (cacheEntry == null) {
    throw unsupported("Expo observer helper was not registered in Node's module cache.");
  }
  cacheEntry.exports = {
    ...helper,
    observeFileChanges: createAdaptedObserveFileChanges(helper.observeFileChanges),
  };

  return expoCliEntry;
}

module.exports = {
  createAdaptedObserveFileChanges,
  getLegacyEvents,
  installExpoObserverAdapter,
  resolveExpoHelperPath,
};