import * as Application from "expo-application";
import Constants from "expo-constants";

/** Signs the Settings footer; the name on the Google Play developer account. */
export const DEVELOPER_NAME = "Devdani";

/** Expo Go's application id on both platforms. */
const EXPO_GO_APPLICATION_ID = "host.exp.Exponent";

/**
 * Which kind of build is running. Play's internal, alpha, beta and production
 * tracks all receive the same production binary, so they cannot be told apart
 * here; the build number is what identifies a release on any of them.
 */
export type BuildChannel = "production" | "preview" | "development";

export interface AppBuildInfo {
  /**
   * The release version from app.json, e.g. "1.4.0" - what the store listing
   * shows. It travels inside the JavaScript bundle, so it describes the code
   * that is actually running.
   */
  version: string;
  /** Android versionCode / iOS build number, unique to every EAS build. */
  buildNumber: string | null;
  /**
   * The installed binary's own version, only when it differs from `version`.
   * A store build never differs; a development build does once app.json is
   * bumped without rebuilding the native app.
   */
  binaryVersion: string | null;
  channel: BuildChannel;
}

interface BuildSources {
  nativeVersion: string | null;
  nativeBuildNumber: string | null;
  configVersion: string | null;
  /**
   * In Expo Go the native app is Expo Go itself, so its version and build
   * number say nothing about this app and are ignored.
   */
  isExpoGo: boolean;
  /** `EXPO_PUBLIC_BUILD_PROFILE`, set per profile in eas.json. */
  buildProfile: string | null;
  isDev: boolean;
}

const channelFor = (buildProfile: string | null, isDev: boolean): BuildChannel => {
  if (buildProfile === "production" || buildProfile === "preview" || buildProfile === "development") {
    return buildProfile;
  }
  // No profile means the bundle was not built by EAS: a Metro session in
  // development, or a local release build.
  return isDev ? "development" : "production";
};

export const describeBuild = (sources: BuildSources): AppBuildInfo => {
  const nativeVersion = sources.isExpoGo ? null : sources.nativeVersion || null;
  const version = sources.configVersion || nativeVersion || "unknown";
  return {
    version,
    buildNumber: sources.isExpoGo ? null : sources.nativeBuildNumber || null,
    binaryVersion: nativeVersion && nativeVersion !== version ? nativeVersion : null,
    channel: channelFor(sources.buildProfile, sources.isDev),
  };
};

export const getAppBuildInfo = (): AppBuildInfo =>
  describeBuild({
    nativeVersion: Application.nativeApplicationVersion,
    nativeBuildNumber: Application.nativeBuildVersion,
    configVersion: Constants.expoConfig?.version ?? null,
    isExpoGo: Application.applicationId === EXPO_GO_APPLICATION_ID,
    buildProfile: process.env.EXPO_PUBLIC_BUILD_PROFILE ?? null,
    isDev: __DEV__,
  });
