import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type ExpoAppConfig = {
  expo: {
    scheme: string;
    ios: {
      associatedDomains: string[];
    };
    android: {
      intentFilters: Array<{
        data: Array<{
          host?: string;
          pathPrefix?: string;
        }>;
      }>;
    };
  };
};

const appConfigPath = resolve(__dirname, "../../app.json");
const appConfig = JSON.parse(
  readFileSync(appConfigPath, "utf8"),
) as ExpoAppConfig;

describe("event invitation app links", () => {
  it("registers the Met scheme and both iOS Universal Link domains", () => {
    expect(appConfig.expo.scheme).toBe("met");
    expect(appConfig.expo.ios.associatedDomains).toEqual(
      expect.arrayContaining([
        "applinks:met-app.org",
        "applinks:metapp.replit.app",
      ]),
    );
  });

  it("registers the event-invite path for both Android App Link hosts", () => {
    const configuredHosts = appConfig.expo.android.intentFilters.flatMap(
      (filter) =>
        filter.data
          .filter((entry) => entry.pathPrefix === "/event-invite")
          .map((entry) => entry.host),
    );

    expect(configuredHosts).toEqual(
      expect.arrayContaining(["met-app.org", "metapp.replit.app"]),
    );
  });

  it("registers the event-details path for both Android App Link hosts", () => {
    const configuredHosts = appConfig.expo.android.intentFilters.flatMap(
      (filter) =>
        filter.data
          .filter((entry) => entry.pathPrefix === "/event-details")
          .map((entry) => entry.host),
    );

    expect(configuredHosts).toEqual(
      expect.arrayContaining(["met-app.org", "metapp.replit.app"]),
    );
  });

  it("registers the personal connection invite path on the production host", () => {
    const configuredHosts = appConfig.expo.android.intentFilters.flatMap(
      (filter) =>
        filter.data
          .filter((entry) => entry.pathPrefix === "/connect")
          .map((entry) => entry.host),
    );

    expect(configuredHosts).toContain("met-app.org");
  });

  it("has Expo Router screens for invitations and event-detail links", () => {
    expect(
      existsSync(resolve(__dirname, "../../app/connect/[code].tsx")),
    ).toBe(true);
    expect(
      existsSync(resolve(__dirname, "../../app/event-invite/[token].tsx")),
    ).toBe(true);
    expect(
      existsSync(resolve(__dirname, "../../app/event-details/[eventType]/[id].tsx")),
    ).toBe(true);
  });
});
