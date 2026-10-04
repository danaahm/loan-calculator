import { describeBuild } from "../appInfo";

const sources = (overrides: Partial<Parameters<typeof describeBuild>[0]> = {}) => ({
  nativeVersion: "1.3.0",
  nativeBuildNumber: "12",
  configVersion: "1.3.0",
  isExpoGo: false,
  buildProfile: "production",
  isDev: false,
  ...overrides,
});

describe("describeBuild", () => {
  it("reports the installed version and its build number", () => {
    expect(describeBuild(sources())).toEqual({
      version: "1.3.0",
      buildNumber: "12",
      binaryVersion: null,
      channel: "production",
    });
  });

  it("ignores Expo Go's own version and build number", () => {
    const build = describeBuild(
      sources({
        isExpoGo: true,
        nativeVersion: "57.0.9",
        nativeBuildNumber: "300",
        configVersion: "1.4.0",
        buildProfile: null,
        isDev: true,
      })
    );
    expect(build).toEqual({
      version: "1.4.0",
      buildNumber: null,
      binaryVersion: null,
      channel: "development",
    });
  });

  it("shows both when app.json has moved on past the installed binary", () => {
    const build = describeBuild(
      sources({ nativeVersion: "1.3.0", configVersion: "1.4.0", buildProfile: "development" })
    );
    expect(build.version).toBe("1.4.0");
    expect(build.binaryVersion).toBe("1.3.0");
  });

  it("labels preview and development builds by their EAS profile", () => {
    expect(describeBuild(sources({ buildProfile: "preview" })).channel).toBe("preview");
    expect(describeBuild(sources({ buildProfile: "development" })).channel).toBe(
      "development"
    );
  });

  it("treats a bundle built outside EAS by whether it is a dev bundle", () => {
    expect(describeBuild(sources({ buildProfile: null, isDev: true })).channel).toBe(
      "development"
    );
    expect(describeBuild(sources({ buildProfile: null, isDev: false })).channel).toBe(
      "production"
    );
  });

  it("falls back to the app config where there is no native app", () => {
    const build = describeBuild(
      sources({ nativeVersion: null, nativeBuildNumber: null, configVersion: "1.3.0" })
    );
    expect(build.version).toBe("1.3.0");
    expect(build.buildNumber).toBeNull();
  });

  it("never shows a blank version", () => {
    expect(
      describeBuild(sources({ nativeVersion: null, configVersion: null })).version
    ).toBe("unknown");
  });
});
