import { t } from "../i18n/translate";
import { type RepaymentFrequency } from "./loan";

export type ReminderStatus = "active" | "archived" | "completed";
export type MonthlyAnchor = "onDate" | "startOfMonth" | "endOfMonth";
export type NotifyLeadUnit = "days" | "weeks";
export type ReminderPaymentSource = "auto" | "manual" | "extra";

export interface NotifyLead {
  value: number;
  unit: NotifyLeadUnit;
}

export interface ReminderUndoSnapshot {
  remainingBalance: number;
  nextPaymentDate: string;
  customUpcomingDates: string[];
  feeEventCarry: number;
  status: ReminderStatus;
  notificationsEnabled: boolean;
}

export interface ReminderPayment {
  id: string;
  date: string;
  amountPaid: number;
  interestPortion: number;
  principalPortion: number;
  feePortion: number;
  remainingAfter: number;
  source: ReminderPaymentSource;
  undoSnapshot: ReminderUndoSnapshot;
}

export interface ReminderRateChange {
  id: string;
  effectiveDate: string;
  annualInterestRatePercent: number;
}

export interface LoanReminder {
  id: string;
  name: string;
  linkedProfileId: string | null;
  currencyCode: string;
  originalAmount: number;
  remainingBalance: number;
  annualInterestRatePercent: number;
  repaymentAmount: number;
  repaymentFrequency: RepaymentFrequency;
  monthlyAnchor: MonthlyAnchor;
  paymentDayOfMonth: number;
  nextPaymentDate: string;
  customUpcomingDates: string[];
  accountFee: number;
  accountFeeFrequency: RepaymentFrequency;
  feeEventCarry: number;
  notificationsEnabled: boolean;
  notifyLeads: NotifyLead[];
  status: ReminderStatus;
  payments: ReminderPayment[];
  notes: string;
  scheduledNotificationIds: string[];
  rateChanges: ReminderRateChange[];
  createdAt: string;
  updatedAt: string;
}

/** Resolved per call so a language change reaches it. */
export const REMINDER_DISCLAIMER = (): string => t("reminders.disclaimer");

export const DEFAULT_NOTIFY_LEADS: NotifyLead[] = [{ value: 1, unit: "days" }];

export const NOTIFY_LEAD_PRESETS: NotifyLead[] = [
  { value: 0, unit: "days" },
  { value: 1, unit: "days" },
  { value: 2, unit: "days" },
  { value: 1, unit: "weeks" },
];

export const MONTHLY_ANCHORS: MonthlyAnchor[] = [
  "onDate",
  "startOfMonth",
  "endOfMonth",
];

export const leadKey = (lead: NotifyLead): string => `${lead.value}-${lead.unit}`;

export const formatLeadLabel = (lead: NotifyLead): string => {
  if (lead.value <= 0) {
    return t("reminders.lead.morningOf");
  }
  if (lead.unit === "weeks") {
    return t("reminders.lead.weeksBefore", { count: lead.value });
  }
  return t("reminders.lead.daysBefore", { count: lead.value });
};
