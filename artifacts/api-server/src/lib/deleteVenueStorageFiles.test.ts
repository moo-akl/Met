import { describe, it, expect, vi } from "vitest";
import { resolveVenueStoragePath, deleteVenueStorageFiles } from "./deleteVenueStorageFiles";

// ---------------------------------------------------------------------------
// Mock adminStorage so deleteVenueStorageFiles tests do not require Firebase.
// ---------------------------------------------------------------------------

const mockDelete = vi.fn().mockResolvedValue(undefined);
const mockFile = vi.fn(() => ({ delete: mockDelete }));
const mockBucket = { name: "my-project.firebasestorage.app", file: mockFile };

vi.mock("./firebaseAdmin", () => ({
  adminStorage: vi.fn(() => ({ bucket: () => mockBucket })),
}));

vi.mock("./logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
const objectFileDelete = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const getObjectFile = vi.hoisted(() => vi.fn().mockResolvedValue({ delete: objectFileDelete }));
vi.mock("./objectStorage", () => ({
  ObjectStorageService: class { getObjectEntityFile = getObjectFile; },
  ObjectNotFoundError: class extends Error {},
}));

const BUCKET = "my-project.firebasestorage.app";

describe("additional venue file cleanup", () => {
  it("reports cleanup failure when admin deletion requires completion", async () => {
    objectFileDelete.mockRejectedValueOnce(new Error("temporary storage failure"));
    await expect(deleteVenueStorageFiles(
      ["/api/storage/objects/uploads/5c2a6b71-f6b8-42ee-832c-562c73f13798"],
      {}, { requireComplete: true },
    )).rejects.toThrow("Venue file cleanup could not finish");
  });
  it("removes exclusively referenced App Storage images", async () => {
    getObjectFile.mockClear(); objectFileDelete.mockClear();
    const path = "/objects/uploads/5c2a6b71-f6b8-42ee-832c-562c73f13798";
    await deleteVenueStorageFiles([`/api/storage${path}`, `/api/storage${path}`]);
    expect(getObjectFile).toHaveBeenCalledExactlyOnceWith(path);
    expect(objectFileDelete).toHaveBeenCalledExactlyOnceWith({ ignoreNotFound: true });
  });
  it("does not resolve traversal, malformed paths, or external hosts into private uploads", async () => {
    getObjectFile.mockClear();
    await deleteVenueStorageFiles([
      "/api/storage/objects/uploads/../../personal-file",
      "/api/storage/objects/uploads/not-a-uuid",
      "https://untrusted.example/api/storage/objects/uploads/5c2a6b71-f6b8-42ee-832c-562c73f13798",
    ]);
    expect(getObjectFile).not.toHaveBeenCalled();
  });
  it.each(["venue-announcement-images/", "venue-verification-docs/"])("recognizes %s in the configured Firebase bucket only", (prefix) => {
    expect(resolveVenueStoragePath(`https://storage.googleapis.com/${BUCKET}/${prefix}uid/file.jpg`, BUCKET)).toBe(`${prefix}uid/file.jpg`);
    expect(resolveVenueStoragePath(`https://storage.googleapis.com/another-bucket/${prefix}uid/file.jpg`, BUCKET)).toBeNull();
  });
});

describe("resolveVenueStoragePath — GCS URL form", () => {
  it("resolves a valid cover photo URL to its object path", () => {
    const url = `https://storage.googleapis.com/${BUCKET}/venue-profile-photos/uid-123/cover-1000.jpg`;
    expect(resolveVenueStoragePath(url, BUCKET)).toBe(
      "venue-profile-photos/uid-123/cover-1000.jpg",
    );
  });

  it("resolves a valid event image URL to its object path", () => {
    const url = `https://storage.googleapis.com/${BUCKET}/venue-event-images/uid-123/event-999.jpg`;
    expect(resolveVenueStoragePath(url, BUCKET)).toBe(
      "venue-event-images/uid-123/event-999.jpg",
    );
  });

  it("returns null for a different (hostile) bucket name", () => {
    const url = `https://storage.googleapis.com/hostile-bucket/venue-profile-photos/uid-123/cover.jpg`;
    expect(resolveVenueStoragePath(url, BUCKET)).toBeNull();
  });

  it("returns null for a path outside the allowed prefixes", () => {
    const url = `https://storage.googleapis.com/${BUCKET}/system/admin/secret.json`;
    expect(resolveVenueStoragePath(url, BUCKET)).toBeNull();
  });

  it("returns null for an arbitrary http URL with no bucket segment", () => {
    expect(resolveVenueStoragePath("https://example.com/venue-profile-photos/x.jpg", BUCKET)).toBeNull();
  });
});

describe("resolveVenueStoragePath — Firebase Storage URL form", () => {
  it("resolves a valid Firebase Storage URL to its decoded object path", () => {
    const encoded = encodeURIComponent("venue-profile-photos/uid-123/logo-456.jpg");
    const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encoded}?alt=media&token=abc`;
    expect(resolveVenueStoragePath(url, BUCKET)).toBe(
      "venue-profile-photos/uid-123/logo-456.jpg",
    );
  });

  it("returns null for a Firebase Storage URL targeting a different bucket", () => {
    const encoded = encodeURIComponent("venue-profile-photos/uid-123/logo.jpg");
    const url = `https://firebasestorage.googleapis.com/v0/b/hostile-bucket/o/${encoded}?alt=media`;
    expect(resolveVenueStoragePath(url, BUCKET)).toBeNull();
  });

  it("returns null for a Firebase Storage URL with a disallowed path prefix", () => {
    const encoded = encodeURIComponent("private-data/uid-123/secret.json");
    const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encoded}?alt=media`;
    expect(resolveVenueStoragePath(url, BUCKET)).toBeNull();
  });
});

describe("resolveVenueStoragePath — edge cases", () => {
  it("returns null for a completely unrecognised URL scheme", () => {
    expect(resolveVenueStoragePath("ftp://files.example.com/photo.jpg", BUCKET)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(resolveVenueStoragePath("", BUCKET)).toBeNull();
  });

  it("returns null when the URL bucket matches but path has no prefix at all", () => {
    const url = `https://storage.googleapis.com/${BUCKET}/orphan-file.jpg`;
    expect(resolveVenueStoragePath(url, BUCKET)).toBeNull();
  });
});

describe("resolveVenueStoragePath — malformed percent-encoding", () => {
  it("returns null (does not throw) for a GCS URL with an invalid percent escape in the path", () => {
    // %ZZ is not a valid percent-encoded byte — decodeURIComponent would throw.
    const url = `https://storage.googleapis.com/${BUCKET}/venue-profile-photos/uid/bad%ZZfile.jpg`;
    expect(() => resolveVenueStoragePath(url, BUCKET)).not.toThrow();
    expect(resolveVenueStoragePath(url, BUCKET)).toBeNull();
  });

  it("returns null (does not throw) for a Firebase Storage URL with malformed encoding", () => {
    // Manually construct a Firebase URL whose encoded path segment is invalid.
    const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/venue-profile-photos%2Fuid%2Fbad%ZZfile.jpg?alt=media`;
    expect(() => resolveVenueStoragePath(url, BUCKET)).not.toThrow();
    expect(resolveVenueStoragePath(url, BUCKET)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Full deleteVenueStorageFiles — non-throwing behavior with malformed input
// ---------------------------------------------------------------------------

describe("deleteVenueStorageFiles — malformed URL input does not abort cleanup", () => {
  it("completes without throwing when a GCS URL contains a malformed percent escape", async () => {
    mockFile.mockClear();
    const malformedUrl = `https://storage.googleapis.com/${BUCKET}/venue-profile-photos/uid/bad%ZZfile.jpg`;

    await expect(
      deleteVenueStorageFiles([malformedUrl]),
    ).resolves.toBeUndefined();

    // The malformed path must be skipped — no bucket.file() call should occur.
    expect(mockFile).not.toHaveBeenCalled();
  });

  it("deletes valid URLs that appear alongside a malformed URL in the same batch", async () => {
    mockFile.mockClear();
    mockDelete.mockClear();

    const validUrl = `https://storage.googleapis.com/${BUCKET}/venue-profile-photos/uid/valid.jpg`;
    const malformedUrl = `https://storage.googleapis.com/${BUCKET}/venue-profile-photos/uid/bad%ZZfile.jpg`;

    await expect(
      deleteVenueStorageFiles([malformedUrl, validUrl, null]),
    ).resolves.toBeUndefined();

    // Only the valid URL should have been passed to bucket.file().
    expect(mockFile).toHaveBeenCalledTimes(1);
    expect(mockFile).toHaveBeenCalledWith("venue-profile-photos/uid/valid.jpg");
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});
