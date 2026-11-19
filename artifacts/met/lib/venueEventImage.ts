import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

const MAX_WIDTH = 1600;
export const MAX_VENUE_EVENT_IMAGE_BYTES = 4 * 1024 * 1024;

export async function prepareVenueEventImage(uri: string, width: number) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    width > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [],
    {
      compress: 0.78,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  const info = await FileSystem.getInfoAsync(result.uri);
  if (!info.exists) {
    throw new Error("Could not read the selected photo.");
  }
  const size = "size" in info && typeof info.size === "number" ? info.size : null;
  if (size != null && size > MAX_VENUE_EVENT_IMAGE_BYTES) {
    throw new Error("This photo is still too large. Please choose a smaller image.");
  }

  return {
    uri: result.uri,
    size,
    contentType: "image/jpeg",
  };
}
