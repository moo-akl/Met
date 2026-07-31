import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("../lib/logger", () => ({ logger: loggerMocks }));

// We mock globalThis.fetch so the module never makes real HTTP calls.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Response-like object for fetch mocks. */
function makeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const VALID_AASA = {
  applinks: {
    apps: [],
    details: [
      {
        appID: "AWHU9BTQQX.app.met.founders",
        paths: ["/r/*", "/join/*", "/venue-owner", "/venue-owner/*"],
      },
    ],
  },
};

const VALID_ASSET_LINKS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "app.met.founders",
      sha256_cert_fingerprints: [
        "A0:FF:D9:D6:F1:6C:9F:C8:FB:72:7A:84:F6:3E:01:5B:FE:9F:B1:F1:83:A3:ED:0B:AC:00:55:23:5B:3F:42:59",
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// App factory — re-imported each test so env changes take effect
// ---------------------------------------------------------------------------

async function buildApp() {
  vi.resetModules();
  const { default: deepLinkRouter } = await import("./deepLinkCheck");
  const app = express();
  app.use(express.json());
  app.use(deepLinkRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /internal/check-deep-links", () => {
  const CRON_SECRET = "test-secret-xyz";

  beforeEach(() => {
    vi.resetAllMocks();
    process.env["CRON_SECRET"] = CRON_SECRET;
    // Point the module at a fake base URL so tests aren't bound to production.
    process.env["DEEP_LINK_CHECK_BASE_URL"] = "https://fake.example.com";
  });

  afterEach(() => {
    delete process.env["CRON_SECRET"];
    delete process.env["DEEP_LINK_CHECK_BASE_URL"];
  });

  it("rejects requests without the cron secret", async () => {
    const app = await buildApp();
    const res = await request(app).post("/internal/check-deep-links");
    expect(res.status).toBe(401);
  });

  it("rejects requests with the wrong cron secret", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/internal/check-deep-links")
      .set("x-cron-secret", "wrong-secret");
    expect(res.status).toBe(401);
  });

  it("returns ok:true when both files are valid", async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse(VALID_AASA))
      .mockResolvedValueOnce(makeResponse(VALID_ASSET_LINKS));

    const app = await buildApp();
    const res = await request(app)
      .post("/internal/check-deep-links")
      .set("x-cron-secret", CRON_SECRET);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, failures: [] });
    expect(loggerMocks.error).not.toHaveBeenCalled();
    expect(loggerMocks.info).toHaveBeenCalled();
  });

  it("returns ok:false and logs error when apple-app-site-association has wrong appID", async () => {
    const wrongAasa = {
      applinks: {
        details: [{ appID: "WRONGTEAM.app.other.app" }],
      },
    };
    fetchMock
      .mockResolvedValueOnce(makeResponse(wrongAasa))
      .mockResolvedValueOnce(makeResponse(VALID_ASSET_LINKS));

    const app = await buildApp();
    const res = await request(app)
      .post("/internal/check-deep-links")
      .set("x-cron-secret", CRON_SECRET);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.failures).toHaveLength(1);
    expect(res.body.failures[0].error).toMatch(/AWHU9BTQQX\.app\.met\.founders/);
    expect(loggerMocks.error).toHaveBeenCalledOnce();
  });

  it("returns ok:false when apple-app-site-association is missing applinks.details", async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse({ applinks: {} }))
      .mockResolvedValueOnce(makeResponse(VALID_ASSET_LINKS));

    const app = await buildApp();
    const res = await request(app)
      .post("/internal/check-deep-links")
      .set("x-cron-secret", CRON_SECRET);

    expect(res.body.ok).toBe(false);
    expect(res.body.failures[0].error).toMatch(/details is missing/i);
  });

  it("returns ok:false when assetlinks.json has wrong package_name", async () => {
    const wrongLinks = [
      {
        target: {
          package_name: "com.other.app",
          sha256_cert_fingerprints: [
            "A0:FF:D9:D6:F1:6C:9F:C8:FB:72:7A:84:F6:3E:01:5B:FE:9F:B1:F1:83:A3:ED:0B:AC:00:55:23:5B:3F:42:59",
          ],
        },
      },
    ];
    fetchMock
      .mockResolvedValueOnce(makeResponse(VALID_AASA))
      .mockResolvedValueOnce(makeResponse(wrongLinks));

    const app = await buildApp();
    const res = await request(app)
      .post("/internal/check-deep-links")
      .set("x-cron-secret", CRON_SECRET);

    expect(res.body.ok).toBe(false);
    expect(res.body.failures[0].error).toMatch(/package_name/);
  });

  it("returns ok:false when assetlinks.json has wrong SHA-256 fingerprint", async () => {
    const wrongLinks = [
      {
        target: {
          package_name: "app.met.founders",
          sha256_cert_fingerprints: ["AA:BB:CC:DD"],
        },
      },
    ];
    fetchMock
      .mockResolvedValueOnce(makeResponse(VALID_AASA))
      .mockResolvedValueOnce(makeResponse(wrongLinks));

    const app = await buildApp();
    const res = await request(app)
      .post("/internal/check-deep-links")
      .set("x-cron-secret", CRON_SECRET);

    expect(res.body.ok).toBe(false);
    expect(res.body.failures[0].error).toMatch(/SHA-256/);
  });

  it("returns ok:false when assetlinks.json is not a JSON array", async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse(VALID_AASA))
      .mockResolvedValueOnce(makeResponse({ notAnArray: true }));

    const app = await buildApp();
    const res = await request(app)
      .post("/internal/check-deep-links")
      .set("x-cron-secret", CRON_SECRET);

    expect(res.body.ok).toBe(false);
    expect(res.body.failures[0].error).toMatch(/not a JSON array/);
  });

  it("returns ok:false and logs error when a network request fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Connection refused"));
    fetchMock.mockResolvedValueOnce(makeResponse(VALID_ASSET_LINKS));

    const app = await buildApp();
    const res = await request(app)
      .post("/internal/check-deep-links")
      .set("x-cron-secret", CRON_SECRET);

    expect(res.body.ok).toBe(false);
    expect(res.body.failures[0].error).toMatch(/Connection refused/);
    expect(loggerMocks.error).toHaveBeenCalledOnce();
  });

  it("returns ok:false and logs error when HTTP response is non-200", async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse(null, 404))
      .mockResolvedValueOnce(makeResponse(VALID_ASSET_LINKS));

    const app = await buildApp();
    const res = await request(app)
      .post("/internal/check-deep-links")
      .set("x-cron-secret", CRON_SECRET);

    expect(res.body.ok).toBe(false);
    expect(res.body.failures[0].error).toMatch(/HTTP 404/);
  });

  it("reports both failures when both files are broken", async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse(null, 500))
      .mockResolvedValueOnce(makeResponse(null, 503));

    const app = await buildApp();
    const res = await request(app)
      .post("/internal/check-deep-links")
      .set("x-cron-secret", CRON_SECRET);

    expect(res.body.ok).toBe(false);
    expect(res.body.failures).toHaveLength(2);
    expect(loggerMocks.error).toHaveBeenCalledTimes(2);
  });
});
