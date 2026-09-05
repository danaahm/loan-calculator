import AsyncStorage from "@react-native-async-storage/async-storage";

import { type BasicCalcHistoryEntry } from "../types/basicCalculator";
import {
  FREQUENCIES,
  type LoanInput,
  type RepaymentFrequency,
  type SavedLoanProfile,
} from "../types/loan";
import {
  DEFAULT_NOTIFY_LEADS,
  type LoanReminder,
  type MonthlyAnchor,
  type NotifyLead,
  type ReminderPayment,
  type ReminderStatus,
} from "../types/reminder";
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type ThemeMode,
} from "../types/settings";
import { isValidIsoDate } from "../utils/dateIso";

const STORAGE_KEY = "loan-calculator-input-v1";
const SAVED_PROFILES_KEY = "loan-calculator-saved-profiles-v1";
const SETTINGS_KEY = "loan-calculator-settings-v1";
const BASIC_HISTORY_KEY = "loan-calculator-basic-history-v1";
const REMINDERS_KEY = "loan-calculator-reminders-v1";
const MAX_BASIC_HISTORY = 50;

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "auto" || value === "light" || value === "dark";

const clampHour = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_APP_SETTINGS.defaultNotifyHour;
  }
  return Math.max(0, Math.min(23, Math.round(parsed)));
};

const isFrequency = (value: unknown): value is RepaymentFrequency =>
  FREQUENCIES.includes(value as RepaymentFrequency);

const isMonthlyAnchor = (value: unknown): value is MonthlyAnchor =>
  value === "onDate" || value === "startOfMonth" || value === "endOfMonth";

const isReminderStatus = (value: unknown): value is ReminderStatus =>
  value === "active" || value === "archived" || value === "completed";

const normalizeLeads = (value: unknown): NotifyLead[] => {
  if (!Array.isArray(value)) {
    return DEFAULT_NOTIFY_LEADS;
  }
  const leads = value.filter((item): item is NotifyLead => {
    if (!item || typeof item !== "object") {
      return false;
    }
    const lead = item as NotifyLead;
    return (
      typeof lead.value === "number" &&
      Number.isFinite(lead.value) &&
      lead.value >= 0 &&
      (lead.unit === "days" || lead.unit === "weeks")
    );
  });
  return leads.length > 0 ? leads : DEFAULT_NOTIFY_LEADS;
};

const normalizePayments = (value: unknown): ReminderPayment[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is ReminderPayment => {
    if (!item || typeof item !== "object") {
      return false;
    }
    return typeof (item as ReminderPayment).id === "string";
  });
};

export const normalizeReminder = (raw: Partial<LoanReminder>): LoanReminder | null => {
  if (!raw || typeof raw.id !== "string" || typeof raw.name !== "string") {
    return null;
  }
  const nextPaymentDate =
    typeof raw.nextPaymentDate === "string" && isValidIsoDate(raw.nextPaymentDate)
      ? raw.nextPaymentDate
      : null;
  if (!nextPaymentDate) {
    return null;
  }
  const customUpcomingDates = Array.isArray(raw.customUpcomingDates)
    ? raw.customUpcomingDates.filter(
        (date): date is string => typeof date === "string" && isValidIsoDate(date)
      )
    : [];
  const originalAmount = Math.max(0, Number(raw.originalAmount) || 0);
  const remainingBalance = Math.max(0, Number(raw.remainingBalance) || 0);
  const paymentDayOfMonth = Math.max(
    1,
    Math.min(31, Math.round(Number(raw.paymentDayOfMonth) || 1))
  );

  return {
    id: raw.id,
    name: raw.name,
    linkedProfileId:
      typeof raw.linkedProfileId === "string" ? raw.linkedProfileId : null,
    currencyCode:
      typeof raw.currencyCode === "string" && raw.currencyCode.length > 0
        ? raw.currencyCode
        : "AUD",
    originalAmount,
    remainingBalance,
    annualInterestRatePercent: Math.max(
      0,
      Number(raw.annualInterestRatePercent) || 0
    ),
    repaymentAmount: Math.max(0, Number(raw.repaymentAmount) || 0),
    repaymentFrequency: isFrequency(raw.repaymentFrequency)
      ? raw.repaymentFrequency
      : "monthly",
    monthlyAnchor: isMonthlyAnchor(raw.monthlyAnchor) ? raw.monthlyAnchor : "onDate",
    paymentDayOfMonth,
    nextPaymentDate,
    customUpcomingDates,
    accountFee: Math.max(0, Number(raw.accountFee) || 0),
    accountFeeFrequency: isFrequency(raw.accountFeeFrequency)
      ? raw.accountFeeFrequency
      : "monthly",
    feeEventCarry: Math.max(0, Number(raw.feeEventCarry) || 0),
    notificationsEnabled: Boolean(raw.notificationsEnabled),
    notifyLeads: normalizeLeads(raw.notifyLeads),
    status: isReminderStatus(raw.status) ? raw.status : "active",
    payments: normalizePayments(raw.payments),
    notes: typeof raw.notes === "string" ? raw.notes : "",
    scheduledNotificationIds: Array.isArray(raw.scheduledNotificationIds)
      ? raw.scheduledNotificationIds.filter(
          (id): id is string => typeof id === "string"
        )
      : [],
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
};

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

export const loadAppSettings = async (): Promise<AppSettings> => {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return { ...DEFAULT_APP_SETTINGS };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      themeMode: isThemeMode(parsed.themeMode)
        ? parsed.themeMode
        : DEFAULT_APP_SETTINGS.themeMode,
      reminderNotificationsEnabled: Boolean(parsed.reminderNotificationsEnabled),
      defaultNotifyHour: clampHour(parsed.defaultNotifyHour),
    };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
};

export const patchAppSettings = async (
  patch: Partial<AppSettings>
): Promise<AppSettings> => {
  const current = await loadAppSettings();
  const next: AppSettings = { ...current, ...patch };
  await saveAppSettings(next);
  return next;
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

export const saveLoanReminders = async (reminders: LoanReminder[]): Promise<void> => {
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
};

export const loadLoanReminders = async (): Promise<LoanReminder[]> => {
  const raw = await AsyncStorage.getItem(REMINDERS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LoanReminder>[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => normalizeReminder(item))
      .filter((item): item is LoanReminder => item !== null);
  } catch {
    return [];
  }
};

export const MAX_BASIC_CALC_HISTORY = MAX_BASIC_HISTORY;
