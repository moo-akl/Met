"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

// These GraphQL operations follow the EAS CLI 18.9.1 source installed by the
// iOS build workflow:
//   credentials/ios/api/graphql/queries/AppleAppIdentifierQuery
//   credentials/ios/api/graphql/queries/IosAppCredentialsQuery
//   credentials/ios/api/graphql/mutations/AppleProvisioningProfileMutation
//   graphql/queries/AppQuery
//   commandUtils/context/contextUtils/createGraphqlClient
// The profile update deliberately targets the existing AppleProvisioningProfile
// record. It does not call setProvisioningProfile, create/delete credentials, or
// any certificate/device revocation operation.
const EAS_GRAPHQL_URL = "https://api.expo.dev/graphql";
const ASC_API_ROOT = "https://api.appstoreconnect.apple.com/v1/";
const PROFILE_NAME_PREFIX = "*[expo] app.met.founders AdHoc repair ";
const MAX_ASC_PAGES = 200;
const MAX_ASC_RESPONSE_BYTES = 12 * 1024 * 1024;
const DIAGNOSTICS = new Set([
  "INSPECT_ONLY",
  "REPAIR_COMPLETE",
  "FAILED_INVALID_ARGUMENTS",
  "FAILED_CONFIGURATION",
  "FAILED_AUTH",
  "FAILED_API_PERMISSION",
  "FAILED_API",
  "FAILED_AMBIGUOUS",
  "FAILED_VALIDATION",
  "FAILED_PLATFORM",
]);

const APP_BY_ID_QUERY = `
  query AppByIdQuery($appId: String!) {
    app {
      byId(appId: $appId) {
        id
        fullName
        slug
        ownerAccount {
          id
          name
        }
      }
    }
  }
`;

const APPLE_APP_IDENTIFIER_QUERY = `
  query AppleAppIdentifierByBundleIdQuery(
    $accountName: String!
    $bundleIdentifier: String!
  ) {
    account {
      byName(accountName: $accountName) {
        id
        appleAppIdentifiers(bundleIdentifier: $bundleIdentifier) {
          id
          bundleIdentifier
        }
      }
    }
  }
`;

const IOS_APP_CREDENTIALS_QUERY = `
  query IosAppCredentialsWithBuildCredentialsByAppIdentifierIdQuery(
    $projectFullName: String!
    $appleAppIdentifierId: String!
    $iosDistributionType: IosDistributionType!
  ) {
    app {
      byFullName(fullName: $projectFullName) {
        id
        slug
        ownerAccount {
          id
          name
        }
        iosAppCredentials(filter: { appleAppIdentifierId: $appleAppIdentifierId }) {
          id
          iosAppBuildCredentialsList(
            filter: { iosDistributionType: $iosDistributionType }
          ) {
            id
            iosDistributionType
            distributionCertificate {
              id
              serialNumber
              developerPortalIdentifier
              appleTeam {
                id
                appleTeamIdentifier
              }
            }
            provisioningProfile {
              id
              developerPortalIdentifier
              expiration
              appleTeam {
                id
                appleTeamIdentifier
              }
              appleDevices {
                id
                identifier
              }
            }
          }
        }
      }
    }
  }
`;

const UPDATE_EXISTING_PROFILE_MUTATION = `
  mutation UpdateAppleProvisioningProfileMutation(
    $appleProvisioningProfileId: ID!
    $appleProvisioningProfileInput: AppleProvisioningProfileInput!
  ) {
    appleProvisioningProfile {
      updateAppleProvisioningProfile(
        id: $appleProvisioningProfileId
        appleProvisioningProfileInput: $appleProvisioningProfileInput
      ) {
        id
        developerPortalIdentifier
      }
    }
  }
`;

class RepairError extends Error {
  constructor(diagnostic) {
    super(diagnostic);
    this.name = "RepairError";
    this.diagnostic = diagnostic;
  }
}

function fail(diagnostic) {
  throw new RepairError(diagnostic);
}

function parseArguments(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return { apply: false };
  }
  if (args.length === 1 && args[0] === "--apply") {
    return { apply: true };
  }
  fail("FAILED_INVALID_ARGUMENTS");
}

function readProjectConfiguration(projectRoot) {
  let appConfig;
  let easConfig;
  try {
    appConfig = JSON.parse(
      fs.readFileSync(path.join(projectRoot, "app.json"), "utf8"),
    ).expo;
    easConfig = JSON.parse(
      fs.readFileSync(path.join(projectRoot, "eas.json"), "utf8"),
    );
  } catch {
    fail("FAILED_CONFIGURATION");
  }

  const projectId = appConfig?.extra?.eas?.projectId;
  const bundleIdentifier = appConfig?.ios?.bundleIdentifier;
  const slug = appConfig?.slug;
  const domains = appConfig?.ios?.associatedDomains;
  const targetProfile = easConfig?.build?.["preview:device"];
  const teamIdentifier = easConfig?.submit?.production?.ios?.appleTeamId;
  if (
    projectId !== "f9d35bdb-e890-408f-b9d9-4ca36cbeae23" ||
    bundleIdentifier !== "app.met.founders" ||
    slug !== "met" ||
    !Array.isArray(domains) ||
    domains.length === 0 ||
    domains.some((domain) => typeof domain !== "string" || !domain.startsWith("applinks:")) ||
    targetProfile?.distribution !== "internal" ||
    targetProfile?.channel !== "preview" ||
    targetProfile?.ios?.simulator === true ||
    !/^[A-Z0-9]{10}$/.test(teamIdentifier || "")
  ) {
    fail("FAILED_CONFIGURATION");
  }

  return {
    projectId,
    bundleIdentifier,
    slug,
    associatedDomains: [...new Set(domains)],
    teamIdentifier,
  };
}

function requireEasToken(env) {
  if (typeof env.EXPO_TOKEN !== "string" || env.EXPO_TOKEN.trim() === "") {
    fail("FAILED_AUTH");
  }
  return env.EXPO_TOKEN;
}

function validateApplyEnvironment(env, platform, keyStat) {
  if (platform !== "darwin") {
    fail("FAILED_PLATFORM");
  }
  for (const name of [
    "EXPO_ASC_API_KEY_PATH",
    "EXPO_ASC_KEY_ID",
    "EXPO_ASC_ISSUER_ID",
  ]) {
    if (typeof env[name] !== "string" || env[name].trim() === "") {
      fail("FAILED_AUTH");
    }
  }
  requireEasToken(env);
  if (
    !keyStat ||
    !keyStat.isFile ||
    keyStat.isSymbolicLink ||
    (keyStat.mode & 0o077) !== 0
  ) {
    fail("FAILED_AUTH");
  }
}

function readPrivateKey(env, platform = process.platform) {
  let stat;
  try {
    stat = fs.lstatSync(env.EXPO_ASC_API_KEY_PATH);
  } catch {
    fail("FAILED_AUTH");
  }
  validateApplyEnvironment(env, platform, {
    isFile: stat.isFile(),
    isSymbolicLink: stat.isSymbolicLink(),
    mode: stat.mode,
  });

  try {
    const key = fs.readFileSync(env.EXPO_ASC_API_KEY_PATH, "utf8");
    crypto.createPrivateKey(key);
    return key;
  } catch {
    fail("FAILED_AUTH");
  }
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function createAscJwt({ keyId, issuerId, privateKey, nowSeconds = Math.floor(Date.now() / 1000) }) {
  if (
    typeof keyId !== "string" ||
    !keyId ||
    typeof issuerId !== "string" ||
    !issuerId ||
    typeof privateKey !== "string" ||
    !Number.isInteger(nowSeconds)
  ) {
    fail("FAILED_AUTH");
  }
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: issuerId,
      iat: nowSeconds,
      exp: nowSeconds + 15 * 60,
      aud: "appstoreconnect-v1",
    }),
  );
  const signingInput = `${header}.${payload}`;
  let signature;
  try {
    signature = crypto.sign("sha256", Buffer.from(signingInput), {
      key: privateKey,
      dsaEncoding: "ieee-p1363",
    });
  } catch {
    fail("FAILED_AUTH");
  }
  if (signature.length !== 64) fail("FAILED_AUTH");
  return `${signingInput}.${base64Url(signature)}`;
}

function normalizeSet(values, normalizer = (value) => value) {
  if (!Array.isArray(values)) fail("FAILED_VALIDATION");
  const normalized = values.map((value) =>
    typeof value === "string" ? normalizer(value) : "",
  );
  if (
    normalized.some((value) => !value) ||
    new Set(normalized).size !== normalized.length
  ) {
    fail("FAILED_VALIDATION");
  }
  return normalized.sort();
}

function exactlyOne(items) {
  if (!Array.isArray(items) || items.length === 0) fail("FAILED_VALIDATION");
  if (items.length !== 1) fail("FAILED_AMBIGUOUS");
  return items[0];
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function normalizeTimestamp(value) {
  let timestamp;
  if (typeof value === "number" && Number.isFinite(value)) {
    timestamp = Math.abs(value) < 1e12 ? value * 1000 : value;
  } else if (typeof value === "string") {
    timestamp = Date.parse(value);
  }
  if (!Number.isFinite(timestamp)) fail("FAILED_VALIDATION");
  return timestamp;
}

function validateProject(app, config) {
  if (
    !app ||
    app.id !== config.projectId ||
    app.slug !== config.slug ||
    typeof app.ownerAccount?.id !== "string" ||
    !app.ownerAccount.id ||
    typeof app.ownerAccount?.name !== "string" ||
    !app.ownerAccount.name
  ) {
    fail("FAILED_VALIDATION");
  }
  return {
    accountId: app.ownerAccount.id,
    accountName: app.ownerAccount.name,
    projectFullName: `@${app.ownerAccount.name}/${config.slug}`,
  };
}

function validateCredentialSnapshot(
  data,
  { config, project, appleAppIdentifierId },
) {
  const app = data?.app?.byFullName;
  if (
    !app ||
    app.id !== config.projectId ||
    app.slug !== config.slug ||
    app.ownerAccount?.id !== project.accountId ||
    app.ownerAccount?.name !== project.accountName ||
    typeof appleAppIdentifierId !== "string" ||
    !appleAppIdentifierId
  ) {
    fail("FAILED_VALIDATION");
  }
  const iosCredentials = exactlyOne(app.iosAppCredentials);
  const buildCredential = exactlyOne(iosCredentials.iosAppBuildCredentialsList);
  if (
    !iosCredentials.id ||
    !buildCredential.id ||
    buildCredential.iosDistributionType !== "AD_HOC"
  ) {
    fail("FAILED_VALIDATION");
  }

  const certificate = buildCredential.distributionCertificate;
  const profile = buildCredential.provisioningProfile;
  if (
    !certificate?.id ||
    !certificate.developerPortalIdentifier ||
    !certificate.serialNumber ||
    !profile?.id ||
    !profile.developerPortalIdentifier ||
    !Array.isArray(profile.appleDevices) ||
    profile.appleDevices.length === 0
  ) {
    fail("FAILED_VALIDATION");
  }
  const certificateTeam = certificate.appleTeam?.appleTeamIdentifier;
  const profileTeam = profile.appleTeam?.appleTeamIdentifier;
  const certificateTeamId = certificate.appleTeam?.id;
  const profileTeamId = profile.appleTeam?.id;
  if (
    certificateTeam !== config.teamIdentifier ||
    profileTeam !== config.teamIdentifier ||
    !certificateTeamId ||
    !profileTeamId
  ) {
    fail("FAILED_VALIDATION");
  }
  const deviceIds = normalizeSet(profile.appleDevices.map((device) => device?.id));
  const deviceUdids = normalizeSet(
    profile.appleDevices.map((device) => device?.identifier),
    (value) => value.toUpperCase(),
  );

  return {
    accountId: app.ownerAccount.id,
    projectId: app.id,
    projectFullName: project.projectFullName,
    appleAppIdentifierId,
    appCredentialsId: iosCredentials.id,
    buildCredentialsId: buildCredential.id,
    certificateId: certificate.id,
    certificatePortalId: certificate.developerPortalIdentifier,
    certificateSerialNumber: certificate.serialNumber,
    certificateTeamId,
    certificateTeam,
    profileId: profile.id,
    oldProfilePortalId: profile.developerPortalIdentifier,
    profileExpiration: profile.expiration,
    profileTeamId,
    profileTeam,
    deviceIds,
    deviceUdids,
  };
}

function buildAscProfilePayload({ name, bundleId, certificateId, deviceIds }) {
  if (
    typeof name !== "string" ||
    !name.startsWith(PROFILE_NAME_PREFIX) ||
    !bundleId ||
    !certificateId
  ) {
    fail("FAILED_VALIDATION");
  }
  const ids = normalizeSet(deviceIds);
  if (ids.length === 0) fail("FAILED_VALIDATION");
  return {
    data: {
      type: "profiles",
      attributes: {
        name,
        profileType: "IOS_APP_ADHOC",
      },
      relationships: {
        bundleId: { data: { type: "bundleIds", id: bundleId } },
        certificates: {
          data: [{ type: "certificates", id: certificateId }],
        },
        devices: {
          data: ids.map((id) => ({ type: "devices", id })),
        },
      },
    },
  };
}

function buildEasProfileUpdateRequest(snapshot, newProfile) {
  if (
    !snapshot?.profileId ||
    !newProfile?.id ||
    typeof newProfile.profileContent !== "string" ||
    newProfile.profileContent.length === 0
  ) {
    fail("FAILED_VALIDATION");
  }
  return {
    query: UPDATE_EXISTING_PROFILE_MUTATION,
    variables: {
      appleProvisioningProfileId: snapshot.profileId,
      appleProvisioningProfileInput: {
        appleProvisioningProfile: newProfile.profileContent,
        developerPortalIdentifier: newProfile.id,
      },
    },
  };
}

function relationshipIds(resource, relation) {
  const data = resource?.relationships?.[relation]?.data;
  const items = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : null;
  if (!items) fail("FAILED_VALIDATION");
  return normalizeSet(items.map((item) => item?.id));
}

function validateAscProfileResource(resource, expected) {
  const attributes = resource?.attributes;
  if (
    resource?.type !== "profiles" ||
    !resource.id ||
    attributes?.name !== expected.name ||
    attributes?.profileType !== "IOS_APP_ADHOC" ||
    attributes?.profileState !== "ACTIVE" ||
    typeof attributes?.expirationDate !== "string" ||
    !attributes.profileContent ||
    !isUuid(attributes.uuid)
  ) {
    fail("FAILED_VALIDATION");
  }
  const certIds = relationshipIds(resource, "certificates");
  const deviceIds = relationshipIds(resource, "devices");
  const bundleIds = relationshipIds(resource, "bundleId");
  if (
    certIds.length !== 1 ||
    certIds[0] !== expected.certificateId ||
    deviceIds.length !== expected.deviceIds.length ||
    deviceIds.some((id, index) => id !== expected.deviceIds[index]) ||
    bundleIds.length !== 1 ||
    bundleIds[0] !== expected.bundleId
  ) {
    fail("FAILED_VALIDATION");
  }
  return {
    id: resource.id,
    profileUUID: attributes.uuid,
    profileContent: attributes.profileContent,
    expirationDate: attributes.expirationDate,
    name: attributes.name,
    profileType: attributes.profileType,
  };
}

function validateExistingAscProfileResource(resource, expected) {
  if (
    resource?.type !== "profiles" ||
    resource.id !== expected.profileId ||
    resource.attributes?.profileType !== "IOS_APP_ADHOC"
  ) {
    fail("FAILED_VALIDATION");
  }
  const bundleIds = relationshipIds(resource, "bundleId");
  const certificateIds = relationshipIds(resource, "certificates");
  const deviceIds = relationshipIds(resource, "devices");
  if (
    bundleIds.length !== 1 ||
    bundleIds[0] !== expected.bundleId ||
    certificateIds.length !== 1 ||
    certificateIds[0] !== expected.certificateId ||
    deviceIds.length !== expected.deviceIds.length ||
    deviceIds.some((id, index) => id !== expected.deviceIds[index])
  ) {
    fail("FAILED_VALIDATION");
  }
}

function parsePlistData(value) {
  if (typeof value !== "string" || !value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    fail("FAILED_VALIDATION");
  }
  const data = Buffer.from(value, "base64");
  if (!data.length || data.toString("base64") !== value) fail("FAILED_VALIDATION");
  return data;
}

function validateEmbeddedProfile(plist, expected) {
  const entitlements = plist?.Entitlements;
  const applicationIdentifierPrefixes = plist?.ApplicationIdentifierPrefix;
  const teamIdentifiers = plist?.TeamIdentifier;
  const authorizedDomains =
    entitlements?.["com.apple.developer.associated-domains"];
  if (
    !plist ||
    !Array.isArray(applicationIdentifierPrefixes) ||
    applicationIdentifierPrefixes.length === 0 ||
    applicationIdentifierPrefixes.some(
      (prefix) => typeof prefix !== "string" || prefix.length === 0,
    ) ||
    !Array.isArray(teamIdentifiers) ||
    teamIdentifiers.includes(expected.teamIdentifier) !== true ||
    !applicationIdentifierPrefixes.some(
      (prefix) =>
        entitlements?.["application-identifier"] ===
        `${prefix}.${expected.bundleIdentifier}`,
    ) ||
    entitlements?.["com.apple.developer.team-identifier"] !== expected.teamIdentifier ||
    entitlements?.["aps-environment"] !== "production" ||
    !Array.isArray(authorizedDomains) ||
    authorizedDomains.length === 0 ||
    authorizedDomains.some(
      (domain) => typeof domain !== "string" || domain.length === 0,
    ) ||
    (!authorizedDomains.includes("*") &&
      expected.associatedDomains.some(
        (domain) => !authorizedDomains.includes(domain),
      )) ||
    plist.Name !== expected.name ||
    !isUuid(plist.UUID) ||
    plist.UUID.toLowerCase() !== expected.profileUUID.toLowerCase() ||
    !Array.isArray(plist.DeveloperCertificates) ||
    plist.DeveloperCertificates.length !== 1
  ) {
    fail("FAILED_VALIDATION");
  }

  const embeddedDevices = normalizeSet(plist.ProvisionedDevices, (value) =>
    value.toUpperCase(),
  );
  const expectedDevices = normalizeSet(expected.deviceUdids, (value) =>
    value.toUpperCase(),
  );
  if (
    embeddedDevices.length !== expectedDevices.length ||
    embeddedDevices.some((id, index) => id !== expectedDevices[index])
  ) {
    fail("FAILED_VALIDATION");
  }

  const embeddedCertificate = parsePlistData(plist.DeveloperCertificates[0]);
  const expectedCertificate = Buffer.isBuffer(expected.certificateContent)
    ? expected.certificateContent
    : parsePlistData(expected.certificateContent);
  if (!embeddedCertificate.equals(expectedCertificate)) fail("FAILED_VALIDATION");

  const expiration = Date.parse(plist.ExpirationDate);
  const ascExpiration = Date.parse(expected.expirationDate);
  if (
    !Number.isFinite(expiration) ||
    !Number.isFinite(ascExpiration) ||
    expiration <= expected.nowMs + 60_000 ||
    Math.abs(expiration - ascExpiration) > 5 * 60_000
  ) {
    fail("FAILED_VALIDATION");
  }
}

function decodeProvisioningProfile(profileContent, { tempRoot = os.tmpdir(), spawn = spawnSync } = {}) {
  if (process.platform !== "darwin") fail("FAILED_PLATFORM");
  const cmsBytes = parsePlistData(profileContent);
  let directory;
  try {
    directory = fs.mkdtempSync(path.join(tempRoot, "met-ios-profile-"));
    fs.chmodSync(directory, 0o700);
    const profilePath = path.join(directory, "new.mobileprovision");
    fs.writeFileSync(profilePath, cmsBytes, { mode: 0o600, flag: "wx" });
    const decoded = spawn("security", ["cms", "-D", "-i", profilePath], {
      encoding: "buffer",
      maxBuffer: MAX_ASC_RESPONSE_BYTES,
      windowsHide: true,
    });
    if (decoded.error || decoded.status !== 0 || !Buffer.isBuffer(decoded.stdout)) {
      fail("FAILED_VALIDATION");
    }
    const parsed = spawn("plutil", ["-convert", "json", "-o", "-", "-"], {
      input: decoded.stdout,
      encoding: "utf8",
      maxBuffer: MAX_ASC_RESPONSE_BYTES,
      windowsHide: true,
    });
    if (parsed.error || parsed.status !== 0 || typeof parsed.stdout !== "string") {
      fail("FAILED_VALIDATION");
    }
    try {
      return JSON.parse(parsed.stdout);
    } catch {
      fail("FAILED_VALIDATION");
    }
  } catch (error) {
    if (error instanceof RepairError) throw error;
    fail("FAILED_VALIDATION");
  } finally {
    if (directory) {
      try {
        fs.rmSync(directory, { recursive: true, force: true });
      } catch {
        // Cleanup failure must not cause potentially sensitive data to be logged.
        fail("FAILED_VALIDATION");
      }
    }
  }
}

function createEasRequest(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") fail("FAILED_API");
  return async function easRequest(query, variables, token) {
    let response;
    try {
      response = await fetchImpl(EAS_GRAPHQL_URL, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch {
      fail("FAILED_API");
    }
    if (response.status === 401) fail("FAILED_AUTH");
    if (response.status === 403) fail("FAILED_API_PERMISSION");
    if (!response.ok) fail("FAILED_API");

    let result;
    try {
      const body = await response.text();
      if (Buffer.byteLength(body) > MAX_ASC_RESPONSE_BYTES) fail("FAILED_API");
      result = JSON.parse(body);
    } catch (error) {
      if (error instanceof RepairError) throw error;
      fail("FAILED_API");
    }
    if (Array.isArray(result?.errors) && result.errors.length > 0) {
      const permissionError = result.errors.some((item) =>
        ["FORBIDDEN", "UNAUTHENTICATED", "UNAUTHORIZED"].includes(
          item?.extensions?.code || item?.extensions?.errorCode,
        ),
      );
      fail(permissionError ? "FAILED_API_PERMISSION" : "FAILED_API");
    }
    if (!result?.data) fail("FAILED_API");
    return result.data;
  };
}

function createAscRequest({ token, fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== "function") fail("FAILED_API");
  return async function ascRequest(method, input, body) {
    let url;
    try {
      url = new URL(input, ASC_API_ROOT);
    } catch {
      fail("FAILED_API");
    }
    if (
      url.protocol !== "https:" ||
      url.origin !== "https://api.appstoreconnect.apple.com" ||
      !url.pathname.startsWith("/v1/")
    ) {
      fail("FAILED_API");
    }

    let response;
    try {
      response = await fetchImpl(url, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      fail("FAILED_API");
    }
    if (response.status === 401) fail("FAILED_AUTH");
    if (response.status === 403) fail("FAILED_API_PERMISSION");
    if (!response.ok) fail("FAILED_API");

    try {
      const responseText = await response.text();
      if (Buffer.byteLength(responseText) > MAX_ASC_RESPONSE_BYTES) fail("FAILED_API");
      return JSON.parse(responseText);
    } catch (error) {
      if (error instanceof RepairError) throw error;
      fail("FAILED_API");
    }
  };
}

async function listAscResources(request, pathAndQuery) {
  const all = [];
  let next = pathAndQuery;
  for (let page = 0; next && page < MAX_ASC_PAGES; page += 1) {
    const response = await request("GET", next);
    if (!Array.isArray(response?.data)) fail("FAILED_API");
    all.push(...response.data);
    if (all.length > 20_000) fail("FAILED_API");
    next = response.links?.next || null;
  }
  if (next) fail("FAILED_API");
  return all;
}

function buildCollectionPath(resource, filters = {}) {
  const url = new URL(resource, ASC_API_ROOT);
  for (const [key, value] of Object.entries(filters)) {
    url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

function assertCredentialSnapshotUnchanged(original, current) {
  const canonical = (snapshot) =>
    JSON.stringify(
      Object.keys(snapshot)
        .sort()
        .map((key) => [key, snapshot[key]]),
    );
  if (canonical(original) !== canonical(current)) fail("FAILED_VALIDATION");
}

function validateBuildCredentialsAfterUpdate(
  data,
  { config, project, snapshot, newProfileId, newProfileExpiration },
) {
  const updated = validateCredentialSnapshot(data, {
    config,
    project,
    appleAppIdentifierId: snapshot.appleAppIdentifierId,
  });
  const expected = { ...snapshot, oldProfilePortalId: newProfileId };
  const actual = { ...updated };
  const expectedExpiration = normalizeTimestamp(newProfileExpiration);
  const actualExpiration = normalizeTimestamp(updated.profileExpiration);
  delete expected.profileExpiration;
  delete actual.profileExpiration;
  assertCredentialSnapshotUnchanged(expected, actual);
  if (actualExpiration !== expectedExpiration) fail("FAILED_VALIDATION");
}

async function runRepair({
  args = process.argv.slice(2),
  env = process.env,
  platform = process.platform,
  projectRoot = path.resolve(__dirname, ".."),
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  randomUUID = crypto.randomUUID,
  decodeProfile = decodeProvisioningProfile,
} = {}) {
  const { apply } = parseArguments(args);
  let privateKey;
  if (apply) {
    if (platform !== "darwin") fail("FAILED_PLATFORM");
    privateKey = readPrivateKey(env, platform);
  }
  const config = readProjectConfiguration(projectRoot);
  const easToken = requireEasToken(env);
  const easRequest = createEasRequest(fetchImpl);

  const projectData = await easRequest(
    APP_BY_ID_QUERY,
    { appId: config.projectId },
    easToken,
  );
  const app = projectData?.app?.byId;
  const project = validateProject(app, config);
  const identifierData = await easRequest(
    APPLE_APP_IDENTIFIER_QUERY,
    {
      accountName: project.accountName,
      bundleIdentifier: config.bundleIdentifier,
    },
    easToken,
  );
  const appleIdentifier = exactlyOne(
    identifierData?.account?.byName?.appleAppIdentifiers,
  );
  if (
    identifierData?.account?.byName?.id !== project.accountId ||
    !appleIdentifier.id ||
    appleIdentifier.bundleIdentifier !== config.bundleIdentifier
  ) {
    fail("FAILED_VALIDATION");
  }
  const credentialsData = await easRequest(
    IOS_APP_CREDENTIALS_QUERY,
    {
      projectFullName: project.projectFullName,
      appleAppIdentifierId: appleIdentifier.id,
      iosDistributionType: "AD_HOC",
    },
    easToken,
  );
  const snapshot = validateCredentialSnapshot(credentialsData, {
    config,
    project,
    appleAppIdentifierId: appleIdentifier.id,
  });

  if (!apply) return { diagnostic: "INSPECT_ONLY" };

  const ascToken = createAscJwt({
    keyId: env.EXPO_ASC_KEY_ID,
    issuerId: env.EXPO_ASC_ISSUER_ID,
    privateKey,
    nowSeconds: Math.floor(now().getTime() / 1000),
  });
  const ascRequest = createAscRequest({ token: ascToken, fetchImpl });

  const bundleIds = await listAscResources(
    ascRequest,
    buildCollectionPath("bundleIds", {
      "filter[identifier]": config.bundleIdentifier,
      limit: "200",
    }),
  );
  const bundleId = exactlyOne(
    bundleIds.filter(
      (item) =>
        item?.type === "bundleIds" &&
        item.attributes?.identifier === config.bundleIdentifier,
    ),
  );
  if (!["IOS", "UNIVERSAL"].includes(bundleId.attributes?.platform)) {
    fail("FAILED_VALIDATION");
  }
  const certificateResponse = await ascRequest(
    "GET",
    `certificates/${encodeURIComponent(snapshot.certificatePortalId)}`,
  );
  const certificate = certificateResponse?.data;
  if (
    certificate?.id !== snapshot.certificatePortalId ||
    certificate?.type !== "certificates" ||
    certificate.attributes?.serialNumber !== snapshot.certificateSerialNumber ||
    !["IOS_DISTRIBUTION", "DISTRIBUTION"].includes(
      certificate.attributes?.certificateType,
    ) ||
    !certificate.attributes?.certificateContent
  ) {
    fail("FAILED_VALIDATION");
  }

  const allDevices = await listAscResources(
    ascRequest,
    buildCollectionPath("devices", { limit: "200" }),
  );
  const ascDevices = snapshot.deviceUdids.map((udid) =>
    exactlyOne(
      allDevices.filter(
        (item) =>
          item?.type === "devices" &&
          typeof item.id === "string" &&
          typeof item.attributes?.udid === "string" &&
          item.attributes.udid.toUpperCase() === udid,
      ),
    ),
  );
  const ascDeviceIds = normalizeSet(ascDevices.map((device) => device.id));
  if (ascDeviceIds.length !== snapshot.deviceIds.length) {
    fail("FAILED_VALIDATION");
  }

  const existingProfileResponse = await ascRequest(
    "GET",
    `profiles/${encodeURIComponent(snapshot.oldProfilePortalId)}?include=bundleId,certificates,devices`,
  );
  validateExistingAscProfileResource(existingProfileResponse?.data, {
    profileId: snapshot.oldProfilePortalId,
    bundleId: bundleId.id,
    certificateId: snapshot.certificatePortalId,
    deviceIds: ascDeviceIds,
  });

  const uniqueName = `${PROFILE_NAME_PREFIX}${now().toISOString()} ${randomUUID()}`;
  const existingNamePath = buildCollectionPath("profiles", {
    "filter[name]": uniqueName,
    "filter[profileType]": "IOS_APP_ADHOC",
    limit: "200",
  });
  const duplicateNames = await listAscResources(ascRequest, existingNamePath);
  if (
    duplicateNames.some(
      (item) =>
        item?.type === "profiles" &&
        item.attributes?.name === uniqueName &&
        item.attributes?.profileType === "IOS_APP_ADHOC",
    )
  ) {
    fail("FAILED_AMBIGUOUS");
  }

  const createBody = buildAscProfilePayload({
    name: uniqueName,
    bundleId: bundleId.id,
    certificateId: certificate.id,
    deviceIds: ascDeviceIds,
  });
  const createdResponse = await ascRequest("POST", "profiles", createBody);
  const created = createdResponse?.data;
  if (!created?.id) fail("FAILED_API");

  // Read the just-created profile back from Apple so validation is against the
  // authoritative resource, not only the POST echo.
  const profileResponse = await ascRequest(
    "GET",
    `profiles/${encodeURIComponent(created.id)}?include=bundleId,certificates,devices`,
  );
  const profile = validateAscProfileResource(profileResponse?.data, {
    name: uniqueName,
    bundleId: bundleId.id,
    certificateId: certificate.id,
    deviceIds: ascDeviceIds,
  });
  const parsedProfile = decodeProfile(profile.profileContent);
  validateEmbeddedProfile(parsedProfile, {
    teamIdentifier: config.teamIdentifier,
    bundleIdentifier: config.bundleIdentifier,
    associatedDomains: config.associatedDomains,
    name: profile.name,
    profileUUID: profile.profileUUID,
    deviceUdids: snapshot.deviceUdids,
    certificateContent: certificate.attributes.certificateContent,
    expirationDate: profile.expirationDate,
    nowMs: now().getTime(),
  });

  // Re-read immediately before mutation. Never update if any EAS association
  // changed while the Apple profile was being created or validated.
  const beforeUpdateData = await easRequest(
    IOS_APP_CREDENTIALS_QUERY,
    {
      projectFullName: project.projectFullName,
      appleAppIdentifierId: appleIdentifier.id,
      iosDistributionType: "AD_HOC",
    },
    easToken,
  );
  const beforeUpdateSnapshot = validateCredentialSnapshot(beforeUpdateData, {
    config,
    project,
    appleAppIdentifierId: appleIdentifier.id,
  });
  assertCredentialSnapshotUnchanged(snapshot, beforeUpdateSnapshot);

  const updateRequest = buildEasProfileUpdateRequest(snapshot, profile);
  const updateData = await easRequest(
    updateRequest.query,
    updateRequest.variables,
    easToken,
  );
  const updatedProfile =
    updateData?.appleProvisioningProfile?.updateAppleProvisioningProfile;
  if (
    updatedProfile?.id !== snapshot.profileId ||
    updatedProfile?.developerPortalIdentifier !== profile.id
  ) {
    fail("FAILED_VALIDATION");
  }

  const finalData = await easRequest(
    IOS_APP_CREDENTIALS_QUERY,
    {
      projectFullName: project.projectFullName,
      appleAppIdentifierId: appleIdentifier.id,
      iosDistributionType: "AD_HOC",
    },
    easToken,
  );
  validateBuildCredentialsAfterUpdate(finalData, {
    config,
    project,
    snapshot,
    newProfileId: profile.id,
    newProfileExpiration: profile.expirationDate,
  });
  return { diagnostic: "REPAIR_COMPLETE" };
}

async function main() {
  try {
    const result = await runRepair();
    if (!DIAGNOSTICS.has(result.diagnostic)) {
      process.stderr.write("FAILED_API\n");
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${result.diagnostic}\n`);
  } catch (error) {
    const diagnostic = DIAGNOSTICS.has(error?.diagnostic)
      ? error.diagnostic
      : "FAILED_API";
    process.stderr.write(`${diagnostic}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  APP_BY_ID_QUERY,
  APPLE_APP_IDENTIFIER_QUERY,
  ASC_API_ROOT,
  DIAGNOSTICS,
  EAS_GRAPHQL_URL,
  IOS_APP_CREDENTIALS_QUERY,
  PROFILE_NAME_PREFIX,
  UPDATE_EXISTING_PROFILE_MUTATION,
  RepairError,
  assertCredentialSnapshotUnchanged,
  buildAscProfilePayload,
  buildCollectionPath,
  buildEasProfileUpdateRequest,
  createAscJwt,
  createAscRequest,
  createEasRequest,
  decodeProvisioningProfile,
  exactlyOne,
  isUuid,
  normalizeSet,
  normalizeTimestamp,
  parseArguments,
  readProjectConfiguration,
  runRepair,
  validateApplyEnvironment,
  validateAscProfileResource,
  validateExistingAscProfileResource,
  validateBuildCredentialsAfterUpdate,
  validateCredentialSnapshot,
  validateEmbeddedProfile,
  validateProject,
};