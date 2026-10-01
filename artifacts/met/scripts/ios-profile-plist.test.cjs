"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { parseProvisioningPlist } = require("./ios-profile-plist.cjs");

const PROFILE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>ExpirationDate</key>
  <date>2025-06-07T08:09:10Z</date>
  <key>CreationDate</key>
  <date>2024-02-29T23:15:16Z</date>
  <key>DeveloperCertificates</key>
  <array>
    <data>
      AQIDBAUG
      BwgJCgsM
      DQ4PEA==
    </data>
  </array>
  <key>Entitlements</key>
  <dict>
    <key>application-identifier</key>
    <string>TEAM123.com.example.app</string>
    <key>get-task-allow</key>
    <false/>
    <key>aps-environment</key>
    <string>production</string>
    <key>keychain-access-groups</key>
    <array>
      <string>TEAM123.com.example.app</string>
      <string>TEAM123.com.example.shared</string>
    </array>
    <key>nested-settings</key>
    <dict>
      <key>enabled</key>
      <true/>
      <key>labels</key>
      <array>
        <string>alpha</string>
        <string>beta</string>
      </array>
    </dict>
  </dict>
  <key>IsDevelopment</key>
  <true/>
</dict>
</plist>`;

const GENERIC_ERROR = "Unable to parse provisioning profile.";

test("parses a real XML profile with canonical NSData and UTC NSDate normalization", () => {
  const profile = parseProvisioningPlist(Buffer.from(PROFILE_XML, "utf8"));

  assert.deepEqual(profile, {
    ExpirationDate: "2025-06-07T08:09:10Z",
    CreationDate: "2024-02-29T23:15:16Z",
    DeveloperCertificates: ["AQIDBAUGBwgJCgsMDQ4PEA=="],
    Entitlements: {
      "application-identifier": "TEAM123.com.example.app",
      "get-task-allow": false,
      "aps-environment": "production",
      "keychain-access-groups": [
        "TEAM123.com.example.app",
        "TEAM123.com.example.shared",
      ],
      "nested-settings": {
        enabled: true,
        labels: ["alpha", "beta"],
      },
    },
    IsDevelopment: true,
  });
});

test("rejects malformed XML and invalid or non-object parser output generically", () => {
  assert.throws(
    () => parseProvisioningPlist(Buffer.from("<plist><dict><key>broken</dict></plist>")),
    { message: GENERIC_ERROR },
  );

  for (const stdout of ["not-json", "[]", "null", "42"]) {
    assert.throws(
      () =>
        parseProvisioningPlist(Buffer.from("<plist/>"), {
          spawn: () => ({ status: 0, signal: null, stdout, stderr: "" }),
        }),
      { message: GENERIC_ERROR },
    );
  }
});

test("caps input, subprocess output, and configured maxBuffer", () => {
  assert.throws(
    () => parseProvisioningPlist(Buffer.alloc(2 * 1024 * 1024 + 1)),
    { message: GENERIC_ERROR },
  );

  assert.throws(
    () =>
      parseProvisioningPlist(Buffer.from("<plist/>"), {
        maxBuffer: 8,
        spawn: () => ({ status: 0, signal: null, stdout: '{"valid":true}', stderr: "" }),
      }),
    { message: GENERIC_ERROR },
  );

  assert.throws(
    () =>
      parseProvisioningPlist(Buffer.from("<plist/>"), {
        spawn: () => ({
          status: 0,
          signal: null,
          stdout: "x".repeat(4 * 1024 * 1024 + 1),
          stderr: "",
        }),
      }),
    { message: GENERIC_ERROR },
  );
});

test("uses bounded captured Python execution and passes only the literal XML on stdin", () => {
  const xml = Buffer.from("<plist/>");
  let invocation;
  const parsed = parseProvisioningPlist(xml, {
    spawn: (...args) => {
      invocation = args;
      return { status: 0, signal: null, stdout: '{"parsed":true}', stderr: "" };
    },
  });

  assert.deepEqual(parsed, { parsed: true });
  assert.equal(invocation[0], "python3");
  assert.deepEqual(invocation[1].slice(0, 2), ["-I", "-c"]);
  assert.equal(invocation[1].length, 3);
  assert.equal(typeof invocation[1][2], "string");
  assert.equal(invocation[2].input, xml.toString("utf8"));
  assert.equal(invocation[2].timeout, 5_000);
  assert.equal(invocation[2].maxBuffer, 4 * 1024 * 1024);
  assert.equal(invocation[2].encoding, "utf8");
});

test("subprocess failures and exceptions never expose diagnostics or profile details", () => {
  const secretDetails = "private-profile-secret";
  const failures = [
    () => {
      throw new Error(secretDetails);
    },
    () => ({
      error: new Error(secretDetails),
      status: null,
      signal: "SIGKILL",
      stdout: secretDetails,
      stderr: secretDetails,
    }),
    () => ({
      status: 1,
      signal: null,
      stdout: "",
      stderr: `Traceback ${secretDetails}`,
    }),
  ];

  for (const spawn of failures) {
    let thrown;
    try {
      parseProvisioningPlist(Buffer.from("<plist/>"), { spawn });
    } catch (error) {
      thrown = error;
    }
    assert.ok(thrown instanceof Error);
    assert.equal(thrown.message, GENERIC_ERROR);
    assert.equal(thrown.cause, undefined);
    assert.equal(thrown.stack.includes(secretDetails), false);
  }
});