/**
 * Validates a website URL string.
 * Returns an error message string, or "" if valid (or empty).
 */
export function validateWebsiteUrl(value: string): string {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "Website URL must start with https:// or http://.";
    }
    return "";
  } catch {
    return "Enter a valid URL, e.g. https://yourvenue.com";
  }
}

/**
 * Applies the on-blur auto-prefix logic to a raw website URL input value.
 * If the value is non-empty and lacks a protocol, "https://" is prepended.
 * Returns the (possibly prefixed) value and any validation error.
 */
export function applyWebsiteUrlBlur(raw: string): { value: string; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: trimmed, error: "" };
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    const prefixed = "https://" + trimmed;
    return { value: prefixed, error: validateWebsiteUrl(prefixed) };
  }
  return { value: trimmed, error: validateWebsiteUrl(trimmed) };
}
