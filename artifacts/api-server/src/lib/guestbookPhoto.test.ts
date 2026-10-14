import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  moderate: vi.fn(), save: vi.fn(), remove: vi.fn(),
}));
vi.mock("./contentModeration", () => ({ moderateImage: mocks.moderate }));
vi.mock("./firebaseAdmin", () => ({
  adminStorage: () => ({ bucket: () => ({
    name: "test-bucket", file: () => ({ save: mocks.save, delete: mocks.remove }),
  }) }),
}));
import { saveGuestbookPhoto, stripJpegMetadata } from "./guestbookPhoto";
// Segment fixture: EXIF APP1 contains synthetic GPS metadata; SOS starts pixels.
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 9, ...Buffer.from("GPSdata"), 0xff, 0xda, 0, 2, 1, 0xff, 0xd9]);
beforeEach(() => {
  mocks.moderate.mockReset().mockResolvedValue({ safe: true, faceCount: 0 });
  mocks.save.mockReset().mockResolvedValue(undefined);
  mocks.remove.mockReset().mockResolvedValue(undefined);
});
describe("visit photo safeguards", () => {
  it("strips camera location metadata before moderation or storage", async () => {
    expect(stripJpegMetadata(jpeg).includes(Buffer.from("GPSdata"))).toBe(false);
    await saveGuestbookPhoto("visitor", jpeg.toString("base64"));
    expect(mocks.moderate).toHaveBeenCalledWith(stripJpegMetadata(jpeg).toString("base64"), { failClosed: true });
    expect(mocks.save.mock.calls[0]![0].includes(Buffer.from("GPSdata"))).toBe(false);
  });
  it("accepts a safe place photo without a face and stores a durable object", async () => {
    const result = await saveGuestbookPhoto("visitor", jpeg.toString("base64"));
    expect(result.path).toMatch(/^venue-guestbook\/visitor\/.+\.jpg$/);
    expect(result.url).toContain("firebasestorage.googleapis.com");
    expect(mocks.save).toHaveBeenCalledOnce();
  });
  it("fails closed during moderation outages", async () => {
    mocks.moderate.mockRejectedValue(new Error("Vision unavailable"));
    await expect(saveGuestbookPhoto("visitor", jpeg.toString("base64"))).rejects.toMatchObject({ status: 503 });
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("does not upload an unsafe photo", async () => {
    mocks.moderate.mockResolvedValue({ safe: false, faceCount: 0, reason: "Unsafe" });
    await expect(saveGuestbookPhoto("visitor", jpeg.toString("base64"))).rejects.toMatchObject({ status: 422 });
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it.each(["aGVsbG8=", "data:image/jpeg;base64,abc", "%%%"])("rejects malformed or non-JPEG input", async input => {
    await expect(saveGuestbookPhoto("visitor", input)).rejects.toMatchObject({ status: 400 });
    expect(mocks.moderate).not.toHaveBeenCalled();
  });
});
