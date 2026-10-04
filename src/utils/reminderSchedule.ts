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

/**
 * The due date one cycle before `dueIso` under the formula schedule - the day
 * the cycle ending on `dueIso` started accruing interest. Custom one-off dates
 * are not tracked backwards, so a cycle that follows one is treated as a
 * regular cycle.
 */
export const previousFormulaDate = (
  dueIso: string,
  frequency: RepaymentFrequency,
  monthlyAnchor: MonthlyAnchor,
  paymentDayOfMonth: number
): string => {
  switch (frequency) {
    case "weekly":
      return addDays(dueIso, -7);
    case "fortnightly":
      return addDays(dueIso, -14);
    case "quarterly":
      return addDays(dueIso, -91);
    case "yearly":
      return addDays(dueIso, -365);
    case "monthly":
    default: {
      if (frequency === "monthly" && monthlyAnchor === "startOfMonth") {
        const date = parseIsoDate(dueIso);
        return formatLocalDate(new Date(date.getFullYear(), date.getMonth() - 1, 1));
      }
      if (frequency === "monthly" && monthlyAnchor === "endOfMonth") {
        const date = parseIsoDate(dueIso);
        // Day 0 of this month is the last day of the previous one.
        return formatLocalDate(new Date(date.getFullYear(), date.getMonth(), 0));
      }
      return addMonthsClamped(dueIso, -1, paymentDayOfMonth);
    }
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
