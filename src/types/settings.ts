import { FALLBACK_LANGUAGE, type LanguageCode } from "../i18n/languages";
import { DEFAULT_DUE_THRESHOLDS } from "../utils/dueTone";

export type ThemeMode = "auto" | "light" | "dark";

export interface AppSettings {
  themeMode: ThemeMode;
  language: LanguageCode;
  /**
   * Currency a brand-new loan or reminder starts with. Existing ones keep the
   * currency they were saved with, so a user can hold loans in several.
   * `null` means the user has not chosen, so the device region decides.
   */
  defaultCurrencyCode: string | null;
  reminderNotificationsEnabled: boolean;
  defaultNotifyHour: number;
  /**
   * Days before a payment at which its chip and the header dot turn amber, then
   * red. Stored flat so a partially written settings blob still merges cleanly.
   */
  dueSoonDays: number;
  dueUrgentDays: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  themeMode: "auto",
  language: FALLBACK_LANGUAGE,
  defaultCurrencyCode: null,
  reminderNotificationsEnabled: false,
  defaultNotifyHour: 9,
  dueSoonDays: DEFAULT_DUE_THRESHOLDS.soonDays,
  dueUrgentDays: DEFAULT_DUE_THRESHOLDS.urgentDays,
};
