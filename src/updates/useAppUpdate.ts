import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import {
  addStatusListener,
  completeUpdate,
  getUpdateState,
  playUpdatesSupported,
  startFlexibleUpdate,
  type UpdateState,
} from "../../modules/play-updates";

export type UpdateAction = "showRestart" | "offerUpdate" | "none";

/**
 * What to do with Play's update state each time the app comes forward.
 *
 * A download that already finished gets the restart prompt, even from an
 * earlier session. A new version is offered at most once per launch, so
 * declining Play's prompt is respected until the app is next opened.
 */
export const nextUpdateAction = (
  state: UpdateState | null,
  offeredThisLaunch: boolean
): UpdateAction => {
  if (!state) {
    return "none";
  }
  if (state.installStatus === "downloaded") {
    return "showRestart";
  }
  if (state.availability === "available" && state.flexibleAllowed && !offeredThisLaunch) {
    return "offerUpdate";
  }
  return "none";
};

/** Seconds to wait after launch, so Play's prompt never covers the first screen. */
const OFFER_DELAY_MS = 3000;

/**
 * Checks Google Play for a newer version once the app has loaded, and again
 * whenever it returns to the foreground. Play handles the prompt and the
 * download; this hook only reports when an update is ready to install.
 */
export const useAppUpdate = (enabled: boolean) => {
  const [readyToRestart, setReadyToRestart] = useState(false);
  const offeredRef = useRef(false);

  useEffect(() => {
    if (!enabled || !playUpdatesSupported) {
      return;
    }
    let cancelled = false;

    const check = async () => {
      const action = nextUpdateAction(await getUpdateState(), offeredRef.current);
      if (cancelled) {
        return;
      }
      if (action === "showRestart") {
        setReadyToRestart(true);
      } else if (action === "offerUpdate") {
        offeredRef.current = true;
        await startFlexibleUpdate();
      }
    };

    const timer = setTimeout(check, OFFER_DELAY_MS);
    const removeStatusListener = addStatusListener(({ status }) => {
      if (status === "downloaded") {
        setReadyToRestart(true);
      } else if (status === "installed" || status === "failed" || status === "canceled") {
        setReadyToRestart(false);
      }
    });
    const appStateSubscription = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void check();
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      removeStatusListener();
      appStateSubscription.remove();
    };
  }, [enabled]);

  const restartToUpdate = useCallback(() => {
    void completeUpdate();
  }, []);

  return { readyToRestart, restartToUpdate };
};
