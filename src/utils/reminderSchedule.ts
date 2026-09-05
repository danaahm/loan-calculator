import {
  type LoanReminder,
  type MonthlyAnchor,
  type NotifyLead,
} from "../types/reminder";
import { type RepaymentFrequency } from "../types/loan";
import {
  addDays,
  addMonthsClamped,
  dateAtLocalHour,
  formatLocalDate,
  lastDayOfMonth,
  parseIsoDate,
} from "./dateIso";

export const FREQUENCY_PER_YEAR: Record<RepaymentFrequency, number> = {
  yearly: 1,
  quarterly: 4,
  monthly: 12,
  fortnightly: 26,
  weekly: 52,
};

export const nextFormulaDate = (
  fromIso: string,
  frequency: RepaymentFrequency,
  monthlyAnchor: MonthlyAnchor,
  paymentDayOfMonth: number
): string => {
  switch (frequency) {
    case "weekly":
      return addDays(fromIso, 7);
    case "fortnightly":
      return addDays(fromIso, 14);
    case "quarterly":
      return addDays(fromIso, 91);
    case "yearly":
      return addDays(fromIso, 365);
    case "monthly": {
      if (monthlyAnchor === "startOfMonth") {
        const date = parseIsoDate(fromIso);
        return formatLocalDate(new Date(date.getFullYear(), date.getMonth() + 1, 1));
      }
      if (monthlyAnchor === "endOfMonth") {
        const date = parseIsoDate(fromIso);
        const nextMonth = date.getMonth() + 1;
        const year = date.getFullYear() + Math.floor(nextMonth / 12);
        const month = nextMonth % 12;
        return formatLocalDate(
          new Date(year, month, lastDayOfMonth(year, month))
        );
      }
      return addMonthsClamped(fromIso, 1, paymentDayOfMonth);
    }
    default:
      return addMonthsClamped(fromIso, 1, paymentDayOfMonth);
  }
};

export const advancePaymentDate = (
  reminder: Pick<
    LoanReminder,
    | "repaymentFrequency"
    | "monthlyAnchor"
    | "paymentDayOfMonth"
    | "customUpcomingDates"
  >,
  fromDate: string
): { nextDate: string; customUpcomingDates: string[] } => {
  const remainingCustom = [...reminder.customUpcomingDates]
    .filter((date) => date > fromDate)
    .sort();
  if (remainingCustom.length > 0) {
    return {
      nextDate: remainingCustom[0],
      customUpcomingDates: remainingCustom.slice(1),
    };
  }

  return {
    nextDate: nextFormulaDate(
      fromDate,
      reminder.repaymentFrequency,
      reminder.monthlyAnchor,
      reminder.paymentDayOfMonth
    ),
    customUpcomingDates: [],
  };
};

export const leadOffsetDays = (lead: NotifyLead): number => {
  if (lead.unit === "weeks") {
    return lead.value * 7;
  }
  return lead.value;
};

export const leadFireDate = (
  dueIso: string,
  lead: NotifyLead,
  hour: number
): Date => {
  const fire = dateAtLocalHour(dueIso, hour);
  fire.setDate(fire.getDate() - leadOffsetDays(lead));
  return fire;
};

export const normalizeCustomDates = (dates: string[]): string[] => {
  return Array.from(new Set(dates)).sort();
};
