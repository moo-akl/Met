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

  it("has an Expo Router screen for the invite path", () => {
    expect(
      existsSync(resolve(__dirname, "../../app/event-invite/[token].tsx")),
    ).toBe(true);
  });
});
