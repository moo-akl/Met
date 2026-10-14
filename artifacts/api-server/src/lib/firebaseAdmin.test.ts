import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  cert: vi.fn(),
  getApps: vi.fn(),
  getAuth: vi.fn(),
}));

vi.mock("firebase-admin/app", () => ({
  initializeApp: mocks.initialize,
  cert: mocks.cert,
  getApps: mocks.getApps,
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: mocks.getAuth }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: vi.fn() }));
vi.mock("firebase-admin/messaging", () => ({ getMessaging: vi.fn() }));
vi.mock("firebase-admin/storage", () => ({ getStorage: vi.fn() }));
vi.mock("./logger", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.getApps.mockReturnValue([]);
  mocks.initialize.mockReturnValue({ name: "test-admin" });
  mocks.cert.mockReturnValue({ credential: "test-only" });
  mocks.getAuth.mockReturnValue({ name: "test-auth" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Firebase Admin environment configuration", () => {
  it("rejects incomplete JSON without exposing its contents", async () => {
    vi.stubEnv(
      "FIREBASE_SERVICE_ACCOUNT_JSON",
      '"type": "service_account", "private_key": "PRIVATE_TEST_SENTINEL"',
    );
    const { adminAuth } = await import("./firebaseAdmin");
    let failure: unknown;
    try {
      adminAuth();
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("complete, valid JSON object");
    expect((failure as Error).message).not.toContain("PRIVATE_TEST_SENTINEL");
    expect(mocks.initialize).not.toHaveBeenCalled();
    expect(mocks.cert).not.toHaveBeenCalled();
  });

  it.each([
    "null",
    "[]",
    '"a-string"',
    "{}",
    '{"project_id":123,"client_email":"test@example.invalid","private_key":"test"}',
    '{"project_id":"test-project","client_email":" ","private_key":"test"}',
  ])("rejects invalid credential structure without initialization: %s", async (raw) => {
    vi.stubEnv("FIREBASE_SERVICE_ACCOUNT_JSON", raw);
    const { adminAuth } = await import("./firebaseAdmin");
    expect(() => adminAuth()).toThrow("missing required fields");
    expect(mocks.initialize).not.toHaveBeenCalled();
    expect(mocks.cert).not.toHaveBeenCalled();
  });

  it("uses only the configured credential and normalizes escaped newlines", async () => {
    vi.stubEnv("FIREBASE_SERVICE_ACCOUNT_JSON", JSON.stringify({
      project_id: "test-project",
      client_email: "test@example.invalid",
      private_key: "fixture-line-one\\nfixture-line-two",
    }));
    vi.stubEnv("FIREBASE_STORAGE_BUCKET", "test-bucket.example.invalid");
    const { adminAuth } = await import("./firebaseAdmin");
    expect(adminAuth()).toEqual({ name: "test-auth" });
    expect(mocks.cert).toHaveBeenCalledWith({
      projectId: "test-project",
      clientEmail: "test@example.invalid",
      privateKey: "fixture-line-one\nfixture-line-two",
    });
    expect(mocks.initialize).toHaveBeenCalledWith({
      credential: { credential: "test-only" },
      projectId: "test-project",
      storageBucket: "test-bucket.example.invalid",
    });
  });
});
