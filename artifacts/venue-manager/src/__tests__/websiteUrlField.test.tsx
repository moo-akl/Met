/**
 * UI/integration test: verifies the website URL input auto-prefixes "https://"
 * when a user types a bare domain and blurs the field.
 *
 * We render a minimal React component that replicates the exact blur logic from
 * VenueProfile (using the shared `applyWebsiteUrlBlur` helper) so the test
 * exercises the real production code path.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { applyWebsiteUrlBlur } from "../lib/websiteUrl";

function WebsiteUrlField() {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [websiteUrlError, setWebsiteUrlError] = useState("");

  function handleWebsiteUrlBlur() {
    const { value, error } = applyWebsiteUrlBlur(websiteUrl);
    setWebsiteUrl(value);
    setWebsiteUrlError(error);
  }

  return (
    <div>
      <label htmlFor="websiteUrl">Website</label>
      <input
        id="websiteUrl"
        data-testid="website-url"
        name="websiteUrl"
        type="text"
        value={websiteUrl}
        placeholder="https://yourvenue.com"
        onChange={(e) => {
          setWebsiteUrl(e.target.value);
          if (websiteUrlError) setWebsiteUrlError("");
        }}
        onBlur={handleWebsiteUrlBlur}
      />
      {websiteUrlError && (
        <span data-testid="website-url-error">{websiteUrlError}</span>
      )}
    </div>
  );
}

describe("Website URL field blur behaviour", () => {
  it("auto-prefixes https:// when the user types a bare domain and blurs", async () => {
    const user = userEvent.setup();
    render(<WebsiteUrlField />);

    const input = screen.getByTestId("website-url");
    await user.type(input, "yourvenue.com");
    await user.tab(); // triggers blur

    expect(input).toHaveValue("https://yourvenue.com");
    expect(screen.queryByTestId("website-url-error")).not.toBeInTheDocument();
  });

  it("does not modify an already valid https URL on blur", async () => {
    const user = userEvent.setup();
    render(<WebsiteUrlField />);

    const input = screen.getByTestId("website-url");
    await user.type(input, "https://yourvenue.com");
    await user.tab();

    expect(input).toHaveValue("https://yourvenue.com");
    expect(screen.queryByTestId("website-url-error")).not.toBeInTheDocument();
  });

  it("shows a validation error when the user types https:// with no hostname", async () => {
    // "https://" already has a protocol so it won't be prefixed, but it's
    // invalid because there is no hostname — the error span should appear.
    const user = userEvent.setup();
    render(<WebsiteUrlField />);

    const input = screen.getByTestId("website-url");
    await user.type(input, "https://");
    await user.tab();

    expect(input).toHaveValue("https://");
    expect(screen.getByTestId("website-url-error")).toBeInTheDocument();
  });

  it("leaves an empty field unchanged on blur", async () => {
    const user = userEvent.setup();
    render(<WebsiteUrlField />);

    const input = screen.getByTestId("website-url");
    await user.click(input);
    await user.tab(); // blur with no input

    expect(input).toHaveValue("");
    expect(screen.queryByTestId("website-url-error")).not.toBeInTheDocument();
  });
});
