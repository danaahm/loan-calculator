import { FALLBACK_LANGUAGE, type LanguageCode } from "../i18n/languages";
import { DEFAULT_DUE_THRESHOLDS } from "../utils/dueTone";

export type ThemeMode = "auto" | "light" | "dark";

/**
 * Ways a date can be shown. Ids rather than patterns, because translation keys
 * are dot-separated and "dd.MM.yyyy" would split into three segments.
 */
export type DateFormatCode =
  | "dmy-slash" // 04/10/2026
  | "dmy-dot" // 04.10.2026
  | "d-mon-y" // 4 Oct 2026
  | "ymd-dash" // 2026-10-04
  | "mdy-slash" // 10/04/2026
  | "mon-d-y"; // Oct 4, 2026

/** "auto" follows the device's own date order, re-read on every launch. */
export type DateFormatSetting = "auto" | DateFormatCode;

/** In the order Settings lists them. */
export const DATE_FORMATS: DateFormatCode[] = [
  "dmy-slash",
  "d-mon-y",
  "dmy-dot",
  "ymd-dash",
  "mdy-slash",
  "mon-d-y",
];

export const isDateFormatSetting = (value: unknown): value is DateFormatSetting =>
  value === "auto" || DATE_FORMATS.includes(value as DateFormatCode);

export interface AppSettings {
  themeMode: ThemeMode;
  language: LanguageCode;
  dateFormat: DateFormatSetting;
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
  dateFormat: "auto",
  defaultCurrencyCode: null,
  reminderNotificationsEnabled: false,
  defaultNotifyHour: 9,
  dueSoonDays: DEFAULT_DUE_THRESHOLDS.soonDays,
  dueUrgentDays: DEFAULT_DUE_THRESHOLDS.urgentDays,
};
