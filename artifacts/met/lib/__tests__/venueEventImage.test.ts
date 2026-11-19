import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { MAX_VENUE_EVENT_IMAGE_BYTES, prepareVenueEventImage } from "../venueEventImage";

jest.mock("expo-file-system/legacy", () => ({
  getInfoAsync: jest.fn(),
}));

jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  manipulateAsync: jest.fn(),
}));

const mockGetInfo = FileSystem.getInfoAsync as jest.Mock;
const mockManipulate = ImageManipulator.manipulateAsync as jest.Mock;

describe("prepareVenueEventImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockManipulate.mockResolvedValue({
      uri: "file:///prepared.jpg",
      width: 1600,
      height: 900,
    });
    mockGetInfo.mockResolvedValue({ exists: true, size: 2_000_000 });
  });

  it("returns a compressed file URI instead of encoding the image as base64", async () => {
    await expect(
      prepareVenueEventImage("file:///source.jpg", 4000),
    ).resolves.toEqual({
      uri: "file:///prepared.jpg",
      size: 2_000_000,
      contentType: "image/jpeg",
    });
    expect(mockManipulate).toHaveBeenCalledWith(
      "file:///source.jpg",
      [{ resize: { width: 1600 } }],
      { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
    );
    expect(mockManipulate.mock.calls[0]?.[2]).not.toHaveProperty("base64");
  });

  it("enforces the existing 4 MiB photo limit using the prepared file size", async () => {
    mockGetInfo.mockResolvedValue({
      exists: true,
      size: MAX_VENUE_EVENT_IMAGE_BYTES + 1,
    });

    await expect(
      prepareVenueEventImage("file:///large.jpg", 2000),
    ).rejects.toThrow("This photo is still too large.");
  });

  it("fails if the prepared local file is missing", async () => {
    mockGetInfo.mockResolvedValue({ exists: false });

    await expect(
      prepareVenueEventImage("file:///missing.jpg", 800),
    ).rejects.toThrow("Could not read the selected photo.");
  });
});
