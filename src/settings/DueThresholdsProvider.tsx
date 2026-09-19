import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { loadAppSettings, patchAppSettings } from "../storage/localState";
import {
  DEFAULT_DUE_THRESHOLDS,
  normaliseDueThresholds,
  type DueThresholds,
} from "../utils/dueTone";

interface DueThresholdsContextValue {
  thresholds: DueThresholds;
  setDueThresholds: (next: Partial<DueThresholds>) => void;
  /**
   * Re-reads the stored bands. Needed after a restore or a wipe, which change
   * settings underneath this provider.
   */
  reloadFromStorage: () => Promise<void>;
}

const DueThresholdsContext = createContext<DueThresholdsContextValue | null>(null);

/**
 * Due-date colour bands live in context rather than as props because the chip
 * that reads them sits three layers below every screen that renders a reminder.
 */
export const DueThresholdsProvider = ({ children }: { children: ReactNode }) => {
  const [thresholds, setThresholds] = useState<DueThresholds>(DEFAULT_DUE_THRESHOLDS);

  const reloadFromStorage = useCallback(async () => {
    const settings = await loadAppSettings();
    setThresholds(
      normaliseDueThresholds({
        soonDays: settings.dueSoonDays,
        urgentDays: settings.dueUrgentDays,
      })
    );
  }, []);

  useEffect(() => {
    reloadFromStorage().catch(() => {});
  }, [reloadFromStorage]);

  const setDueThresholds = useCallback(
    (next: Partial<DueThresholds>) => {
      const safe = normaliseDueThresholds({ ...thresholds, ...next });
      setThresholds(safe);
      patchAppSettings({
        dueSoonDays: safe.soonDays,
        dueUrgentDays: safe.urgentDays,
      }).catch(() => {});
    },
    [thresholds]
  );

  const value = useMemo(
    () => ({ thresholds, setDueThresholds, reloadFromStorage }),
    [reloadFromStorage, setDueThresholds, thresholds]
  );

  return (
    <DueThresholdsContext.Provider value={value}>{children}</DueThresholdsContext.Provider>
  );
};

export const useDueThresholds = (): DueThresholdsContextValue => {
  const ctx = useContext(DueThresholdsContext);
  if (!ctx) {
    throw new Error("useDueThresholds must be used within DueThresholdsProvider");
  }
  return ctx;
};
