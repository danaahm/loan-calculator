import AsyncStorage from "@react-native-async-storage/async-storage";

import { type LoanInput, type SavedLoanProfile } from "../types/loan";

const STORAGE_KEY = "loan-calculator-input-v1";
const SAVED_PROFILES_KEY = "loan-calculator-saved-profiles-v1";

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
