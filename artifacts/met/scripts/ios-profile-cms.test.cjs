"use strict";

const assert = require("node:assert/strict");
const { spawnSync: realSpawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { decodeProvisioningProfile } = require("./repair-ios-signing-profile.cjs");

const PROFILE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>ExpirationDate</key>
  <date>2027-03-04T05:06:07Z</date>
  <key>CreationDate</key>
  <date>2026-01-02T03:04:05Z</date>
  <key>DeveloperCertificates</key>
  <array>
    <data>
      AAECAwQF
      BgcICQoL
      DA0ODw==
    </data>
  </array>
</dict>
</plist>`;
const PROFILE_CERTIFICATE = "AAECAwQFBgcICQoLDA0ODw==";
const CMS_INPUT = Buffer.from("synthetic CMS profile wrapper").toString("base64");
const GENERIC_FAILURE = "FAILED_VALIDATION";

function makePrivateTempRoot() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "met-profile-cms-test-"));
  fs.chmodSync(tempRoot, 0o700);
  return tempRoot;
}

function assertDecoderTempFilesRemoved(tempRoot, capturedPath) {
  if (capturedPath) assert.equal(fs.existsSync(capturedPath), false);
  assert.deepEqual(fs.readdirSync(tempRoot), []);
}

function securityXmlSpawn(xml, onSecurityInvocation, onPythonInvocation) {
  return (command, args, options) => {
    if (command === "security") {
      onSecurityInvocation?.(args, options);
      return { status: 0, signal: null, stdout: Buffer.from(xml), stderr: Buffer.alloc(0) };
    }
    // The mocked security command supplies literal XML; run the parser itself with real Python.
    if (command === "python3") {
      onPythonInvocation?.(args, options);
      return realSpawnSync(command, args, options);
    }
    throw new Error("Unexpected subprocess in CMS fixture test.");
  };
}

test("decodes mocked CMS XML through real Python and removes its private temporary profile", () => {
  const tempRoot = makePrivateTempRoot();
  let capturedProfilePath;
  let pythonWasInvoked = false;
  try {
    const profile = decodeProvisioningProfile(CMS_INPUT, {
      platform: "darwin",
      tempRoot,
      spawn: securityXmlSpawn(
        PROFILE_XML,
        (args, options) => {
          assert.deepEqual(args.slice(0, 3), ["cms", "-D", "-i"]);
          capturedProfilePath = args[3];
          assert.equal(fs.existsSync(capturedProfilePath), true);
          assert.equal(fs.statSync(capturedProfilePath).mode & 0o777, 0o600);
          assert.equal(fs.statSync(path.dirname(capturedProfilePath)).mode & 0o777, 0o700);
          assert.equal(options.encoding, "buffer");
        },
        () => {
          pythonWasInvoked = true;
        },
      ),
    });

    assert.equal(pythonWasInvoked, true);
    assert.deepEqual(profile, {
      ExpirationDate: "2027-03-04T05:06:07Z",
      CreationDate: "2026-01-02T03:04:05Z",
      DeveloperCertificates: [PROFILE_CERTIFICATE],
    });
    assertDecoderTempFilesRemoved(tempRoot, capturedProfilePath);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("sanitizes CMS and plist parse failures and cleans temporary profile files", () => {
  for (const fixture of [
    {
      label: "CMS failure",
      stage: "CMS_DECODE",
      spawn: (secret) => (command) => {
        if (command === "security") {
          return {
            error: new Error(secret),
            status: 1,
            signal: null,
            stdout: Buffer.from(secret),
            stderr: Buffer.from(secret),
          };
        }
        throw new Error(secret);
      },
    },
    {
      label: "plist parse failure",
      stage: "PLIST_PARSE",
      spawn: (secret) => securityXmlSpawn(`<plist>${secret}`, () => {}),
    },
  ]) {
    const tempRoot = makePrivateTempRoot();
    const secret = `private-${fixture.label}-details`;
    let capturedProfilePath;
    let pythonWasInvoked = false;
    try {
      const spawn = fixture.spawn(secret);
      const wrappedSpawn = (command, args, options) => {
        if (command === "security" && args[0] === "cms") {
          capturedProfilePath = args[3];
        }
        if (command === "python3") pythonWasInvoked = true;
        return spawn(command, args, options);
      };

      let thrown;
      try {
        decodeProvisioningProfile(CMS_INPUT, {
          platform: "darwin",
          tempRoot,
          spawn: wrappedSpawn,
        });
      } catch (error) {
        thrown = error;
      }

      assert.ok(thrown instanceof Error, fixture.label);
      assert.equal(thrown.diagnostic, GENERIC_FAILURE);
      assert.equal(thrown.stage, fixture.stage);
      assert.equal(thrown.message, GENERIC_FAILURE);
      assert.equal(thrown.message.includes(secret), false);
      assert.equal(String(thrown.stack).includes(secret), false);
      assert.equal(pythonWasInvoked, fixture.label === "plist parse failure");
      assertDecoderTempFilesRemoved(tempRoot, capturedProfilePath);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }
});

test(
  "Darwin security cms and Python decode a generated self-signed synthetic profile",
  { skip: process.platform !== "darwin" },
  () => {
    // This self-signed CMS is only a codec smoke test, not Apple trust or entitlement approval.
    const tempRoot = makePrivateTempRoot();
    try {
      const xmlPath = path.join(tempRoot, "synthetic-profile.plist");
      const keyPath = path.join(tempRoot, "throwaway-key.pem");
      const certificatePath = path.join(tempRoot, "throwaway-certificate.pem");
      const cmsPath = path.join(tempRoot, "synthetic-profile.mobileprovision");
      fs.writeFileSync(xmlPath, PROFILE_XML, { mode: 0o600, flag: "wx" });

      const generateCertificate = realSpawnSync(
        "openssl",
        [
          "req",
          "-x509",
          "-newkey",
          "rsa:2048",
          "-nodes",
          "-keyout",
          keyPath,
          "-out",
          certificatePath,
          "-subj",
          "/CN=met-synthetic-codec-test",
          "-days",
          "1",
        ],
        { encoding: "buffer", timeout: 30_000, maxBuffer: 1024 * 1024, windowsHide: true },
      );
      assert.equal(generateCertificate.error, undefined);
      assert.equal(generateCertificate.status, 0);
      fs.chmodSync(keyPath, 0o600);
      fs.chmodSync(certificatePath, 0o600);

      const signProfile = realSpawnSync(
        "openssl",
        [
          "cms",
          "-sign",
          "-binary",
          "-nodetach",
          "-in",
          xmlPath,
          "-signer",
          certificatePath,
          "-inkey",
          keyPath,
          "-outform",
          "DER",
          "-out",
          cmsPath,
        ],
        { encoding: "buffer", timeout: 30_000, maxBuffer: 1024 * 1024, windowsHide: true },
      );
      assert.equal(signProfile.error, undefined);
      assert.equal(signProfile.status, 0);
      fs.chmodSync(cmsPath, 0o600);

      const decoded = decodeProvisioningProfile(fs.readFileSync(cmsPath).toString("base64"), {
        platform: "darwin",
        tempRoot,
      });
      assert.equal(decoded.ExpirationDate, "2027-03-04T05:06:07Z");
      assert.equal(decoded.CreationDate, "2026-01-02T03:04:05Z");
      assert.deepEqual(decoded.DeveloperCertificates, [PROFILE_CERTIFICATE]);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  },
);