import AsyncStorage from "@react-native-async-storage/async-storage";

import { type BasicCalcHistoryEntry } from "../types/basicCalculator";
import { type LoanInput, type SavedLoanProfile } from "../types/loan";
import { type AppSettings, type ThemeMode } from "../types/settings";

const STORAGE_KEY = "loan-calculator-input-v1";
const SAVED_PROFILES_KEY = "loan-calculator-saved-profiles-v1";
const SETTINGS_KEY = "loan-calculator-settings-v1";
const BASIC_HISTORY_KEY = "loan-calculator-basic-history-v1";
const MAX_BASIC_HISTORY = 50;

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "auto" || value === "light" || value === "dark";

export const saveLoanInput = async (input: LoanInput): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(input));
};

export const loadLoanInput = async (): Promise<Partial<LoanInput> | null> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Partial<LoanInput>;
  } catch {
    return null;
  }
};

export const saveSavedLoanProfiles = async (
  profiles: SavedLoanProfile[]
): Promise<void> => {
  await AsyncStorage.setItem(SAVED_PROFILES_KEY, JSON.stringify(profiles));
};

export const loadSavedLoanProfiles = async (): Promise<SavedLoanProfile[]> => {
  const raw = await AsyncStorage.getItem(SAVED_PROFILES_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as SavedLoanProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveAppSettings = async (settings: AppSettings): Promise<void> => {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const loadAppSettings = async (): Promise<AppSettings | null> => {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    if (!isThemeMode(parsed.themeMode)) {
      return null;
    }
    return { themeMode: parsed.themeMode };
  } catch {
    return null;
  }
};

export const saveBasicCalcHistory = async (
  entries: BasicCalcHistoryEntry[]
): Promise<void> => {
  await AsyncStorage.setItem(BASIC_HISTORY_KEY, JSON.stringify(entries));
};

export const loadBasicCalcHistory = async (): Promise<BasicCalcHistoryEntry[]> => {
  const raw = await AsyncStorage.getItem(BASIC_HISTORY_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as BasicCalcHistoryEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.slice(0, MAX_BASIC_HISTORY);
  } catch {
    return [];
  }
};

export const MAX_BASIC_CALC_HISTORY = MAX_BASIC_HISTORY;
