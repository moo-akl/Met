import { vi, describe, it, expect, beforeAll } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock handles — defined before vi.mock() factory runs.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockMakePublic = vi.fn().mockResolvedValue(undefined);
  const mockSetMetadata = vi.fn().mockResolvedValue(undefined);
  const mockFile = vi.fn(() => ({
    save: mockSave,
    makePublic: mockMakePublic,
    setMetadata: mockSetMetadata,
  }));
  const mockBucket = vi.fn(() => ({ name: "test-bucket", file: mockFile }));
  const mockAdminStorage = vi.fn(() => ({ bucket: mockBucket }));
  const mockModerateImage = vi.fn().mockResolvedValue({ safe: true });

  return {
    mockSave,
    mockMakePublic,
    mockSetMetadata,
    mockFile,
    mockBucket,
    mockAdminStorage,
    mockModerateImage,
  };
});

vi.mock("../lib/firebaseAdmin", () => ({
  adminStorage: mocks.mockAdminStorage,
  adminAuth: vi.fn(),
  adminDb: vi.fn(),
  tryInitAdmin: vi.fn(() => null),
}));

vi.mock("../lib/contentModeration", () => ({
  moderateImage: mocks.mockModerateImage,
}));

// ---------------------------------------------------------------------------
// App — imported after mocks are registered so mocked modules are in place.
// ---------------------------------------------------------------------------

import request from "supertest";
import app from "../app";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a base64 string that begins with the given magic bytes and is padded
 * to exactly 48 raw bytes so the encoded string meets the Zod min(64) guard.
 */
function makeBase64(magic: number[]): string {
  const buf = Buffer.alloc(48);
  magic.forEach((byte, i) => buf.writeUInt8(byte, i));
  return buf.toString("base64");
}

const JPEG_B64 = makeBase64([0xff, 0xd8, 0xff]);
const PNG_B64 = makeBase64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const INVALID_B64 = makeBase64([0x00, 0x00, 0x00]);

/** Posts to the photo upload endpoint with the given UID (dev bypass). */
function uploadAs(uid: string, base64: string) {
  return request(app)
    .post("/api/profiles/me/photo")
    .set("x-met-uid", uid)
    .send({ base64 });
}

// ---------------------------------------------------------------------------
// Ensure no real Redis connection is attempted.
// ---------------------------------------------------------------------------

beforeAll(() => {
  delete process.env["REDIS_URL"];
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/profiles/me/photo", () => {
  describe("magic-byte validation", () => {
    it("accepts a valid JPEG payload and returns 200 with a photoUrl", async () => {
      const res = await uploadAs("uid-jpeg-test", JPEG_B64);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("photoUrl");
      expect(typeof res.body.photoUrl).toBe("string");
      expect(res.body.photoUrl.length).toBeGreaterThan(0);
    });

    it("accepts a valid PNG payload and returns 200 with a photoUrl", async () => {
      const res = await uploadAs("uid-png-test", PNG_B64);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("photoUrl");
      expect(typeof res.body.photoUrl).toBe("string");
    });

    it("rejects a non-JPEG/PNG payload with 415 Unsupported Media Type", async () => {
      const res = await uploadAs("uid-415-test", INVALID_B64);

      expect(res.status).toBe(415);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toMatch(/unsupported media type/i);
    });
  });

  describe("content moderation", () => {
    it("returns 200 when moderateImage returns safe:true", async () => {
      mocks.mockModerateImage.mockResolvedValueOnce({ safe: true });
      const res = await uploadAs("uid-mod-safe", JPEG_B64);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("photoUrl");
    });

    it("returns 422 when moderateImage returns safe:false (adult content)", async () => {
      mocks.mockModerateImage.mockResolvedValueOnce({
        safe: false,
        reason: "This photo contains adult content and can't be used as a profile photo. Please choose a different photo.",
      });
      const res = await uploadAs("uid-mod-adult", JPEG_B64);
      expect(res.status).toBe(422);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toMatch(/adult content/i);
    });

    it("returns 422 when moderateImage returns safe:false (violence)", async () => {
      mocks.mockModerateImage.mockResolvedValueOnce({
        safe: false,
        reason: "This photo contains violent content and can't be used as a profile photo. Please choose a different photo.",
      });
      const res = await uploadAs("uid-mod-violence", JPEG_B64);
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/violent content/i);
    });

    it("does NOT call adminStorage when moderation rejects the image", async () => {
      mocks.mockModerateImage.mockResolvedValueOnce({
        safe: false,
        reason: "Community guidelines.",
      });
      mocks.mockSave.mockClear();
      await uploadAs("uid-mod-no-storage", JPEG_B64);
      expect(mocks.mockSave).not.toHaveBeenCalled();
    });

    it("allows upload when moderateImage throws unexpectedly (fail-open)", async () => {
      // Simulates an unexpected throw from the moderation module itself.
      // The route catches this and treats it as safe so uploads are never blocked.
      mocks.mockModerateImage.mockRejectedValueOnce(new Error("Vision API down"));
      const res = await uploadAs("uid-mod-failopen", JPEG_B64);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("photoUrl");
    });
  });

  describe("rate limiting (5 req/min per user)", () => {
    it("allows the first 5 requests and blocks the 6th with 429 and Retry-After", async () => {
      const uid = "uid-rl-burst-test";

      for (let i = 1; i <= 5; i++) {
        const res = await uploadAs(uid, JPEG_B64);
        expect(res.status).toBe(200);
      }

      const blocked = await uploadAs(uid, JPEG_B64);

      expect(blocked.status).toBe(429);
      expect(blocked.body).toHaveProperty("message");
      expect(blocked.body.message).toMatch(/too many requests/i);

      const retryAfter = Number(blocked.headers["retry-after"]);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });
  });
});
