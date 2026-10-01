import { afterEach, describe, expect, it, vi } from "vitest";
import { getVenueManagerFirebaseConfig } from "../lib/venueManagerFirebaseConfig";

describe("venue manager Firebase public config", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the dedicated web key with the same Firebase project", () => {
    const config = getVenueManagerFirebaseConfig(JSON.stringify({
      project_info: { project_id: "sample-project", private_key: "must-not-leak" },
      client: [{ api_key: [{ current_key: "android-app-only-key" }] }],
      service_account: { private_key: "must-not-leak" },
    }), `AIza${"a".repeat(35)}`);
    expect(config).toEqual({
      apiKey: `AIza${"a".repeat(35)}`,
      authDomain: "sample-project.firebaseapp.com",
      projectId: "sample-project",
    });
    expect(JSON.stringify(config)).not.toContain("private_key");
    expect(JSON.stringify(config)).not.toContain("android-app-only-key");
  });

  it("returns null for missing or malformed configuration", () => {
    expect(getVenueManagerFirebaseConfig("", "web-key")).toBeNull();
    expect(getVenueManagerFirebaseConfig("not json", "web-key")).toBeNull();
    expect(getVenueManagerFirebaseConfig(JSON.stringify({ project_info: { project_id: "sample-project" } }), "not-a-google-web-key")).toBeNull();
    expect(getVenueManagerFirebaseConfig(JSON.stringify({
      project_info: { project_id: "sample-project" },
      client: [{ api_key: [{ current_key: "android-app-only-key" }] }],
    }), "")).toBeNull();
  });
});