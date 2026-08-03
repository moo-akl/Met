import { describe, expect, it } from "vitest";
import { validateWebsiteUrl, applyWebsiteUrlBlur } from "../lib/websiteUrl";

// ---------------------------------------------------------------------------
// validateWebsiteUrl
// ---------------------------------------------------------------------------

describe("validateWebsiteUrl", () => {
  it("returns empty string for an empty value", () => {
    expect(validateWebsiteUrl("")).toBe("");
  });

  it("accepts a valid https URL", () => {
    expect(validateWebsiteUrl("https://yourvenue.com")).toBe("");
  });

  it("accepts a valid http URL", () => {
    expect(validateWebsiteUrl("http://yourvenue.com")).toBe("");
  });

  it("accepts a URL with a path and query", () => {
    expect(validateWebsiteUrl("https://yourvenue.com/book?ref=met")).toBe("");
  });

  it("rejects a bare domain without a protocol", () => {
    expect(validateWebsiteUrl("yourvenue.com")).not.toBe("");
  });

  it("rejects a non-http/https protocol", () => {
    expect(validateWebsiteUrl("ftp://yourvenue.com")).not.toBe("");
  });

  it("rejects obviously bad input", () => {
    expect(validateWebsiteUrl("not a url at all")).not.toBe("");
  });

  it("rejects just a slash", () => {
    expect(validateWebsiteUrl("/path/only")).not.toBe("");
  });
});

// ---------------------------------------------------------------------------
// applyWebsiteUrlBlur
// ---------------------------------------------------------------------------

describe("applyWebsiteUrlBlur", () => {
  it("returns empty value and no error for an empty string", () => {
    expect(applyWebsiteUrlBlur("")).toEqual({ value: "", error: "" });
  });

  it("returns empty value and no error for a whitespace-only string", () => {
    expect(applyWebsiteUrlBlur("   ")).toEqual({ value: "", error: "" });
  });

  it("prefixes https:// on a bare domain", () => {
    const { value, error } = applyWebsiteUrlBlur("yourvenue.com");
    expect(value).toBe("https://yourvenue.com");
    expect(error).toBe("");
  });

  it("prefixes https:// on a bare domain with a path", () => {
    const { value } = applyWebsiteUrlBlur("yourvenue.com/book");
    expect(value).toBe("https://yourvenue.com/book");
  });

  it("trims leading and trailing whitespace before prefixing", () => {
    const { value } = applyWebsiteUrlBlur("  yourvenue.com  ");
    expect(value).toBe("https://yourvenue.com");
  });

  it("does not double-prefix an https URL", () => {
    const { value } = applyWebsiteUrlBlur("https://yourvenue.com");
    expect(value).toBe("https://yourvenue.com");
  });

  it("does not double-prefix an http URL", () => {
    const { value } = applyWebsiteUrlBlur("http://yourvenue.com");
    expect(value).toBe("http://yourvenue.com");
  });

  it("returns no error for a valid prefixed URL", () => {
    const { error } = applyWebsiteUrlBlur("https://yourvenue.com");
    expect(error).toBe("");
  });

  it("returns an error for https:// with no hostname", () => {
    // "https://" already has a protocol prefix so it is not modified, but it
    // fails URL validation because there is no host.
    const { value, error } = applyWebsiteUrlBlur("https://");
    expect(value).toBe("https://");
    expect(error).not.toBe("");
  });
});
