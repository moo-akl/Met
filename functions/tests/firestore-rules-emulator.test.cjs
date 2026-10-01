const assert = require("node:assert/strict");
const test = require("node:test");

const projectId = process.env.GCLOUD_PROJECT || "demo-met-privacy";
if (!projectId.startsWith("demo-")) {
  throw new Error(
    `Refusing Firestore rules tests for non-disposable project: ${projectId}`,
  );
}

const emulatorHost =
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(emulatorHost)) {
  throw new Error(
    `Refusing Firestore rules tests against non-local host: ${emulatorHost}`,
  );
}

const documentsUrl =
  `http://${emulatorHost}/v1/projects/${projectId}` +
  "/databases/(default)/documents";

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function mockFirebaseJwt(uid) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: `https://securetoken.google.com/${projectId}`,
      aud: projectId,
      auth_time: now,
      user_id: uid,
      sub: uid,
      iat: now,
      exp: now + 3600,
      firebase: {
        identities: {},
        sign_in_provider: "custom",
      },
    }),
  );
  return `${header}.${payload}.`;
}

function authToken(uid) {
  return uid === "owner" ? "owner" : mockFirebaseJwt(uid);
}

function encodeValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: encodeFields(value) } };
  }
  throw new TypeError(`Unsupported Firestore test value: ${typeof value}`);
}

function encodeFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, encodeValue(value)]),
  );
}

async function firestoreRequest(uid, method, url, body) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${authToken(uid)}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let result = null;
  if (text) {
    try {
      result = JSON.parse(text);
    } catch {
      result = text;
    }
  }
  return { status: response.status, result };
}

function fieldsBody(data) {
  return { fields: encodeFields(data) };
}

function maskUrl(url, fieldPaths) {
  const params = new URLSearchParams();
  for (const fieldPath of fieldPaths) {
    params.append("updateMask.fieldPaths", fieldPath);
  }
  return `${url}?${params.toString()}`;
}

async function seedDocument(path, data) {
  const response = await firestoreRequest(
    "owner",
    "PATCH",
    `${documentsUrl}/${path}?currentDocument.exists=false`,
    fieldsBody(data),
  );
  assert.equal(
    response.status,
    200,
    `owner seed failed for ${path}: ${JSON.stringify(response.result)}`,
  );
}

async function updateDocument(uid, path, data, fieldPaths = Object.keys(data)) {
  return firestoreRequest(
    uid,
    "PATCH",
    maskUrl(`${documentsUrl}/${path}`, fieldPaths),
    fieldsBody(data),
  );
}

async function readDocument(uid, path) {
  return firestoreRequest(uid, "GET", `${documentsUrl}/${path}`);
}

function assertDenied(response, message) {
  assert.equal(
    response.status,
    403,
    `${message}; received ${response.status}: ${JSON.stringify(response.result)}`,
  );
}

function assertAllowed(response, message) {
  assert.equal(
    response.status,
    200,
    `${message}; received ${response.status}: ${JSON.stringify(response.result)}`,
  );
}

test("Hidden presence cannot be republished by a stale device", async () => {
  await seedDocument("users/hidden-presence", {
    uid: "hidden-presence",
    isVisible: false,
  });

  const response = await updateDocument(
    "hidden-presence",
    "users/hidden-presence",
    {
      location: { latitude: 37.77, longitude: -122.42 },
      geohash: "9q8yy",
      lastActive: "2026-05-01T12:00:00Z",
    },
  );
  assertDenied(response, "hidden user must not publish stale presence");
});

test("visible presence writes, unconditional hide, and hidden presence clearing work", async () => {
  await seedDocument("users/visible-presence", {
    uid: "visible-presence",
    isVisible: true,
  });

  const publish = await updateDocument(
    "visible-presence",
    "users/visible-presence",
    {
      location: { latitude: 37.77, longitude: -122.42 },
      geohash: "9q8yy",
      lastActive: "2026-05-01T12:00:00Z",
    },
  );
  assertAllowed(publish, "visible user may publish presence");

  const hide = await updateDocument(
    "visible-presence",
    "users/visible-presence",
    { isVisible: false },
  );
  assertAllowed(hide, "owner may hide without any other field change");

  const clear = await updateDocument(
    "visible-presence",
    "users/visible-presence",
    {},
    ["location", "geohash"],
  );
  assertAllowed(clear, "hidden owner may clear location and geohash");

  const stored = await readDocument(
    "visible-presence",
    "users/visible-presence",
  );
  assertAllowed(stored, "owner may read their own hidden user document");
  assert.equal(stored.result.fields.location, undefined);
  assert.equal(stored.result.fields.geohash, undefined);
  assert.notEqual(stored.result.fields.lastActive, undefined);

  const clearLastActive = await updateDocument(
    "visible-presence",
    "users/visible-presence",
    {},
    ["lastActive"],
  );
  assertAllowed(clearLastActive, "hidden owner may clear lastActive");
  const cleared = await readDocument(
    "visible-presence",
    "users/visible-presence",
  );
  assert.equal(cleared.result.fields.lastActive, undefined);
});

test("clients may create only an empty hidden suppression marker", async () => {
  const suppression = await firestoreRequest(
    "suppression-only",
    "PATCH",
    `${documentsUrl}/users/suppression-only?currentDocument.exists=false`,
    fieldsBody({ uid: "suppression-only", isVisible: false }),
  );
  assertAllowed(
    suppression,
    "owner may create hidden suppression marker without presence",
  );

  const hiddenWithCoordinates = await firestoreRequest(
    "hidden-create-coordinates",
    "PATCH",
    `${documentsUrl}/users/hidden-create-coordinates?currentDocument.exists=false`,
    fieldsBody({
      uid: "hidden-create-coordinates",
      isVisible: false,
      location: { latitude: 37.77, longitude: -122.42 },
      geohash: "9q8yy",
      lastActive: "2026-05-01T12:00:00Z",
    }),
  );
  assertDenied(
    hiddenWithCoordinates,
    "client may not create hidden user doc with presence fields",
  );

  const clientVisibleCreate = await firestoreRequest(
    "client-visible-create",
    "PATCH",
    `${documentsUrl}/users/client-visible-create?currentDocument.exists=false`,
    fieldsBody({ uid: "client-visible-create", isVisible: true }),
  );
  assertDenied(
    clientVisibleCreate,
    "only the server may create a confirmed-visible presence document",
  );
});

test("clients cannot create inbound or outbound reveal request mirrors", async () => {
  const inbound = await firestoreRequest(
    "hidden-recipient",
    "PATCH",
    `${documentsUrl}/users/hidden-recipient/requests/forged-sender?currentDocument.exists=false`,
    fieldsBody({
      peerUid: "forged-sender",
      direction: "inbound",
      status: "pending",
    }),
  );
  assertDenied(inbound, "client must not create an inbound request");

  const outbound = await firestoreRequest(
    "forged-sender",
    "PATCH",
    `${documentsUrl}/users/forged-sender/requests/hidden-recipient?currentDocument.exists=false`,
    fieldsBody({
      peerUid: "hidden-recipient",
      direction: "outbound",
      status: "pending",
    }),
  );
  assertDenied(outbound, "client must not create an outbound request");
});

test("the actual recipient may accept or decline both canonical request copies", async () => {
  await seedDocument("users/recipient-a/requests/sender-a", {
    peerUid: "sender-a",
    direction: "inbound",
    status: "pending",
    message: "hello",
  });
  await seedDocument("users/sender-a/requests/recipient-a", {
    peerUid: "recipient-a",
    direction: "outbound",
    status: "pending",
    message: "hello",
  });

  const acceptInbound = await updateDocument(
    "recipient-a",
    "users/recipient-a/requests/sender-a",
    { status: "accepted", updatedAt: "2026-05-01T12:00:00Z" },
  );
  assertAllowed(acceptInbound, "recipient may accept inbound request");

  const acceptOutboundCopy = await updateDocument(
    "recipient-a",
    "users/sender-a/requests/recipient-a",
    { status: "accepted", updatedAt: "2026-05-01T12:00:00Z" },
  );
  assertAllowed(acceptOutboundCopy, "recipient may update outbound mirror");

  await seedDocument("users/recipient-b/requests/sender-b", {
    peerUid: "sender-b",
    direction: "inbound",
    status: "pending",
  });
  await seedDocument("users/sender-b/requests/recipient-b", {
    peerUid: "recipient-b",
    direction: "outbound",
    status: "pending",
  });
  const declineInbound = await updateDocument(
    "recipient-b",
    "users/recipient-b/requests/sender-b",
    { status: "declined" },
  );
  assertAllowed(declineInbound, "recipient may decline inbound request");
  const declineOutboundCopy = await updateDocument(
    "recipient-b",
    "users/sender-b/requests/recipient-b",
    { status: "declined" },
  );
  assertAllowed(declineOutboundCopy, "recipient may update outbound mirror");
});

test("request response updates reject self-acceptance, outsiders, and identity spoofing", async () => {
  await seedDocument("users/recipient-c/requests/sender-c", {
    peerUid: "sender-c",
    direction: "inbound",
    status: "pending",
  });

  const selfAccept = await updateDocument(
    "sender-c",
    "users/recipient-c/requests/sender-c",
    { status: "accepted" },
  );
  assertDenied(selfAccept, "sender cannot accept their own request");

  const outsiderAccept = await updateDocument(
    "outsider-c",
    "users/recipient-c/requests/sender-c",
    { status: "accepted" },
  );
  assertDenied(outsiderAccept, "unrelated user cannot respond");

  const spoofPeer = await updateDocument(
    "recipient-c",
    "users/recipient-c/requests/sender-c",
    { status: "accepted", peerUid: "outsider-c" },
  );
  assertDenied(spoofPeer, "responder cannot change peer identity");

  const spoofDirection = await updateDocument(
    "recipient-c",
    "users/recipient-c/requests/sender-c",
    { status: "accepted", direction: "outbound" },
  );
  assertDenied(spoofDirection, "responder cannot change request direction");

  await seedDocument("users/recipient-d/requests/sender-d", {
    peerUid: "sender-d",
    direction: "inbound",
    status: "accepted",
  });
  const invalidTransition = await updateDocument(
    "recipient-d",
    "users/recipient-d/requests/sender-d",
    { status: "declined" },
  );
  assertDenied(invalidTransition, "accepted request cannot be changed to declined");
});

test("chat reads follow explicit participants and first-message getAfter batch works", async () => {
  await seedDocument("chats/alice_bob", {
    participants: ["alice", "bob"],
    lastMessage: "seed",
  });
  await seedDocument("chats/alice_bob/messages/seed", {
    from: "alice",
    text: "seed",
  });

  assertAllowed(
    await readDocument("alice", "chats/alice_bob/messages/seed"),
    "participant may read message",
  );
  assertDenied(
    await readDocument("stranger", "chats/alice_bob/messages/seed"),
    "nonparticipant may not read message",
  );

  const createExistingChatMessage = await firestoreRequest(
    "alice",
    "PATCH",
    `${documentsUrl}/chats/alice_bob/messages/alice-reply?currentDocument.exists=false`,
    fieldsBody({ from: "alice", text: "reply" }),
  );
  assertAllowed(
    createExistingChatMessage,
    "participant may send message in existing chat",
  );

  const commitUrl =
    `http://${emulatorHost}/v1/projects/${projectId}` +
    "/databases/(default)/documents:commit";
  const initialBatch = await firestoreRequest("alice", "POST", commitUrl, {
    writes: [
      {
        update: {
          name:
            `projects/${projectId}/databases/(default)/documents/chats/alice_dana`,
          fields: encodeFields({
            participants: ["alice", "dana"],
            lastMessage: "first message",
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name:
            `projects/${projectId}/databases/(default)/documents/chats/alice_dana/messages/first`,
          fields: encodeFields({ from: "alice", text: "first message" }),
        },
        currentDocument: { exists: false },
      },
    ],
  });
  assertAllowed(
    initialBatch,
    "first chat message may atomically create parent using getAfter",
  );
  assertAllowed(
    await readDocument("dana", "chats/alice_dana/messages/first"),
    "new participant may read first message",
  );
  assertDenied(
    await readDocument("stranger", "chats/alice_dana/messages/first"),
    "stranger may not read first message",
  );
});

test("legacy unambiguous sorted chat IDs retain participant fallback", async () => {
  await seedDocument("chats/albert_bob", { lastMessage: "legacy" });
  await seedDocument("chats/albert_bob/messages/legacy", {
    from: "bob",
    text: "legacy message",
  });

  assertAllowed(
    await readDocument("albert", "chats/albert_bob/messages/legacy"),
    "first canonical legacy participant may read",
  );
  assertAllowed(
    await readDocument("bob", "chats/albert_bob/messages/legacy"),
    "second canonical legacy participant may read",
  );
  assertDenied(
    await readDocument("mallory", "chats/albert_bob/messages/legacy"),
    "nonparticipant may not use legacy ID fallback",
  );
});