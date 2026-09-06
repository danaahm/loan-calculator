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
}

const DueThresholdsContext = createContext<DueThresholdsContextValue | null>(null);

/**
 * Due-date colour bands live in context rather than as props because the chip
 * that reads them sits three layers below every screen that renders a reminder.
 */
export const DueThresholdsProvider = ({ children }: { children: ReactNode }) => {
  const [thresholds, setThresholds] = useState<DueThresholds>(DEFAULT_DUE_THRESHOLDS);

  useEffect(() => {
    loadAppSettings()
      .then((settings) => {
        setThresholds(
          normaliseDueThresholds({
            soonDays: settings.dueSoonDays,
            urgentDays: settings.dueUrgentDays,
          })
        );
      })
      .catch(() => {});
  }, []);

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
    () => ({ thresholds, setDueThresholds }),
    [setDueThresholds, thresholds]
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
