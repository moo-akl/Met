import { describe, expect, it } from "vitest";
import {
  getSupportedImageContentType,
  imageMagicMatchesContentType,
} from "./imageMagic.js";

describe("supported image content types", () => {
  it("accepts JPEG and PNG response content types", () => {
    expect(getSupportedImageContentType("image/jpeg")).toBe("image/jpeg");
    expect(getSupportedImageContentType("image/png; charset=binary")).toBe("image/png");
  });

  it("rejects unsupported or missing response content types", () => {
    expect(getSupportedImageContentType("image/gif")).toBeNull();
    expect(getSupportedImageContentType("text/html")).toBeNull();
    expect(getSupportedImageContentType(null)).toBeNull();
  });

  it("requires the image bytes to match the declared type", () => {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(imageMagicMatchesContentType(jpegHeader, "image/jpeg")).toBe(true);
    expect(imageMagicMatchesContentType(pngHeader, "image/png")).toBe(true);
    expect(imageMagicMatchesContentType(pngHeader, "image/jpeg")).toBe(false);
    expect(imageMagicMatchesContentType(jpegHeader, "image/png")).toBe(false);
  });
});
