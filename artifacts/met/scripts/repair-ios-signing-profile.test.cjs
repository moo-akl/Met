"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repair = require("./repair-ios-signing-profile.cjs");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const CONFIG = repair.readProjectConfiguration(PROJECT_ROOT);
const PROJECT = {
  accountId: "account-id",
  accountName: "moo-akl",
  projectFullName: "@moo-akl/met",
};
const APPLE_APP_IDENTIFIER_ID = "apple-app-identifier-record";
const PROFILE_RESOURCE_ID = "opaque-apple-profile-resource-id";
const PROFILE_UUID = "f3d8e9a1-06a7-4cb3-8e60-2f1d5a7b9c41";
const NEW_PROFILE_EXPIRATION = "2031-01-01T00:00:00.000Z";
const DEVICE_A = "00008030-0000000000000001";
const DEVICE_B = "00008030-0000000000000002";
const CERTIFICATE_BYTES = Buffer.from("offline-test-certificate-der");
const CERTIFICATE_CONTENT = CERTIFICATE_BYTES.toString("base64");

function credentialsData(overrides = {}) {
  const profile = {
    id: "eas-profile-record",
    developerPortalIdentifier: "old-apple-profile-id",
    expiration: "2030-01-01T00:00:00.000Z",
    appleTeam: {
      id: "eas-team",
      appleTeamIdentifier: CONFIG.teamIdentifier,
    },
    appleDevices: [
      { id: "eas-device-a", identifier: DEVICE_A },
      { id: "eas-device-b", identifier: DEVICE_B },
    ],
    ...overrides.profile,
  };
  const certificate = {
    id: "eas-certificate-record",
    developerPortalIdentifier: "apple-certificate-id",
    serialNumber: "A1B2C3D4",
    appleTeam: {
      id: "eas-team",
      appleTeamIdentifier: CONFIG.teamIdentifier,
    },
    ...overrides.certificate,
  };
  return {
    app: {
      byFullName: {
        id: CONFIG.projectId,
        slug: "met",
        ownerAccount: { id: "account-id", name: "moo-akl" },
        iosAppCredentials: [
          {
            id: "eas-app-credentials",
            iosAppBuildCredentialsList: [
              {
                id: "eas-build-credentials",
                iosDistributionType: "AD_HOC",
                distributionCertificate: certificate,
                provisioningProfile: profile,
                ...overrides.buildCredential,
              },
              ...(overrides.additionalBuildCredentials || []),
            ],
            ...overrides.appCredentials,
          },
          ...(overrides.additionalAppCredentials || []),
        ],
      },
    },
  };
}

function ascProfileResource(overrides = {}) {
  return {
    type: "profiles",
    id: PROFILE_RESOURCE_ID,
    attributes: {
      name: `${repair.PROFILE_NAME_PREFIX}test-unique`,
      profileType: "IOS_APP_ADHOC",
      profileState: "ACTIVE",
      uuid: PROFILE_UUID,
      expirationDate: "2030-01-01T00:00:00.000Z",
      profileContent: Buffer.from("fake-mobileprovision").toString("base64"),
      ...overrides.attributes,
    },
    relationships: {
      bundleId: { data: { type: "bundleIds", id: "asc-bundle-id" } },
      certificates: {
        data: [{ type: "certificates", id: "apple-certificate-id" }],
      },
      devices: {
        data: [
          { type: "devices", id: "asc-device-a" },
          { type: "devices", id: "asc-device-b" },
        ],
      },
      ...overrides.relationships,
    },
    ...overrides.resource,
  };
}

function embeddedProfile(overrides = {}) {
  return {
    ApplicationIdentifierPrefix: [CONFIG.teamIdentifier],
    TeamIdentifier: [CONFIG.teamIdentifier],
    Entitlements: {
      "application-identifier": `${CONFIG.teamIdentifier}.${CONFIG.bundleIdentifier}`,
      "com.apple.developer.team-identifier": CONFIG.teamIdentifier,
      "aps-environment": "production",
      "com.apple.developer.associated-domains": [...CONFIG.associatedDomains],
    },
    Name: `${repair.PROFILE_NAME_PREFIX}test-unique`,
    UUID: PROFILE_UUID,
    ExpirationDate: "2030-01-01T00:00:00.000Z",
    DeveloperCertificates: [CERTIFICATE_CONTENT],
    ProvisionedDevices: [DEVICE_A, DEVICE_B],
    ...overrides,
  };
}

function gqlResponse(data) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  };
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

test("default arguments are read-only and --apply is the only write gate", () => {
  assert.deepEqual(repair.parseArguments([]), { apply: false });
  assert.deepEqual(repair.parseArguments(["--apply"]), { apply: true });
  assert.deepEqual(repair.parseArguments(["--diagnose"]), {
    apply: false,
    diagnose: true,
  });
  assert.deepEqual(repair.parseArguments(["--apply", "--reuse-repair-profile"]), {
    apply: true,
    reuseRepairProfile: true,
  });
  for (const args of [
    ["--force"],
    ["--apply", "--apply"],
    ["--apply", "--yes"],
    ["--inspect"],
    ["--diagnose", "--apply"],
    ["--reuse-repair-profile"],
    ["--apply", "--reuse-repair-profile", "--force"],
  ]) {
    assert.throws(
      () => repair.parseArguments(args),
      (error) => error.diagnostic === "FAILED_INVALID_ARGUMENTS",
    );
  }
});

test("repair candidate freshness requires a canonical ISO timestamp and UUID within six hours", () => {
  const nowMs = Date.parse("2025-01-01T00:00:00.000Z");
  const candidate = (name, type = "profiles") => ({
    type,
    id: "candidate-id",
    attributes: { name, profileType: "IOS_APP_ADHOC" },
  });
  const validName = `${repair.PROFILE_NAME_PREFIX}2024-12-31T23:00:00.000Z f3d8e9a1-06a7-4cb3-8e60-2f1d5a7b9c41`;
  const resources = [
    candidate(validName),
    candidate(`${repair.PROFILE_NAME_PREFIX}2024-12-31T17:59:59.999Z f3d8e9a1-06a7-4cb3-8e60-2f1d5a7b9c41`),
    candidate(`${repair.PROFILE_NAME_PREFIX}2025-01-01T00:00:01.000Z f3d8e9a1-06a7-4cb3-8e60-2f1d5a7b9c41`),
    candidate(`${repair.PROFILE_NAME_PREFIX}not-a-date f3d8e9a1-06a7-4cb3-8e60-2f1d5a7b9c41`),
    candidate(`${repair.PROFILE_NAME_PREFIX}2024-12-31T23:00:00.000Z not-a-uuid`),
    candidate("another-profile"),
  ];
  assert.deepEqual(
    repair.freshRepairCandidates(resources, nowMs).map((resource) => resource.id),
    ["candidate-id"],
  );
});

test("project config confirms the static bundle, project UUID, and internal preview target", () => {
  assert.equal(CONFIG.bundleIdentifier, "app.met.founders");
  assert.equal(CONFIG.projectId, "f9d35bdb-e890-408f-b9d9-4ca36cbeae23");
  assert.equal(CONFIG.teamIdentifier, "AWHU9BTQQX");
  assert.deepEqual(CONFIG.associatedDomains, ["applinks:metapp.replit.app"]);
  assert.throws(
    () =>
      repair.validateProject(
        {
          id: "different-project",
          fullName: "@moo-akl/met",
          slug: "met",
          ownerAccount: { name: "moo-akl" },
        },
        CONFIG,
      ),
    (error) => error.diagnostic === "FAILED_VALIDATION",
  );
});

test("apply gates require macOS, all API credentials, and a private key file", () => {
  const env = {
    EXPO_TOKEN: "offline-eas-token",
    EXPO_ASC_API_KEY_PATH: "/private/AuthKey.p8",
    EXPO_ASC_KEY_ID: "KEYID12345",
    EXPO_ASC_ISSUER_ID: "issuer-id",
  };
  const privateRegularFile = {
    isFile: true,
    isSymbolicLink: false,
    mode: 0o100600,
  };

  assert.doesNotThrow(() =>
    repair.validateApplyEnvironment(env, "darwin", privateRegularFile),
  );
  assert.throws(
    () => repair.validateApplyEnvironment(env, "linux", privateRegularFile),
    (error) => error.diagnostic === "FAILED_PLATFORM",
  );
  assert.throws(
    () =>
      repair.validateApplyEnvironment(
        { ...env, EXPO_ASC_KEY_ID: "" },
        "darwin",
        privateRegularFile,
      ),
    (error) => error.diagnostic === "FAILED_AUTH",
  );
  for (const unsafeStat of [
    { isFile: false, isSymbolicLink: false, mode: 0o100600 },
    { isFile: true, isSymbolicLink: true, mode: 0o100600 },
    { isFile: true, isSymbolicLink: false, mode: 0o100644 },
  ]) {
    assert.throws(
      () => repair.validateApplyEnvironment(env, "darwin", unsafeStat),
      (error) => error.diagnostic === "FAILED_AUTH",
    );
  }
});

test("ASC JWT signing uses ES256 and keeps tokens private to request code", () => {
  const { privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const token = repair.createAscJwt({
    keyId: "offline-key-id",
    issuerId: "offline-issuer-id",
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    nowSeconds: 1_700_000_000,
  });
  const [header, payload, signature] = token.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString()), {
    alg: "ES256",
    kid: "offline-key-id",
    typ: "JWT",
  });
  assert.deepEqual(JSON.parse(Buffer.from(payload, "base64url").toString()), {
    iss: "offline-issuer-id",
    iat: 1_700_000_000,
    exp: 1_700_000_900,
    aud: "appstoreconnect-v1",
  });
  assert.equal(Buffer.from(signature, "base64url").length, 64);
});

test("read-only EAS queries use the pinned project ID, bundle, and AD_HOC credential filter", () => {
  assert.match(repair.APP_BY_ID_QUERY, /query AppByIdQuery/);
  assert.match(repair.APPLE_APP_IDENTIFIER_QUERY, /query AppleAppIdentifierByBundleIdQuery/);
  assert.match(repair.IOS_APP_CREDENTIALS_QUERY, /query IosAppCredentialsWithBuildCredentialsByAppIdentifierIdQuery/);
  assert.match(repair.IOS_APP_CREDENTIALS_QUERY, /iosDistributionType/);
  assert.match(repair.UPDATE_EXISTING_PROFILE_MUTATION, /updateAppleProvisioningProfile/);
  assert.doesNotMatch(
    repair.UPDATE_EXISTING_PROFILE_MUTATION,
    /deleteAppleProvisioningProfile|setProvisioningProfile|setDistributionCertificate|createIosAppBuildCredentials/,
  );
});

test("credential validation refuses missing and ambiguous matching credentials", () => {
  const valid = credentialsData();
  const snapshot = repair.validateCredentialSnapshot(valid, {
    config: CONFIG,
    project: PROJECT,
    appleAppIdentifierId: APPLE_APP_IDENTIFIER_ID,
  });
  assert.equal(snapshot.profileId, "eas-profile-record");
  assert.equal(snapshot.appleAppIdentifierId, APPLE_APP_IDENTIFIER_ID);
  assert.equal(snapshot.certificateId, "eas-certificate-record");
  assert.deepEqual(snapshot.deviceIds, ["eas-device-a", "eas-device-b"]);
  assert.deepEqual(snapshot.deviceUdids, [DEVICE_A, DEVICE_B]);

  const cases = [
    {
      data: { app: { byFullName: { id: CONFIG.projectId, iosAppCredentials: [] } } },
      diagnostic: "FAILED_VALIDATION",
    },
    {
      data: credentialsData({ additionalAppCredentials: [{ id: "another-app", iosAppBuildCredentialsList: [] }] }),
      diagnostic: "FAILED_AMBIGUOUS",
    },
    {
      data: credentialsData({ additionalBuildCredentials: [{ id: "second", iosDistributionType: "AD_HOC" }] }),
      diagnostic: "FAILED_AMBIGUOUS",
    },
    {
      data: credentialsData({ buildCredential: { iosDistributionType: "APP_STORE" } }),
      diagnostic: "FAILED_VALIDATION",
    },
    {
      data: credentialsData({ profile: { appleDevices: [{ id: "same", identifier: DEVICE_A }, { id: "same", identifier: DEVICE_B }] } }),
      diagnostic: "FAILED_VALIDATION",
    },
    {
      data: credentialsData({ profile: { appleDevices: [{ id: "device-a", identifier: DEVICE_A }, { id: "device-b", identifier: DEVICE_A }] } }),
      diagnostic: "FAILED_VALIDATION",
    },
    {
      data: credentialsData({ certificate: { appleTeam: { appleTeamIdentifier: "OTHERTEAM1" } } }),
      diagnostic: "FAILED_VALIDATION",
    },
  ];

  for (const item of cases) {
    assert.throws(
      () =>
        repair.validateCredentialSnapshot(item.data, {
          config: CONFIG,
          project: PROJECT,
          appleAppIdentifierId: APPLE_APP_IDENTIFIER_ID,
        }),
      (error) => error.diagnostic === item.diagnostic,
    );
  }
});

test("Apple Ad Hoc profile request is create-only and binds the existing certificate and devices", () => {
  const body = repair.buildAscProfilePayload({
    name: `${repair.PROFILE_NAME_PREFIX}test-unique`,
    bundleId: "asc-bundle-id",
    certificateId: "apple-certificate-id",
    deviceIds: ["asc-device-b", "asc-device-a"],
  });
  assert.deepEqual(body, {
    data: {
      type: "profiles",
      attributes: {
        name: `${repair.PROFILE_NAME_PREFIX}test-unique`,
        profileType: "IOS_APP_ADHOC",
      },
      relationships: {
        bundleId: { data: { type: "bundleIds", id: "asc-bundle-id" } },
        certificates: {
          data: [{ type: "certificates", id: "apple-certificate-id" }],
        },
        devices: {
          data: [
            { type: "devices", id: "asc-device-a" },
            { type: "devices", id: "asc-device-b" },
          ],
        },
      },
    },
  });
  assert.equal(body.data.relationships.certificates.data.length, 1);
  assert.throws(
    () =>
      repair.buildAscProfilePayload({
        name: "not-unique-or-namespaced",
        bundleId: "asc-bundle-id",
        certificateId: "apple-certificate-id",
        deviceIds: ["asc-device-a"],
      }),
    (error) => error.diagnostic === "FAILED_VALIDATION",
  );
  assert.throws(
    () =>
      repair.buildAscProfilePayload({
        name: `${repair.PROFILE_NAME_PREFIX}test`,
        bundleId: "asc-bundle-id",
        certificateId: "apple-certificate-id",
        deviceIds: ["duplicate", "duplicate"],
      }),
    (error) => error.diagnostic === "FAILED_VALIDATION",
  );
  assert.throws(
    () =>
      repair.buildAscProfilePayload({
        name: `${repair.PROFILE_NAME_PREFIX}test`,
        bundleId: "asc-bundle-id",
        certificateId: "apple-certificate-id",
        deviceIds: [],
      }),
    (error) => error.diagnostic === "FAILED_VALIDATION",
  );
});

test("Apple profile response validation rejects wrong certificate, bundle, device, type, or state", () => {
  const expected = {
    name: `${repair.PROFILE_NAME_PREFIX}test-unique`,
    bundleId: "asc-bundle-id",
    certificateId: "apple-certificate-id",
    deviceIds: ["asc-device-a", "asc-device-b"],
  };
  const valid = ascProfileResource();
  const validated = repair.validateAscProfileResource(valid, expected);
  assert.equal(validated.id, PROFILE_RESOURCE_ID);
  assert.equal(validated.profileUUID, PROFILE_UUID);

  const unsafeProfiles = [
    ascProfileResource({
      relationships: {
        certificates: { data: [{ type: "certificates", id: "different-cert" }] },
      },
    }),
    ascProfileResource({
      relationships: {
        bundleId: { data: [{ type: "bundleIds", id: "different-bundle" }] },
      },
    }),
    ascProfileResource({
      relationships: {
        devices: { data: [{ type: "devices", id: "unexpected-device" }] },
      },
    }),
    ascProfileResource({ attributes: { profileType: "IOS_APP_STORE" } }),
    ascProfileResource({ attributes: { profileState: "INVALID" } }),
    ascProfileResource({ attributes: { uuid: "not-a-uuid" } }),
  ];
  for (const profile of unsafeProfiles) {
    assert.throws(
      () => repair.validateAscProfileResource(profile, expected),
      (error) => error.diagnostic === "FAILED_VALIDATION",
    );
  }
});

test("the existing Apple profile must still be Ad Hoc and match the same bundle, certificate, and devices", () => {
  const expected = {
    profileId: "old-apple-profile-id",
    bundleId: "asc-bundle-id",
    certificateId: "apple-certificate-id",
    deviceIds: ["asc-device-a", "asc-device-b"],
  };
  const existing = {
    type: "profiles",
    id: "old-apple-profile-id",
    attributes: { profileType: "IOS_APP_ADHOC" },
    relationships: {
      bundleId: { data: { type: "bundleIds", id: "asc-bundle-id" } },
      certificates: {
        data: [{ type: "certificates", id: "apple-certificate-id" }],
      },
      devices: {
        data: [
          { type: "devices", id: "asc-device-a" },
          { type: "devices", id: "asc-device-b" },
        ],
      },
    },
  };
  assert.doesNotThrow(() =>
    repair.validateExistingAscProfileResource(existing, expected),
  );
  const unsafeProfiles = [
    { ...existing, id: "different-profile-id" },
    {
      ...existing,
      attributes: { profileType: "IOS_APP_STORE" },
    },
    {
      ...existing,
      relationships: {
        ...existing.relationships,
        certificates: {
          data: [{ type: "certificates", id: "different-certificate" }],
        },
      },
    },
    {
      ...existing,
      relationships: {
        ...existing.relationships,
        certificates: {
          data: [
            { type: "certificates", id: "apple-certificate-id" },
            { type: "certificates", id: "another-certificate" },
          ],
        },
      },
    },
    {
      ...existing,
      relationships: {
        ...existing.relationships,
        devices: {
          data: [{ type: "devices", id: "unexpected-device" }],
        },
      },
    },
  ];
  for (const profile of unsafeProfiles) {
    assert.throws(
      () => repair.validateExistingAscProfileResource(profile, expected),
      (error) => error.diagnostic === "FAILED_VALIDATION",
    );
  }
});

test("only the existing EAS profile row is updated; build and certificate associations are not reassigned", () => {
  const snapshot = repair.validateCredentialSnapshot(credentialsData(), {
    config: CONFIG,
    project: PROJECT,
    appleAppIdentifierId: APPLE_APP_IDENTIFIER_ID,
  });
  const update = repair.buildEasProfileUpdateRequest(snapshot, {
    id: PROFILE_RESOURCE_ID,
    profileContent: "private-profile-payload",
  });
  assert.deepEqual(update.variables, {
    appleProvisioningProfileId: "eas-profile-record",
    appleProvisioningProfileInput: {
      appleProvisioningProfile: "private-profile-payload",
      developerPortalIdentifier: PROFILE_RESOURCE_ID,
    },
  });
  assert.match(update.query, /updateAppleProvisioningProfile/);
  assert.doesNotMatch(
    update.query,
    /deleteAppleProvisioningProfile|setProvisioningProfile|setDistributionCertificate/,
  );
  assert.deepEqual(
    Object.keys(update.variables.appleProvisioningProfileInput).sort(),
    ["appleProvisioningProfile", "developerPortalIdentifier"],
  );
});

test("pre-update snapshot comparison detects every relevant EAS association change", () => {
  const snapshot = repair.validateCredentialSnapshot(credentialsData(), {
    config: CONFIG,
    project: PROJECT,
    appleAppIdentifierId: APPLE_APP_IDENTIFIER_ID,
  });
  assert.doesNotThrow(() =>
    repair.assertCredentialSnapshotUnchanged(snapshot, { ...snapshot }),
  );

  const changedFields = [
    { projectId: "another-project" },
    { accountId: "another-account" },
    { projectFullName: "@another-owner/met" },
    { appleAppIdentifierId: "another-app-identifier" },
    { appCredentialsId: "another-app-credentials" },
    { buildCredentialsId: "another-build-credentials" },
    { certificateId: "another-certificate-record" },
    { certificatePortalId: "another-apple-certificate" },
    { certificateSerialNumber: "DIFFERENT-SERIAL" },
    { certificateTeam: "OTHERTEAM1" },
    { certificateTeamId: "another-team-record" },
    { profileId: "another-profile-record" },
    { oldProfilePortalId: "another-apple-profile" },
    { profileExpiration: "changed-expiration" },
    { profileTeamId: "another-profile-team-record" },
    { profileTeam: "OTHERTEAM1" },
    { deviceIds: ["another-device-record"] },
    { deviceUdids: ["00008030-0000000000000099"] },
  ];
  for (const change of changedFields) {
    assert.throws(
      () =>
        repair.assertCredentialSnapshotUnchanged(snapshot, {
          ...snapshot,
          ...change,
        }),
      (error) => error.diagnostic === "FAILED_VALIDATION",
    );
  }
  assert.throws(
    () => repair.assertCredentialSnapshotUnchanged(snapshot, {
      ...snapshot,
      buildCredentialsId: undefined,
    }),
    (error) => error.diagnostic === "FAILED_VALIDATION",
  );
});

test("timestamp normalization compares equivalent ASC/EAS expiration representations", () => {
  const milliseconds = Date.parse(NEW_PROFILE_EXPIRATION);
  assert.equal(repair.normalizeTimestamp(NEW_PROFILE_EXPIRATION), milliseconds);
  assert.equal(repair.normalizeTimestamp(milliseconds), milliseconds);
  assert.equal(repair.normalizeTimestamp(milliseconds / 1000), milliseconds);
  assert.throws(
    () => repair.normalizeTimestamp("not-a-date"),
    (error) => error.diagnostic === "FAILED_VALIDATION",
  );
});

test("embedded CMS plist validation requires push, app links, team, exact devices, cert, and future expiry", () => {
  const expected = {
    teamIdentifier: CONFIG.teamIdentifier,
    bundleIdentifier: CONFIG.bundleIdentifier,
    associatedDomains: CONFIG.associatedDomains,
    name: `${repair.PROFILE_NAME_PREFIX}test-unique`,
    profileUUID: PROFILE_UUID,
    deviceUdids: [DEVICE_A, DEVICE_B],
    certificateContent: CERTIFICATE_BYTES,
    expirationDate: "2030-01-01T00:00:00.000Z",
    nowMs: Date.parse("2025-01-01T00:00:00.000Z"),
  };
  assert.doesNotThrow(() => repair.validateEmbeddedProfile(embeddedProfile(), expected));
  assert.doesNotThrow(() =>
    repair.validateEmbeddedProfile(
      embeddedProfile({ UUID: PROFILE_UUID.toUpperCase() }),
      expected,
    ),
  );
  assert.doesNotThrow(() =>
    repair.validateEmbeddedProfile(
      embeddedProfile({
        Entitlements: {
          ...embeddedProfile().Entitlements,
          "com.apple.developer.associated-domains": ["*"],
        },
      }),
      expected,
    ),
  );
  assert.doesNotThrow(() =>
    repair.validateEmbeddedProfile(
      embeddedProfile({
        ApplicationIdentifierPrefix: ["LEGACY0001"],
        Entitlements: {
          ...embeddedProfile().Entitlements,
          "application-identifier": `LEGACY0001.${CONFIG.bundleIdentifier}`,
        },
      }),
      expected,
    ),
  );

  const missingDomains = embeddedProfile();
  delete missingDomains.Entitlements["com.apple.developer.associated-domains"];
  const unsafeProfiles = [
    embeddedProfile({ Entitlements: { ...embeddedProfile().Entitlements, "aps-environment": "development" } }),
    embeddedProfile({
      Entitlements: {
        ...embeddedProfile().Entitlements,
        "com.apple.developer.associated-domains": [],
      },
    }),
    embeddedProfile({
      Entitlements: {
        ...embeddedProfile().Entitlements,
        "com.apple.developer.associated-domains": ["applinks:other.example"],
      },
    }),
    missingDomains,
    embeddedProfile({ TeamIdentifier: ["OTHERTEAM1"] }),
    embeddedProfile({ ProvisionedDevices: [DEVICE_A] }),
    embeddedProfile({ DeveloperCertificates: [Buffer.from("different-cert").toString("base64")] }),
    embeddedProfile({ ExpirationDate: "2024-01-01T00:00:00.000Z" }),
    embeddedProfile({ Entitlements: { ...embeddedProfile().Entitlements, "application-identifier": "wrong.bundle" } }),
    embeddedProfile({ DeveloperCertificates: [] }),
  ];
  for (const profile of unsafeProfiles) {
    assert.throws(
      () => repair.validateEmbeddedProfile(profile, expected),
      (error) => error.diagnostic === "FAILED_VALIDATION",
    );
  }
});

test("embedded invariant summaries identify each mismatch using only fixed enums and counts", () => {
  const expected = {
    teamIdentifier: "PRIVATE_TEAM_VALUE",
    bundleIdentifier: "PRIVATE_BUNDLE_VALUE",
    associatedDomains: ["PRIVATE_ASSOCIATED_DOMAIN"],
    name: "PRIVATE_PROFILE_NAME",
    profileUUID: PROFILE_UUID,
    deviceUdids: ["PRIVATE_DEVICE_ONE", "PRIVATE_DEVICE_TWO"],
    certificateContent: Buffer.from("PRIVATE_CERTIFICATE_DER").toString("base64"),
    expirationDate: "2035-01-01T00:00:00.000Z",
    nowMs: Date.parse("2025-01-01T00:00:00.000Z"),
  };
  const validProfile = {
    ApplicationIdentifierPrefix: [expected.teamIdentifier],
    TeamIdentifier: [expected.teamIdentifier],
    Entitlements: {
      "application-identifier": `${expected.teamIdentifier}.${expected.bundleIdentifier}`,
      "com.apple.developer.team-identifier": expected.teamIdentifier,
      "aps-environment": "production",
      "com.apple.developer.associated-domains": [
        ...expected.associatedDomains,
      ],
    },
    Name: expected.name,
    UUID: expected.profileUUID,
    ExpirationDate: expected.expirationDate,
    DeveloperCertificates: [expected.certificateContent],
    ProvisionedDevices: [...expected.deviceUdids],
  };
  const summarize = (profile, overrides = {}) =>
    repair.summarizeEmbeddedProfileInvariants(profile, {
      ...expected,
      ...overrides,
    });
  const baseline = summarize(validProfile);
  for (const key of [
    "applicationPrefixValid",
    "applicationIdentifierMatches",
    "teamIdentifiersIncludeExpected",
    "teamEntitlementMatches",
    "productionPush",
    "associatedDomainsAuthorized",
    "nameMatches",
    "uuidMatches",
    "certificateDERMatches",
    "devicesExact",
    "expirationFuture",
    "expirationMatchesAsc",
  ]) {
    assert.equal(baseline[key], "PASS", key);
  }
  assert.equal(baseline.associatedDomainsKind, "ARRAY_DOMAINS");
  assert.equal(baseline.certificateCount, 1);
  assert.equal(baseline.deviceCount, 2);
  assert.equal(baseline.expectedDeviceCount, 2);

  const withProfile = (edit) => {
    const profile = structuredClone(validProfile);
    edit(profile);
    return profile;
  };
  const failures = [
    ["applicationPrefixValid", withProfile((profile) => { profile.ApplicationIdentifierPrefix = [""]; })],
    ["applicationIdentifierMatches", withProfile((profile) => { profile.Entitlements["application-identifier"] = "wrong"; })],
    ["teamIdentifiersIncludeExpected", withProfile((profile) => { profile.TeamIdentifier = ["OTHER"]; })],
    ["teamEntitlementMatches", withProfile((profile) => { profile.Entitlements["com.apple.developer.team-identifier"] = "OTHER"; })],
    ["productionPush", withProfile((profile) => { profile.Entitlements["aps-environment"] = "development"; })],
    ["associatedDomainsAuthorized", withProfile((profile) => { profile.Entitlements["com.apple.developer.associated-domains"] = ["PRIVATE_OTHER_DOMAIN"]; })],
    ["nameMatches", withProfile((profile) => { profile.Name = "OTHER_PRIVATE_NAME"; })],
    ["uuidMatches", withProfile((profile) => { profile.UUID = "not-a-uuid"; })],
    ["certificateDERMatches", withProfile((profile) => { profile.DeveloperCertificates = [Buffer.from("OTHER_PRIVATE_CERT").toString("base64")]; })],
    ["devicesExact", withProfile((profile) => { profile.ProvisionedDevices = ["PRIVATE_DEVICE_ONE"]; })],
    ["expirationFuture", withProfile((profile) => { profile.ExpirationDate = "2020-01-01T00:00:00.000Z"; })],
  ];
  for (const [field, profile] of failures) {
    assert.equal(summarize(profile)[field], "FAIL", field);
  }
  assert.equal(summarize(withProfile((profile) => {
    profile.ApplicationIdentifierPrefix = [];
    profile.DeveloperCertificates = [];
  })).certificateCount, 0);
  assert.equal(
    summarize(
      withProfile((profile) => {
        profile.ExpirationDate = "2036-01-01T00:00:00.000Z";
      }),
    ).expirationMatchesAsc,
    "FAIL",
  );

  const stringWildcard = withProfile((profile) => {
    profile.Entitlements["com.apple.developer.associated-domains"] = "*";
  });
  assert.equal(summarize(stringWildcard).associatedDomainsKind, "STRING_WILDCARD");
  assert.equal(summarize(stringWildcard).associatedDomainsAuthorized, "FAIL");
  const absentDomains = withProfile((profile) => {
    delete profile.Entitlements["com.apple.developer.associated-domains"];
  });
  assert.equal(summarize(absentDomains).associatedDomainsKind, "MISSING");
  const invalidDomains = withProfile((profile) => {
    profile.Entitlements["com.apple.developer.associated-domains"] = { grant: "*" };
  });
  assert.equal(summarize(invalidDomains).associatedDomainsKind, "INVALID");
  const arrayWildcard = withProfile((profile) => {
    profile.Entitlements["com.apple.developer.associated-domains"] = ["*"];
  });
  assert.equal(summarize(arrayWildcard).associatedDomainsKind, "ARRAY_WILDCARD");
  assert.equal(summarize(arrayWildcard).associatedDomainsAuthorized, "PASS");

  const rendered = repair.formatCandidateInvariantResult(1, baseline);
  const combined = `${JSON.stringify(baseline)} ${rendered}`;
  for (const privateValue of [
    expected.teamIdentifier,
    expected.bundleIdentifier,
    expected.associatedDomains[0],
    expected.name,
    expected.profileUUID,
    expected.deviceUdids[0],
    expected.deviceUdids[1],
    expected.certificateContent,
    expected.expirationDate,
  ]) {
    assert.equal(combined.includes(privateValue), false, privateValue);
  }
  assert.match(rendered, /^CANDIDATE_INVARIANT INDEX=1 APP_PREFIX=PASS APP_ID=PASS/);
  assert.match(rendered, /ASSOCIATED_DOMAINS_KIND=ARRAY_DOMAINS/);
  assert.match(rendered, /CERT_COUNT=1 CERT_DER=PASS DEVICE_COUNT=2 EXPECTED_DEVICE_COUNT=2 DEVICES_EXACT=PASS/);
});

test("Apple request construction pins the HTTPS host and never follows redirects", async () => {
  let calls = 0;
  const request = repair.createAscRequest({
    token: "offline-asc-token",
    fetchImpl: async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: [] }),
      };
    },
  });
  await assert.rejects(
    () => request("GET", "https://attacker.example/v1/devices"),
    (error) => error.diagnostic === "FAILED_API",
  );
  await assert.rejects(
    () => request("GET", "http://api.appstoreconnect.apple.com/v1/devices"),
    (error) => error.diagnostic === "FAILED_API",
  );
  assert.equal(calls, 0);

  const safeRequest = repair.createAscRequest({
    token: "offline-asc-token",
    fetchImpl: async (_url, options) => {
      calls += 1;
      assert.equal(options.redirect, "error");
      assert.match(options.headers.authorization, /^Bearer /);
      return {
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ errors: [{ detail: "must not be surfaced" }] }),
      };
    },
  });
  await assert.rejects(
    () => safeRequest("POST", "profiles", {}),
    (error) =>
      error.diagnostic === "FAILED_API_PERMISSION" &&
      error.message === "FAILED_API_PERMISSION",
  );
  assert.equal(calls, 1);
  assert.equal(repair.buildCollectionPath("devices", { limit: "200" }), "/v1/devices?limit=200");
});

test("read-only default performs only EAS queries and does not require ASC secrets or macOS", async () => {
  const calls = [];
  const responseByOperation = {
    AppByIdQuery: {
      app: {
        byId: {
          id: CONFIG.projectId,
          fullName: "@moo-akl/met",
          slug: "met",
          ownerAccount: { id: "account-id", name: "moo-akl" },
        },
      },
    },
    AppleAppIdentifierByBundleIdQuery: {
      account: {
        byName: {
          id: "account-id",
          appleAppIdentifiers: [
            {
              id: APPLE_APP_IDENTIFIER_ID,
              bundleIdentifier: CONFIG.bundleIdentifier,
            },
          ],
        },
      },
    },
    IosAppCredentialsWithBuildCredentialsByAppIdentifierIdQuery: credentialsData(),
  };
  const result = await repair.runRepair({
    args: [],
    env: { EXPO_TOKEN: "offline-eas-token" },
    platform: "linux",
    projectRoot: PROJECT_ROOT,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      const operation = Object.keys(responseByOperation).find((name) =>
        options.body.includes(name),
      );
      assert.ok(operation);
      return gqlResponse(responseByOperation[operation]);
    },
  });
  assert.deepEqual(result, { diagnostic: "INSPECT_ONLY" });
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.url, repair.EAS_GRAPHQL_URL);
    assert.equal(call.options.method, "POST");
    assert.equal(call.options.redirect, "error");
    assert.doesNotMatch(call.options.body, /mutation|delete|setProvisioningProfile/i);
  }
});

test("apply without macOS or the configured key refuses before any network request", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      repair.runRepair({
        args: ["--apply"],
        env: {},
        platform: "linux",
        projectRoot: PROJECT_ROOT,
        fetchImpl: async () => {
          calls += 1;
          return gqlResponse({});
        },
      }),
    (error) => error.diagnostic === "FAILED_PLATFORM",
  );
  assert.equal(calls, 0);

  await assert.rejects(
    () =>
      repair.runRepair({
        args: ["--apply"],
        env: {},
        platform: "darwin",
        projectRoot: PROJECT_ROOT,
        fetchImpl: async () => {
          calls += 1;
          return gqlResponse({});
        },
      }),
    (error) => error.diagnostic === "FAILED_AUTH",
  );
  assert.equal(calls, 0);
});

test("EAS 401/403 and malformed responses are reported only as allowlisted diagnostics", async () => {
  const token = "offline-never-output-token";
  for (const [status, expected] of [
    [401, "FAILED_AUTH"],
    [403, "FAILED_API_PERMISSION"],
    [500, "FAILED_API"],
  ]) {
    const request = repair.createEasRequest(async () => ({
      ok: status < 400,
      status,
      text: async () => JSON.stringify({ detail: token }),
    }));
    await assert.rejects(
      () => request(repair.APP_BY_ID_QUERY, { appId: CONFIG.projectId }, token),
      (error) =>
        error.diagnostic === expected &&
        error.message === expected &&
        repair.DIAGNOSTICS.has(error.diagnostic),
    );
  }
});

test("post-update snapshot must retain the same EAS profile, certificate, and device records", () => {
  const snapshot = repair.validateCredentialSnapshot(credentialsData(), {
    config: CONFIG,
    project: PROJECT,
    appleAppIdentifierId: APPLE_APP_IDENTIFIER_ID,
  });
  assert.doesNotThrow(() =>
    repair.validateBuildCredentialsAfterUpdate(credentialsData({
      profile: {
        developerPortalIdentifier: PROFILE_RESOURCE_ID,
        expiration: NEW_PROFILE_EXPIRATION,
      },
    }), {
      config: CONFIG,
      project: PROJECT,
      snapshot,
      newProfileId: PROFILE_RESOURCE_ID,
      newProfileExpiration: NEW_PROFILE_EXPIRATION,
    }),
  );
  for (const change of [
    { profile: { id: "different-eas-profile" } },
    { certificate: { id: "different-eas-certificate" } },
    { profile: { appleDevices: [{ id: "different-device", identifier: DEVICE_A }] } },
    { profile: { expiration: "2030-01-01T00:00:00.000Z" } },
  ]) {
    assert.throws(
      () =>
        repair.validateBuildCredentialsAfterUpdate(
          credentialsData({
            ...change,
            profile: {
              developerPortalIdentifier: PROFILE_RESOURCE_ID,
              expiration: NEW_PROFILE_EXPIRATION,
              ...change.profile,
            },
          }),
          {
            config: CONFIG,
            project: PROJECT,
            snapshot,
            newProfileId: PROFILE_RESOURCE_ID,
            newProfileExpiration: NEW_PROFILE_EXPIRATION,
          },
        ),
      (error) => error.diagnostic === "FAILED_VALIDATION",
    );
  }
});

test("apply re-reads the complete EAS snapshot immediately before updating only the existing row", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ios-repair-test-"));
  const keyPath = path.join(directory, "offline-asc-key.p8");
  const { privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  fs.writeFileSync(
    keyPath,
    privateKey.export({ type: "pkcs8", format: "pem" }),
    { mode: 0o600 },
  );
  fs.chmodSync(keyPath, 0o600);

  const now = new Date("2025-01-01T00:00:00.000Z");
  function existingAppleProfile(profileId = "old-apple-profile-id") {
    return {
      type: "profiles",
      id: profileId,
      attributes: { profileType: "IOS_APP_ADHOC" },
      relationships: {
        bundleId: { data: { type: "bundleIds", id: "asc-bundle-id" } },
        certificates: {
          data: [{ type: "certificates", id: "apple-certificate-id" }],
        },
        devices: {
          data: [
            { type: "devices", id: "asc-device-a" },
            { type: "devices", id: "asc-device-b" },
          ],
        },
      },
    };
  }
  let createdName;

  async function runFakeApply({
    driftBeforeUpdate = false,
    args = ["--apply"],
    candidates = [],
    installedCandidate = false,
    decodeOverrides = {},
  } = {}) {
    const events = [];
    let credentialReadCount = 0;
    let mutationCount = 0;
    let profileCreateCount = 0;
    const selectedCandidate = candidates[0];
    const savedProfileId = installedCandidate
      ? selectedCandidate?.id
      : "old-apple-profile-id";
    const targetProfileId = selectedCandidate?.id || PROFILE_RESOURCE_ID;
    const targetProfileName =
      selectedCandidate?.attributes?.name ?? createdName;
    const targetProfileUuid =
      selectedCandidate?.attributes?.uuid ?? PROFILE_UUID;
    const targetProfileExpiration =
      selectedCandidate?.attributes?.expirationDate ?? NEW_PROFILE_EXPIRATION;
    const fetchImpl = async (input, options) => {
      const url = new URL(String(input));
      if (url.origin === new URL(repair.EAS_GRAPHQL_URL).origin) {
        const request = JSON.parse(options.body);
        if (request.query.includes("AppByIdQuery")) {
          events.push("eas:project");
          return gqlResponse({
            app: {
              byId: {
                id: CONFIG.projectId,
                slug: "met",
                ownerAccount: { id: "account-id", name: "moo-akl" },
              },
            },
          });
        }
        if (request.query.includes("AppleAppIdentifierByBundleIdQuery")) {
          events.push("eas:identifier");
          return gqlResponse({
            account: {
              byName: {
                id: "account-id",
                appleAppIdentifiers: [
                  {
                    id: APPLE_APP_IDENTIFIER_ID,
                    bundleIdentifier: CONFIG.bundleIdentifier,
                  },
                ],
              },
            },
          });
        }
        if (
          request.query.includes(
            "IosAppCredentialsWithBuildCredentialsByAppIdentifierIdQuery",
          )
        ) {
          credentialReadCount += 1;
          events.push("eas:credentials");
          if (credentialReadCount === 1) {
            return gqlResponse(
              installedCandidate
                ? credentialsData({
                    profile: {
                      developerPortalIdentifier: savedProfileId,
                      expiration: targetProfileExpiration,
                    },
                  })
                : credentialsData(),
            );
          }
          if (credentialReadCount === 2 && driftBeforeUpdate) {
            return gqlResponse(
              credentialsData({
                profile: { developerPortalIdentifier: "raced-apple-profile-id" },
              }),
            );
          }
          if (credentialReadCount === 2) {
            return gqlResponse(
              installedCandidate
                ? credentialsData({
                    profile: {
                      developerPortalIdentifier: savedProfileId,
                      expiration: targetProfileExpiration,
                    },
                  })
                : credentialsData(),
            );
          }
          return gqlResponse(
            credentialsData({
              profile: {
                developerPortalIdentifier: targetProfileId,
                expiration: targetProfileExpiration,
              },
            }),
          );
        }
        if (request.query.includes("UpdateAppleProvisioningProfileMutation")) {
          events.push("eas:mutation");
          mutationCount += 1;
          assert.equal(
            request.variables.appleProvisioningProfileId,
            "eas-profile-record",
          );
          assert.equal(
            request.variables.appleProvisioningProfileInput.developerPortalIdentifier,
            targetProfileId,
          );
          return gqlResponse({
            appleProvisioningProfile: {
              updateAppleProvisioningProfile: {
                id: "eas-profile-record",
                 developerPortalIdentifier: targetProfileId,
              },
            },
          });
        }
        assert.fail("Unexpected mocked EAS operation");
      }

      assert.equal(url.origin, "https://api.appstoreconnect.apple.com");
      const route = `${options.method} ${url.pathname}`;
      events.push(`asc:${route}`);
      if (route === "GET /v1/bundleIds") {
        return jsonResponse({
          data: [
            {
              type: "bundleIds",
              id: "asc-bundle-id",
              attributes: {
                identifier: CONFIG.bundleIdentifier,
                platform: "IOS",
              },
            },
          ],
        });
      }
      if (route === "GET /v1/certificates/apple-certificate-id") {
        return jsonResponse({
          data: {
            type: "certificates",
            id: "apple-certificate-id",
            attributes: {
              serialNumber: "A1B2C3D4",
              certificateType: "IOS_DISTRIBUTION",
              certificateContent: CERTIFICATE_CONTENT,
            },
          },
        });
      }
      if (route === "GET /v1/devices") {
        return jsonResponse({
          data: [
            {
              type: "devices",
              id: "asc-device-a",
              attributes: { udid: DEVICE_A },
            },
            {
              type: "devices",
              id: "asc-device-b",
              attributes: { udid: DEVICE_B },
            },
          ],
        });
      }
      if (route === `GET /v1/profiles/${savedProfileId}`) {
        return jsonResponse({
          data: installedCandidate
            ? selectedCandidate
            : existingAppleProfile(savedProfileId),
        });
      }
      if (route === "GET /v1/profiles") {
        return jsonResponse({
          data: url.searchParams.has("filter[name]") ? [] : candidates,
        });
      }
      if (route === "POST /v1/profiles") {
        profileCreateCount += 1;
        const body = JSON.parse(options.body);
        createdName = body.data.attributes.name;
        assert.equal(body.data.attributes.profileType, "IOS_APP_ADHOC");
        return jsonResponse({
          data: { type: "profiles", id: PROFILE_RESOURCE_ID },
        });
      }
      if (
        candidates.some((candidate) => route === `GET /v1/profiles/${candidate.id}`)
      ) {
        const id = url.pathname.split("/").at(-1);
        return jsonResponse({
          data: candidates.find((candidate) => candidate.id === id),
        });
      }
      if (route === `GET /v1/profiles/${PROFILE_RESOURCE_ID}`) {
        return jsonResponse({
          data: ascProfileResource({
            attributes: {
              name: createdName,
              expirationDate: NEW_PROFILE_EXPIRATION,
            },
          }),
        });
      }
      assert.fail("Unexpected mocked ASC request");
    };

    let result;
    let error;
    try {
      result = await repair.runRepair({
        args,
        env: {
          EXPO_TOKEN: "offline-eas-token",
          EXPO_ASC_API_KEY_PATH: keyPath,
          EXPO_ASC_KEY_ID: "OFFLINEKEY1",
          EXPO_ASC_ISSUER_ID: "offline-issuer-id",
        },
        platform: "darwin",
        projectRoot: PROJECT_ROOT,
        fetchImpl,
        now: () => now,
        randomUUID: () => "f3d8e9a1-06a7-4cb3-8e60-2f1d5a7b9c41",
        decodeProfile: () =>
          embeddedProfile({
            Name: selectedCandidate?.attributes?.name ?? createdName,
            UUID: selectedCandidate?.attributes?.uuid ?? PROFILE_UUID,
            ExpirationDate:
              selectedCandidate?.attributes?.expirationDate ??
              NEW_PROFILE_EXPIRATION,
            ...decodeOverrides,
          }),
      });
    } catch (caught) {
      error = caught;
    }
    return { result, error, events, mutationCount, profileCreateCount };
  }

  try {
    const { result, events, mutationCount, profileCreateCount } =
      await runFakeApply();
    assert.equal(result.diagnostic, "REPAIR_COMPLETE");
    assert.deepEqual(result, { diagnostic: "REPAIR_COMPLETE" });
    assert.equal(mutationCount, 1);
    assert.equal(profileCreateCount, 1);
    const mutationIndex = events.indexOf("eas:mutation");
    assert.ok(mutationIndex > 0);
    assert.equal(events[mutationIndex - 1], "eas:credentials");

    const drift = await runFakeApply({ driftBeforeUpdate: true });
    assert.equal(drift.error?.diagnostic, "FAILED_VALIDATION");
    assert.equal(drift.error?.stage, "SNAPSHOT_BEFORE_MUTATION");
    assert.equal(drift.mutationCount, 0);
    assert.equal(drift.events.at(-1), "eas:credentials");

    const candidateResource = (id = "repair-candidate-id") =>
      ascProfileResource({
        attributes: {
          name: `${repair.PROFILE_NAME_PREFIX}2024-12-31T23:00:00.000Z f3d8e9a1-06a7-4cb3-8e60-2f1d5a7b9c41`,
          expirationDate: NEW_PROFILE_EXPIRATION,
        },
        resource: { id },
      });
    const candidate = candidateResource();
    const diagnosis = await runFakeApply({
      args: ["--diagnose"],
      candidates: [candidate],
    });
    assert.equal(diagnosis.error, undefined);
    assert.equal(diagnosis.result.diagnostic, "DIAGNOSE_COMPLETE");
    assert.equal(diagnosis.result.candidateCount, 1);
    assert.equal(diagnosis.result.validatedCandidateCount, 1);
    assert.equal(diagnosis.result.savedProfileIsCandidate, false);
    assert.equal(
      diagnosis.result.candidateStageResults.PLIST_PARSE.passedCount,
      1,
    );
    assert.equal(diagnosis.mutationCount, 0);
    assert.equal(diagnosis.profileCreateCount, 0);
    assert.ok(
      diagnosis.events.every(
        (event) =>
          !event.startsWith("asc:POST") && event !== "eas:mutation",
      ),
    );
    const candidateStageFailure = await runFakeApply({
      args: ["--diagnose"],
      candidates: [
        ascProfileResource({
          attributes: {
            name: `${repair.PROFILE_NAME_PREFIX}2024-12-31T23:00:00.000Z f3d8e9a1-06a7-4cb3-8e60-2f1d5a7b9c41`,
            profileState: "INVALID",
          },
          resource: { id: "invalid-repair-candidate" },
        }),
      ],
    });
    assert.equal(candidateStageFailure.result?.diagnostic, "DIAGNOSE_COMPLETE");
    assert.equal(
      candidateStageFailure.result.candidateStageResults.CANDIDATE_CREATE_READBACK
        .failedCount,
      1,
    );
    assert.equal(candidateStageFailure.mutationCount, 0);
    assert.equal(candidateStageFailure.profileCreateCount, 0);
    const domainInvariantFailure = await runFakeApply({
      args: ["--diagnose"],
      candidates: [candidate],
      decodeOverrides: {
        Entitlements: {
          ...embeddedProfile().Entitlements,
          "com.apple.developer.associated-domains": "*",
        },
      },
    });
    assert.equal(domainInvariantFailure.result?.diagnostic, "DIAGNOSE_COMPLETE");
    assert.equal(
      domainInvariantFailure.result.candidateStageResults.EMBEDDED_ENTITLEMENTS
        .failedCount,
      1,
    );
    assert.equal(
      domainInvariantFailure.result.candidateInvariantResults[0].invariants
        .associatedDomainsKind,
      "STRING_WILDCARD",
    );
    assert.equal(
      domainInvariantFailure.result.candidateInvariantResults[0].invariants
        .associatedDomainsAuthorized,
      "FAIL",
    );
    assert.equal(domainInvariantFailure.mutationCount, 0);
    assert.equal(domainInvariantFailure.profileCreateCount, 0);

    const reuse = await runFakeApply({
      args: ["--apply", "--reuse-repair-profile"],
      candidates: [candidate],
    });
    assert.equal(reuse.result?.diagnostic, "REPAIR_COMPLETE");
    assert.equal(reuse.profileCreateCount, 0);
    assert.equal(reuse.mutationCount, 1);

    const noFallback = await runFakeApply({
      args: ["--apply", "--reuse-repair-profile"],
    });
    assert.equal(noFallback.error?.diagnostic, "FAILED_VALIDATION");
    assert.equal(noFallback.error?.stage, "CANDIDATE_ENUMERATION");
    assert.equal(noFallback.profileCreateCount, 0);
    assert.equal(noFallback.mutationCount, 0);

    const invalidReuseCandidate = await runFakeApply({
      args: ["--apply", "--reuse-repair-profile"],
      candidates: [
        ascProfileResource({
          attributes: {
            name: `${repair.PROFILE_NAME_PREFIX}2024-12-31T23:00:00.000Z f3d8e9a1-06a7-4cb3-8e60-2f1d5a7b9c41`,
            profileState: "INVALID",
          },
          resource: { id: "invalid-repair-candidate" },
        }),
      ],
    });
    assert.equal(invalidReuseCandidate.error?.diagnostic, "FAILED_VALIDATION");
    assert.equal(invalidReuseCandidate.profileCreateCount, 0);
    assert.equal(invalidReuseCandidate.mutationCount, 0);

    const ambiguous = await runFakeApply({
      args: ["--apply", "--reuse-repair-profile"],
      candidates: [candidate, candidateResource("another-candidate-id")],
    });
    assert.equal(ambiguous.error?.diagnostic, "FAILED_AMBIGUOUS");
    assert.equal(ambiguous.error?.stage, "CANDIDATE_ENUMERATION");
    assert.equal(ambiguous.profileCreateCount, 0);
    assert.equal(ambiguous.mutationCount, 0);

    const installed = await runFakeApply({
      candidates: [candidate],
      installedCandidate: true,
    });
    assert.equal(installed.result?.diagnostic, "REPAIR_COMPLETE");
    assert.equal(installed.profileCreateCount, 0);
    assert.equal(installed.mutationCount, 0);
    assert.equal(installed.events.some((event) => event === "eas:mutation"), false);
    assert.equal(installed.events.at(-1), "eas:credentials");

    const installedDrift = await runFakeApply({
      candidates: [candidate],
      installedCandidate: true,
      driftBeforeUpdate: true,
    });
    assert.equal(installedDrift.error?.diagnostic, "FAILED_VALIDATION");
    assert.equal(installedDrift.error?.stage, "SNAPSHOT_BEFORE_MUTATION");
    assert.equal(installedDrift.profileCreateCount, 0);
    assert.equal(installedDrift.mutationCount, 0);
    assert.equal(installedDrift.events.at(-1), "eas:credentials");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
