"use strict";

const { installExpoObserverAdapter } = require("./metro-expo-observer-adapter.cjs");

try {
  const expoCliEntry = installExpoObserverAdapter();
  require(expoCliEntry);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}