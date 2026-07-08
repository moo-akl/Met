export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "x"
  | "tiktok"
  | "snapchat"
  | "linkedin";

const HANDLE_REGEX: Record<SocialPlatform, RegExp> = {
  instagram: /^[a-zA-Z0-9_.]{1,30}$/,
  facebook: /^[a-zA-Z0-9.]{5,50}$/,
  x: /^[a-zA-Z0-9_]{1,15}$/,
  tiktok: /^[a-zA-Z0-9_.]{1,24}$/,
  snapchat: /^[a-zA-Z0-9_\-.]{3,15}$/,
  linkedin: /^[a-zA-Z0-9\-]{3,100}$/,
};

const PROFILE_URL: Record<SocialPlatform, (h: string) => string> = {
  instagram: (h) => `https://www.instagram.com/${h}/`,
  facebook: (h) => `https://www.facebook.com/${h}/`,
  x: (h) => `https://x.com/${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  snapchat: (h) => `https://www.snapchat.com/add/${h}`,
  linkedin: (h) => `https://www.linkedin.com/in/${h}`,
};

export function validateHandle(
  platform: SocialPlatform,
  handle: string,
): { valid: boolean; message: string } {
  const clean = handle.replace(/^@/, "").trim();
  if (!clean) return { valid: true, message: "" };
  if (!HANDLE_REGEX[platform].test(clean)) {
    return { valid: false, message: "Invalid handle format" };
  }
  return { valid: true, message: "" };
}

export function getProfileUrl(platform: SocialPlatform, handle: string): string {
  const clean = handle.replace(/^@/, "").trim();
  return PROFILE_URL[platform](clean);
}

export async function checkHandleReachable(
  platform: SocialPlatform,
  handle: string,
): Promise<boolean> {
  const url = getProfileUrl(platform, handle);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    return res.status !== 404;
  } catch {
    return true;
  } finally {
    clearTimeout(timeout);
  }
}
