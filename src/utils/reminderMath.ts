import { type SavedLoanProfile } from "../types/loan";
import {
  DEFAULT_NOTIFY_LEADS,
  type LoanReminder,
  type ReminderPayment,
  type ReminderRateChange,
  type ReminderStatus,
} from "../types/reminder";
import { calculateLoan, normalizeInput } from "./loanMath";
import { addDays, todayLocalIso } from "./dateIso";
import {
  FREQUENCY_PER_YEAR,
  advancePaymentDate,
} from "./reminderSchedule";

const ZERO_EPSILON = 1e-7;

export const safeRound = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const newId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createEmptyReminder = (): LoanReminder => {
  const today = todayLocalIso();
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: "",
    linkedProfileId: null,
    currencyCode: "AUD",
    originalAmount: 0,
    remainingBalance: 0,
    annualInterestRatePercent: 0,
    repaymentAmount: 0,
    repaymentFrequency: "monthly",
    monthlyAnchor: "onDate",
    paymentDayOfMonth: 1,
    nextPaymentDate: today,
    customUpcomingDates: [],
    accountFee: 0,
    accountFeeFrequency: "monthly",
    feeEventCarry: 0,
    notificationsEnabled: false,
    notifyLeads: DEFAULT_NOTIFY_LEADS,
    status: "active",
    payments: [],
    notes: "",
    scheduledNotificationIds: [],
    rateChanges: [],
    createdAt: now,
    updatedAt: now,
  };
};

export const estimatePeriodRepaymentFromProfile = (
  profile: SavedLoanProfile
): number => {
  const result = calculateLoan(normalizeInput(profile.input));
  const first = result.baseline.periodRows[0];
  if (!first) {
    return 0;
  }
  return safeRound(first.principalPaid + first.interestPaid);
};

export const draftFromSavedProfile = (
  profile: SavedLoanProfile,
  base?: LoanReminder
): LoanReminder => {
  const source = base ?? createEmptyReminder();
  const input = normalizeInput(profile.input);
  const remaining = Math.max(0, input.amountBorrowed);
  return {
    ...source,
    name: source.name || profile.name,
    linkedProfileId: profile.id,
    currencyCode: input.currencyCode,
    originalAmount: input.amountBorrowed,
    remainingBalance: remaining,
    annualInterestRatePercent: input.annualInterestRatePercent,
    repaymentAmount: estimatePeriodRepaymentFromProfile(profile),
    repaymentFrequency: input.repaymentFrequency,
    accountFee: input.accountFee,
    accountFeeFrequency: input.accountFeeFrequency,
    updatedAt: new Date().toISOString(),
  };
};

export const refreshTermsFromProfile = (
  reminder: LoanReminder,
  profile: SavedLoanProfile
): LoanReminder => {
  const input = normalizeInput(profile.input);
  return {
    ...reminder,
    annualInterestRatePercent: input.annualInterestRatePercent,
    accountFee: input.accountFee,
    accountFeeFrequency: input.accountFeeFrequency,
    repaymentFrequency: input.repaymentFrequency,
    updatedAt: new Date().toISOString(),
  };
};

const feeForCycle = (
  reminder: LoanReminder
): { feePortion: number; feeEventCarry: number } => {
  const periodsPerYear = FREQUENCY_PER_YEAR[reminder.repaymentFrequency];
  const feeEventsPerYear = FREQUENCY_PER_YEAR[reminder.accountFeeFrequency];
  let feeEventCarry = reminder.feeEventCarry;
  feeEventCarry += feeEventsPerYear / Math.max(1, periodsPerYear);
  const feeEventsThisPeriod = Math.floor(feeEventCarry + ZERO_EPSILON);
  const feePortion = reminder.accountFee * feeEventsThisPeriod;
  feeEventCarry -= feeEventsThisPeriod;
  return { feePortion, feeEventCarry };
};

export const amountDueForReminder = (reminder: LoanReminder): number => {
  const { feePortion } = feeForCycle(reminder);
  return safeRound(reminder.repaymentAmount + feePortion);
};

export const rateAsOf = (reminder: LoanReminder, isoDate: string): number => {
  let rate = reminder.annualInterestRatePercent;
  const changes = [...(reminder.rateChanges ?? [])].sort((left, right) =>
    left.effectiveDate.localeCompare(right.effectiveDate)
  );
  for (const change of changes) {
    if (change.effectiveDate <= isoDate) {
      rate = change.annualInterestRatePercent;
    }
  }
  return rate;
};

export const addRateChange = (
  reminder: LoanReminder,
  effectiveDate: string,
  annualInterestRatePercent: number
): LoanReminder => {
  const next: ReminderRateChange = {
    id: newId(),
    effectiveDate,
    annualInterestRatePercent: Math.max(0, annualInterestRatePercent),
  };
  return {
    ...reminder,
    rateChanges: [...(reminder.rateChanges ?? []), next].sort((left, right) =>
      left.effectiveDate.localeCompare(right.effectiveDate)
    ),
    updatedAt: new Date().toISOString(),
  };
};

export const removeRateChange = (
  reminder: LoanReminder,
  id: string
): LoanReminder => {
  return {
    ...reminder,
    rateChanges: (reminder.rateChanges ?? []).filter((item) => item.id !== id),
    updatedAt: new Date().toISOString(),
  };
};

const applyScheduledPayment = (
  reminder: LoanReminder,
  source: "auto" | "manual"
): LoanReminder => {
  const periodsPerYear = FREQUENCY_PER_YEAR[reminder.repaymentFrequency];
  const periodRate =
    rateAsOf(reminder, reminder.nextPaymentDate) / 100 / Math.max(1, periodsPerYear);
  const interest = reminder.remainingBalance * periodRate;
  const { feePortion, feeEventCarry } = feeForCycle(reminder);
  const payment = Math.max(0, reminder.repaymentAmount);
  const interestPortion = Math.min(payment, Math.max(0, interest));
  const leftover = Math.max(0, payment - interestPortion);
  const principalPortion = Math.min(reminder.remainingBalance, leftover);
  const remaining = Math.max(0, reminder.remainingBalance - principalPortion);
  const { nextDate, customUpcomingDates } = advancePaymentDate(
    reminder,
    reminder.nextPaymentDate
  );
  const completed = remaining <= ZERO_EPSILON;
  const paymentRecord: ReminderPayment = {
    id: newId(),
    date: reminder.nextPaymentDate,
    amountPaid: safeRound(payment),
    interestPortion: safeRound(interestPortion),
    principalPortion: safeRound(principalPortion),
    feePortion: safeRound(feePortion),
    remainingAfter: safeRound(remaining),
    source,
    undoSnapshot: {
      remainingBalance: reminder.remainingBalance,
      nextPaymentDate: reminder.nextPaymentDate,
      customUpcomingDates: reminder.customUpcomingDates,
      feeEventCarry: reminder.feeEventCarry,
      status: reminder.status,
      notificationsEnabled: reminder.notificationsEnabled,
    },
  };

  return {
    ...reminder,
    remainingBalance: safeRound(remaining),
    nextPaymentDate: completed ? reminder.nextPaymentDate : nextDate,
    customUpcomingDates,
    feeEventCarry,
    status: completed ? "completed" : reminder.status,
    notificationsEnabled: completed ? false : reminder.notificationsEnabled,
    payments: [...reminder.payments, paymentRecord],
    updatedAt: new Date().toISOString(),
  };
};

export const catchUpReminder = (
  reminder: LoanReminder,
  today: string
): { reminder: LoanReminder; appliedCount: number } => {
  if (reminder.status !== "active") {
    return { reminder, appliedCount: 0 };
  }

  let current = reminder;
  let appliedCount = 0;
  const maxLoops = 120;

  while (
    current.status === "active" &&
    current.remainingBalance > ZERO_EPSILON &&
    current.nextPaymentDate <= today &&
    appliedCount < maxLoops
  ) {
    current = applyScheduledPayment(current, "auto");
    appliedCount += 1;
  }

  return { reminder: current, appliedCount };
};

export const catchUpReminders = (
  reminders: LoanReminder[],
  today: string
): { reminders: LoanReminder[]; summaries: Array<{ name: string; appliedCount: number }> } => {
  const summaries: Array<{ name: string; appliedCount: number }> = [];
  const next = reminders.map((item) => {
    const result = catchUpReminder(item, today);
    if (result.appliedCount > 0) {
      summaries.push({ name: result.reminder.name, appliedCount: result.appliedCount });
    }
    return result.reminder;
  });
  return { reminders: next, summaries };
};

export const undoLastPayment = (reminder: LoanReminder): LoanReminder => {
  const last = reminder.payments[reminder.payments.length - 1];
  if (!last) {
    return reminder;
  }
  const snapshot = last.undoSnapshot;
  return {
    ...reminder,
    remainingBalance: snapshot.remainingBalance,
    nextPaymentDate: snapshot.nextPaymentDate,
    customUpcomingDates: snapshot.customUpcomingDates,
    feeEventCarry: snapshot.feeEventCarry,
    status: snapshot.status === "completed" ? "active" : snapshot.status,
    notificationsEnabled: snapshot.notificationsEnabled,
    payments: reminder.payments.slice(0, -1),
    updatedAt: new Date().toISOString(),
  };
};

export const applyExtraPayment = (
  reminder: LoanReminder,
  amount: number
): LoanReminder => {
  const principalPortion = Math.min(reminder.remainingBalance, Math.max(0, amount));
  if (principalPortion <= ZERO_EPSILON) {
    return reminder;
  }
  const remaining = Math.max(0, reminder.remainingBalance - principalPortion);
  const completed = remaining <= ZERO_EPSILON;
  const paymentRecord: ReminderPayment = {
    id: newId(),
    date: todayLocalIso(),
    amountPaid: safeRound(principalPortion),
    interestPortion: 0,
    principalPortion: safeRound(principalPortion),
    feePortion: 0,
    remainingAfter: safeRound(remaining),
    source: "extra",
    undoSnapshot: {
      remainingBalance: reminder.remainingBalance,
      nextPaymentDate: reminder.nextPaymentDate,
      customUpcomingDates: reminder.customUpcomingDates,
      feeEventCarry: reminder.feeEventCarry,
      status: reminder.status,
      notificationsEnabled: reminder.notificationsEnabled,
    },
  };

  return {
    ...reminder,
    remainingBalance: safeRound(remaining),
    status: completed ? "completed" : reminder.status,
    notificationsEnabled: completed ? false : reminder.notificationsEnabled,
    payments: [...reminder.payments, paymentRecord],
    updatedAt: new Date().toISOString(),
  };
};

export const estimatePayoffDate = (reminder: LoanReminder): string | null => {
  if (reminder.status !== "active" || reminder.remainingBalance <= ZERO_EPSILON) {
    return reminder.status === "completed" ? reminder.nextPaymentDate : null;
  }
  if (reminder.repaymentAmount <= ZERO_EPSILON) {
    return null;
  }

  let current: LoanReminder = { ...reminder, payments: [] };
  let guard = 0;
  while (current.status === "active" && guard < 600) {
    current = applyScheduledPayment(current, "auto");
    guard += 1;
  }
  const last = current.payments[current.payments.length - 1];
  return last?.date ?? null;
};

export interface UpcomingCycle {
  date: string;
  amountDue: number;
  remainingAfter: number;
}

export const projectUpcomingCycles = (
  reminder: LoanReminder,
  horizonDays = 365,
  maxCount = 24
): UpcomingCycle[] => {
  if (reminder.status !== "active" || reminder.remainingBalance <= ZERO_EPSILON) {
    return [];
  }

  const cycles: UpcomingCycle[] = [];
  let current: LoanReminder = { ...reminder, payments: [] };
  const today = todayLocalIso();
  const horizonDate = addDays(today, horizonDays);

  while (
    current.status === "active" &&
    current.remainingBalance > ZERO_EPSILON &&
    cycles.length < maxCount &&
    current.nextPaymentDate <= horizonDate
  ) {
    if (current.nextPaymentDate >= today) {
      const due = amountDueForReminder(current);
      const after = applyScheduledPayment(current, "auto");
      cycles.push({
        date: current.nextPaymentDate,
        amountDue: due,
        remainingAfter: after.remainingBalance,
      });
      current = after;
    } else {
      current = applyScheduledPayment(current, "auto");
    }
  }

  return cycles;
};

export const listUpcomingDates = (
  reminder: LoanReminder,
  count = 6
): string[] => {
  return projectUpcomingCycles(reminder, 365 * 2, count).map((cycle) => cycle.date);
};

export const setReminderStatus = (
  reminder: LoanReminder,
  status: ReminderStatus
): LoanReminder => {
  return {
    ...reminder,
    status,
    notificationsEnabled:
      status === "completed" ? false : reminder.notificationsEnabled,
    updatedAt: new Date().toISOString(),
  };
};
