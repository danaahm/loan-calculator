import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { loadAppSettings, saveAppSettings } from "../storage/localState";
import { type ThemeMode } from "../types/settings";
import { darkColors, lightColors, type ThemeColors } from "./tokens";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: "light" | "dark";
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>("auto");

  useEffect(() => {
    loadAppSettings()
      .then((settings) => {
        if (settings?.themeMode) {
          setMode(settings.themeMode);
        }
      })
      .catch(() => {});
  }, []);

  const resolved: "light" | "dark" =
    mode === "auto" ? (system === "dark" ? "dark" : "light") : mode;
  const colors = resolved === "dark" ? darkColors : lightColors;

  const setThemeMode = useCallback((next: ThemeMode) => {
    setMode(next);
    saveAppSettings({ themeMode: next }).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      mode,
      resolved,
      isDark: resolved === "dark",
      colors,
      setThemeMode,
    }),
    [colors, mode, resolved, setThemeMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
};
