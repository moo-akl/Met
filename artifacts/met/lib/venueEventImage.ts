import * as ImageManipulator from "expo-image-manipulator";

const MAX_WIDTH = 1600;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function prepareVenueEventImage(uri: string, width: number) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    width > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [],
    {
      compress: 0.78,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );

  if (!result.base64) {
    throw new Error("Could not read the selected photo.");
  }

  const byteSize = Math.floor((result.base64.length * 3) / 4);
  if (byteSize > MAX_UPLOAD_BYTES) {
    throw new Error("This photo is still too large. Please choose a smaller image.");
  }

  return { base64: result.base64, contentType: "image/jpeg" };
}
