import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export type UpdateAvailability = "unknown" | "none" | "available" | "inProgress";

export type InstallStatus =
  | "unknown"
  | "pending"
  | "downloading"
  | "downloaded"
  | "installing"
  | "installed"
  | "failed"
  | "canceled";

export interface UpdateState {
  availability: UpdateAvailability;
  installStatus: InstallStatus;
  /** Play allows the background-download flow for this update. */
  flexibleAllowed: boolean;
  /** Days since the Play Store on this device learnt of the update, when known. */
  stalenessDays: number | null;
}

/** Install progress, plus whether the user accepted Play's update prompt. */
export interface StatusEvent {
  status: InstallStatus | "accepted" | "declined";
}

interface PlayUpdatesNative {
  getUpdateState(): Promise<UpdateState>;
  startFlexibleUpdate(): Promise<boolean>;
  completeUpdate(): Promise<void>;
  addListener(
    eventName: "onStatusChange",
    listener: (event: StatusEvent) => void
  ): { remove(): void };
}

// Android builds only. Elsewhere (iOS, web, Expo Go, Jest) every call below
// is a harmless no-op, so callers never need to check the platform.
const native =
  Platform.OS === "android"
    ? requireOptionalNativeModule<PlayUpdatesNative>("PlayUpdates")
    : null;

export const playUpdatesSupported = native != null;

/** Null when Play updates are unsupported or the check itself failed. */
export const getUpdateState = async (): Promise<UpdateState | null> => {
  if (!native) {
    return null;
  }
  try {
    return await native.getUpdateState();
  } catch {
    return null;
  }
};

/** Shows Play's own update prompt. Resolves whether the prompt was shown. */
export const startFlexibleUpdate = async (): Promise<boolean> => {
  if (!native) {
    return false;
  }
  try {
    return await native.startFlexibleUpdate();
  } catch {
    return false;
  }
};

/** Installs a downloaded update. Play restarts the app to finish. */
export const completeUpdate = async (): Promise<void> => {
  await native?.completeUpdate();
};

export const addStatusListener = (
  listener: (event: StatusEvent) => void
): (() => void) => {
  const subscription = native?.addListener("onStatusChange", listener);
  return () => subscription?.remove();
};
