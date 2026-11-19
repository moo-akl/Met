import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.72;
export const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024;

export async function prepareChatImage(
  uri: string,
  width?: number,
  height?: number,
  mimeType?: string | null,
  fileSize?: number | null,
): Promise<{ uri: string; size: number | null }> {
  const longestEdge = Math.max(width ?? 0, height ?? 0);
  if (
    mimeType === "image/jpeg" &&
    width != null &&
    height != null &&
    longestEdge <= MAX_EDGE &&
    fileSize != null &&
    fileSize <= MAX_CHAT_IMAGE_BYTES
  ) {
    const sourceInfo = await FileSystem.getInfoAsync(uri);
    const sourceSize =
      "size" in sourceInfo && typeof sourceInfo.size === "number"
        ? sourceInfo.size
        : fileSize;
    if (sourceInfo.exists && sourceSize <= MAX_CHAT_IMAGE_BYTES) {
      return { uri, size: sourceSize };
    }
  }

  const actions: ImageManipulator.Action[] =
    longestEdge > MAX_EDGE
      ? width != null && height != null && width >= height
        ? [{ resize: { width: MAX_EDGE } }]
        : [{ resize: { height: MAX_EDGE } }]
      : [];

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const info = await FileSystem.getInfoAsync(result.uri);
  if (!info.exists) {
    throw new Error("Could not prepare this photo. Please try another image.");
  }
  const size = "size" in info && typeof info.size === "number" ? info.size : null;
  if (size != null && size > MAX_CHAT_IMAGE_BYTES) {
    throw new Error("This photo is still too large. Please choose a smaller image.");
  }
  return { uri: result.uri, size };
}
