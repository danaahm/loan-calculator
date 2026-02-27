import AsyncStorage from "@react-native-async-storage/async-storage";

import { type LoanInput } from "../types/loan";

const STORAGE_KEY = "loan-calculator-input-v1";

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
