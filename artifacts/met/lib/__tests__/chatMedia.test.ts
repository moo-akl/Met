import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { MAX_CHAT_IMAGE_BYTES, prepareChatImage } from "../chatMedia";

jest.mock("expo-file-system/legacy", () => ({
  getInfoAsync: jest.fn(),
}));

jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  manipulateAsync: jest.fn(),
}));

const mockGetInfo = FileSystem.getInfoAsync as jest.Mock;
const mockManipulate = ImageManipulator.manipulateAsync as jest.Mock;

describe("prepareChatImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockManipulate.mockResolvedValue({ uri: "file:///prepared.jpg", width: 1280, height: 720 });
    mockGetInfo.mockResolvedValue({ exists: true, size: 1_000_000 });
  });

  it("resizes landscape photos, compresses to JPEG, and checks the prepared file", async () => {
    await expect(prepareChatImage("file:///source.heic", 4032, 2268)).resolves.toEqual({
      uri: "file:///prepared.jpg",
      size: 1_000_000,
    });
    expect(mockManipulate).toHaveBeenCalledWith(
      "file:///source.heic",
      [{ resize: { width: 1280 } }],
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
    );
    expect(mockGetInfo).toHaveBeenCalledWith("file:///prepared.jpg");
  });

  it("resizes portrait photos by height and keeps small images unscaled", async () => {
    await prepareChatImage("file:///portrait.jpg", 1080, 2400);
    expect(mockManipulate).toHaveBeenLastCalledWith(
      "file:///portrait.jpg",
      [{ resize: { height: 1280 } }],
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
    );

    await prepareChatImage("file:///small.jpg", 800, 600);
    expect(mockManipulate).toHaveBeenLastCalledWith(
      "file:///small.jpg",
      [],
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
    );
  });

  it("reuses a compliant small JPEG without spending time recompressing it", async () => {
    await expect(
      prepareChatImage("file:///small.jpg", 1200, 900, "image/jpeg", 420_000),
    ).resolves.toEqual({ uri: "file:///small.jpg", size: 1_000_000 });
    expect(mockManipulate).not.toHaveBeenCalled();
    expect(mockGetInfo).toHaveBeenCalledWith("file:///small.jpg");
  });

  it("resizes a high-resolution JPEG even when it is under the size limit", async () => {
    await expect(
      prepareChatImage("file:///large-dimensions.jpg", 4032, 3024, "image/jpeg", 4_000_000),
    ).resolves.toEqual({ uri: "file:///prepared.jpg", size: 1_000_000 });
    expect(mockManipulate).toHaveBeenCalledWith(
      "file:///large-dimensions.jpg",
      [{ resize: { width: 1280 } }],
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
    );
  });

  it("recompresses a JPEG when its actual file exceeds the size limit", async () => {
    mockGetInfo
      .mockResolvedValueOnce({
        exists: true,
        size: MAX_CHAT_IMAGE_BYTES + 1,
      })
      .mockResolvedValueOnce({ exists: true, size: 1_000_000 });

    await expect(
      prepareChatImage("file:///photo.jpg", 1200, 900, "image/jpeg", 1_000_000),
    ).resolves.toEqual({ uri: "file:///prepared.jpg", size: 1_000_000 });
    expect(mockManipulate).toHaveBeenCalledWith(
      "file:///photo.jpg",
      [],
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
    );
  });

  it("still converts small non-JPEG photos for the JPEG upload endpoint", async () => {
    await prepareChatImage("file:///small.heic", 1200, 900, "image/heic", 420_000);
    expect(mockManipulate).toHaveBeenCalledWith(
      "file:///small.heic",
      [],
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
    );
  });

  it("rejects a prepared photo that still exceeds the chat upload limit", async () => {
    mockGetInfo.mockResolvedValue({ exists: true, size: MAX_CHAT_IMAGE_BYTES + 1 });
    await expect(prepareChatImage("file:///large.jpg", 1600, 900)).rejects.toThrow(
      "This photo is still too large.",
    );
  });

  it("fails explicitly if the prepared image file is missing", async () => {
    mockGetInfo.mockResolvedValue({ exists: false });
    await expect(prepareChatImage("file:///missing.jpg")).rejects.toThrow(
      "Could not prepare this photo.",
    );
  });
});
