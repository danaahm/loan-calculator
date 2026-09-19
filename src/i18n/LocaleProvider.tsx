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
import { detectCurrencyCode } from "../utils/locale";
import { FALLBACK_LANGUAGE, type LanguageCode } from "./languages";
import { getActiveLanguage, setActiveLanguage, t, type TranslateValues } from "./translate";

interface LocaleContextValue {
  language: LanguageCode;
  /** Currency a brand-new loan or reminder starts with. Each one can differ. */
  defaultCurrencyCode: string;
  t: (key: string, values?: TranslateValues) => string;
  setLanguage: (language: LanguageCode) => void;
  setDefaultCurrencyCode: (currencyCode: string) => void;
  /**
   * Re-reads the stored language and currency. Needed after a restore or a
   * wipe, which change settings underneath this provider.
   */
  reloadFromStorage: () => Promise<void>;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<LanguageCode>(getActiveLanguage());
  const [defaultCurrencyCode, setDefaultCurrencyState] = useState<string>(
    detectCurrencyCode()
  );

  const reloadFromStorage = useCallback(async () => {
    const settings = await loadAppSettings();
    setLanguageState(setActiveLanguage(settings.language));
    // A null code means "not chosen", so fall back to the device region rather
    // than leaving whatever the previous data happened to use.
    setDefaultCurrencyState(settings.defaultCurrencyCode ?? detectCurrencyCode());
  }, []);

  useEffect(() => {
    reloadFromStorage().catch(() => {});
  }, [reloadFromStorage]);

  const setLanguage = useCallback((next: LanguageCode) => {
    // Update the singleton first so any plain module that formats during this
    // render pass already reads the new language.
    setLanguageState(setActiveLanguage(next));
    patchAppSettings({ language: next }).catch(() => {});
  }, []);

  const setDefaultCurrencyCode = useCallback((next: string) => {
    setDefaultCurrencyState(next);
    patchAppSettings({ defaultCurrencyCode: next }).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      language,
      defaultCurrencyCode,
      // Re-created per language so consumers re-render with fresh copy.
      t: (key: string, values?: TranslateValues) => t(key, values),
      setLanguage,
      setDefaultCurrencyCode,
      reloadFromStorage,
    }),
    [
      defaultCurrencyCode,
      language,
      reloadFromStorage,
      setDefaultCurrencyCode,
      setLanguage,
    ]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = (): LocaleContextValue => {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
};

/** Convenience for the common case of needing only the translator. */
export const useTranslation = (): LocaleContextValue["t"] => useLocale().t;

export { FALLBACK_LANGUAGE };
