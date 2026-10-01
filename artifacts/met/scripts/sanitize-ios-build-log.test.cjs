"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { sanitizeLine } = require("./sanitize-ios-build-log.cjs");

test("sanitizes known build-stage progress without retaining its input", () => {
  assert.equal(
    sanitizeLine("[INSTALL_PODS] Installing pods for app.met.founders"),
    "Build stage: installing iOS dependencies.",
  );
  assert.equal(
    sanitizeLine("✔ Build completed with secret-value"),
    "Build stage: build process completed.",
  );
});

test("reports generic signing diagnostics and constrained compiler errors", () => {
  assert.equal(
    sanitizeLine("Provisioning profile 'private-profile-name' is invalid"),
    "Signing diagnostic: provisioning profile issue.",
  );
  assert.equal(
    sanitizeLine("/private/path/App.swift:42:9: error: cannot find 'secretSymbol' in scope"),
    "Native compile error: unresolved symbol.",
  );
  assert.equal(
    sanitizeLine("/private/path/App.ts:4:2: error TS2322: secret details"),
    "TypeScript compile error (TS2322).",
  );
});

test("suppresses private keys, encoded credentials, environment output, JSON, and unknown lines", () => {
  const sensitiveLines = [
    "-----BEGIN PRIVATE KEY-----",
    "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...",
    "A".repeat(64),
    "-----END PRIVATE KEY-----",
    "EXPO_TOKEN=ghp_example-secret-token",
    "EXPO_ASC_API_KEY_PATH=/private/runner/AuthKey_secret.p8",
    "EXPO_ASC_ISSUER_ID=private-issuer-id",
    '{"authorization":"Bearer secret-token","privateKey":"secret-key"}',
    "eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiJzZWNyZXQifQ.signature-secret",
    "unrecognized build output that may include credentials",
  ];

  for (const line of sensitiveLines) {
    assert.equal(sanitizeLine(line), null, "credential-like input must be suppressed");
  }
});