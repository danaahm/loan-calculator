import { type LoanInput, type SavedLoanProfile } from "../types/loan";
import {
  DEFAULT_NOTIFY_LEADS,
  type LoanReminder,
  type ReminderPayment,
  type ReminderRateChange,
  type ReminderRecurringAmount,
  type ReminderStatus,
  type ReminderUndoSnapshot,
} from "../types/reminder";
import {
  calculateBaseRepayment,
  calculateLoan,
  normalizeInput,
} from "./loanMath";
import { addDays, daysBetween, todayLocalIso } from "./dateIso";
import {
  FREQUENCY_PER_YEAR,
  advancePaymentDate,
  previousFormulaDate,
} from "./reminderSchedule";

const ZERO_EPSILON = 1e-7;

export const safeRound = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const newId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createEmptyReminder = (
  defaultCurrencyCode = "AUD"
): LoanReminder => {
  const today = todayLocalIso();
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: "",
    linkedProfileId: null,
    currencyCode: defaultCurrencyCode,
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
    finalPaymentDate: null,
    offsetBalance: 0,
    offsetDeposit: { amount: 0, frequency: "monthly" },
    offsetEventCarry: 0,
    extraRepayment: { amount: 0, frequency: "monthly" },
    extraEventCarry: 0,
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

const NO_RECURRING_AMOUNT: ReminderRecurringAmount = {
  amount: 0,
  frequency: "monthly",
};

/**
 * The parts of a profile that describe how the loan is being paid, as opposed
 * to its balance. A switched-off section maps to an amount of 0.
 */
const recurringTermsFromInput = (
  input: LoanInput
): Pick<LoanReminder, "offsetDeposit" | "extraRepayment"> => {
  const deposit = input.offsetSavings.contribution;
  return {
    offsetDeposit:
      input.offsetSavings.enabled && deposit.enabled
        ? { amount: deposit.amount, frequency: deposit.frequency }
        : NO_RECURRING_AMOUNT,
    extraRepayment: input.extraRepayment.enabled
      ? {
          amount: input.extraRepayment.amount,
          frequency: input.extraRepayment.frequency,
        }
      : NO_RECURRING_AMOUNT,
  };
};

/** A profile only knows its final repayment date when it was entered as one. */
const finalPaymentDateFromInput = (input: LoanInput): string | null =>
  input.loanTermMode === "endDate" ? input.loanEndDate : null;

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
    accountFee: input.accountFeeEnabled ? input.accountFee : 0,
    accountFeeFrequency: input.accountFeeFrequency,
    finalPaymentDate: finalPaymentDateFromInput(input),
    offsetBalance: input.offsetSavings.enabled ? input.offsetSavings.amount : 0,
    ...recurringTermsFromInput(input),
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
    accountFee: input.accountFeeEnabled ? input.accountFee : 0,
    accountFeeFrequency: input.accountFeeFrequency,
    repaymentFrequency: input.repaymentFrequency,
    // The offset balance is left alone: like the loan balance it is a live
    // figure the user tracks, not a term of the loan.
    ...recurringTermsFromInput(input),
    finalPaymentDate: finalPaymentDateFromInput(input) ?? reminder.finalPaymentDate,
    updatedAt: new Date().toISOString(),
  };
};

/**
 * How many times something on `frequency` happens in one repayment cycle.
 * The fractional remainder is carried, so a yearly event lands on every
 * twelfth monthly cycle and a weekly one lands 4 or 5 times a month.
 */
const eventsInCycle = (
  reminder: LoanReminder,
  frequency: ReminderRecurringAmount["frequency"],
  carry: number
): { count: number; carry: number } => {
  const periodsPerYear = FREQUENCY_PER_YEAR[reminder.repaymentFrequency];
  const next = carry + FREQUENCY_PER_YEAR[frequency] / Math.max(1, periodsPerYear);
  const count = Math.floor(next + ZERO_EPSILON);
  return { count, carry: next - count };
};

const feeForCycle = (
  reminder: LoanReminder
): { feePortion: number; feeEventCarry: number } => {
  const { count, carry } = eventsInCycle(
    reminder,
    reminder.accountFeeFrequency,
    reminder.feeEventCarry
  );
  return { feePortion: reminder.accountFee * count, feeEventCarry: carry };
};

/**
 * The repayment the lender asks for on `isoDate`: the latest dated rate change
 * that set one, or the reminder's own repayment before any did.
 */
export const repaymentAsOf = (reminder: LoanReminder, isoDate: string): number => {
  let repayment = reminder.repaymentAmount;
  const changes = [...(reminder.rateChanges ?? [])].sort((left, right) =>
    left.effectiveDate.localeCompare(right.effectiveDate)
  );
  for (const change of changes) {
    if (change.effectiveDate <= isoDate && change.repaymentAmount != null) {
      repayment = change.repaymentAmount;
    }
  }
  return repayment;
};

export const amountDueForReminder = (reminder: LoanReminder): number => {
  const { feePortion } = feeForCycle(reminder);
  return safeRound(repaymentAsOf(reminder, reminder.nextPaymentDate) + feePortion);
};

/** Fraction of the original balance paid down so far, clamped to 0..1. */
export const payoffProgress = (reminder: LoanReminder): number => {
  if (reminder.originalAmount <= 0) {
    return 0;
  }
  return Math.min(
    1,
    Math.max(0, 1 - reminder.remainingBalance / reminder.originalAmount)
  );
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
  annualInterestRatePercent: number,
  repaymentAmount?: number | null
): LoanReminder => {
  const next: ReminderRateChange = {
    id: newId(),
    effectiveDate,
    annualInterestRatePercent: Math.max(0, annualInterestRatePercent),
    ...(repaymentAmount != null && repaymentAmount > 0
      ? { repaymentAmount: safeRound(repaymentAmount) }
      : {}),
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

/**
 * The annual rate charged across the cycle that ends on `dueIso`, weighted by
 * the days each rate was in force. Interest accrues from the previous due
 * date up to the day before this one, so a change taking effect mid-cycle
 * splits the cycle, and one taking effect on the due date itself first shows
 * up in the following cycle - the way a lender charges it.
 */
export const cycleAverageRate = (reminder: LoanReminder, dueIso: string): number => {
  const startIso = previousFormulaDate(
    dueIso,
    reminder.repaymentFrequency,
    reminder.monthlyAnchor,
    reminder.paymentDayOfMonth
  );
  const totalDays = daysBetween(startIso, dueIso);
  if (totalDays <= 0) {
    return rateAsOf(reminder, dueIso);
  }

  const boundaries = (reminder.rateChanges ?? [])
    .map((change) => change.effectiveDate)
    .filter((date) => date > startIso && date < dueIso)
    .sort();
  let weighted = 0;
  let cursor = startIso;
  for (const boundary of boundaries) {
    weighted += rateAsOf(reminder, cursor) * daysBetween(cursor, boundary);
    cursor = boundary;
  }
  weighted += rateAsOf(reminder, cursor) * daysBetween(cursor, dueIso);
  return weighted / totalDays;
};

const snapshotOf = (reminder: LoanReminder): ReminderUndoSnapshot => ({
  remainingBalance: reminder.remainingBalance,
  nextPaymentDate: reminder.nextPaymentDate,
  customUpcomingDates: reminder.customUpcomingDates,
  feeEventCarry: reminder.feeEventCarry,
  status: reminder.status,
  notificationsEnabled: reminder.notificationsEnabled,
  offsetBalance: reminder.offsetBalance,
  offsetEventCarry: reminder.offsetEventCarry,
  extraEventCarry: reminder.extraEventCarry,
});

const applyScheduledPayment = (
  reminder: LoanReminder,
  source: "auto" | "manual"
): LoanReminder => {
  const dueDate = reminder.nextPaymentDate;
  const periodsPerYear = FREQUENCY_PER_YEAR[reminder.repaymentFrequency];
  const periodRate =
    cycleAverageRate(reminder, dueDate) / 100 / Math.max(1, periodsPerYear);
  // Interest is charged on the loan balance less whatever sits in the offset.
  const interest =
    Math.max(0, reminder.remainingBalance - reminder.offsetBalance) * periodRate;
  const { feePortion, feeEventCarry } = feeForCycle(reminder);
  const payment = Math.max(0, repaymentAsOf(reminder, dueDate));
  const interestPortion = Math.min(payment, Math.max(0, interest));
  const leftover = Math.max(0, payment - interestPortion);
  const principalPortion = Math.min(reminder.remainingBalance, leftover);
  const afterScheduled = Math.max(0, reminder.remainingBalance - principalPortion);

  const extraEvents = eventsInCycle(
    reminder,
    reminder.extraRepayment.frequency,
    reminder.extraEventCarry
  );
  const extraPortion = Math.min(
    afterScheduled,
    Math.max(0, reminder.extraRepayment.amount) * extraEvents.count
  );
  const remaining = Math.max(0, afterScheduled - extraPortion);

  const offsetEvents = eventsInCycle(
    reminder,
    reminder.offsetDeposit.frequency,
    reminder.offsetEventCarry
  );
  const offsetBalance =
    reminder.offsetBalance +
    Math.max(0, reminder.offsetDeposit.amount) * offsetEvents.count;

  const { nextDate, customUpcomingDates } = advancePaymentDate(
    reminder,
    dueDate
  );
  const completed = remaining <= ZERO_EPSILON;
  const paymentRecord: ReminderPayment = {
    id: newId(),
    date: dueDate,
    amountPaid: safeRound(payment + extraPortion),
    interestPortion: safeRound(interestPortion),
    principalPortion: safeRound(principalPortion),
    feePortion: safeRound(feePortion),
    extraPortion: safeRound(extraPortion),
    remainingAfter: safeRound(remaining),
    source,
    undoSnapshot: snapshotOf(reminder),
  };

  return {
    ...reminder,
    remainingBalance: safeRound(remaining),
    nextPaymentDate: completed ? dueDate : nextDate,
    customUpcomingDates,
    feeEventCarry,
    offsetBalance: safeRound(offsetBalance),
    offsetEventCarry: offsetEvents.carry,
    extraEventCarry: extraEvents.carry,
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
    offsetBalance: snapshot.offsetBalance ?? reminder.offsetBalance,
    offsetEventCarry: snapshot.offsetEventCarry ?? reminder.offsetEventCarry,
    extraEventCarry: snapshot.extraEventCarry ?? reminder.extraEventCarry,
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
    undoSnapshot: snapshotOf(reminder),
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

// Weekly repayments run 52 periods a year, so a 30-year loan is already 1560
// cycles. Sized to cover ~100 years of weekly repayments.
const MAX_PAYOFF_PERIODS = 5200;

/**
 * The date the final scheduled repayment lands on, or null when that cannot be
 * determined - a loan whose repayment never covers the interest, or one that
 * runs past the projection limit.
 */
export const estimatePayoffDate = (reminder: LoanReminder): string | null => {
  if (reminder.status !== "active" || reminder.remainingBalance <= ZERO_EPSILON) {
    return reminder.status === "completed" ? reminder.nextPaymentDate : null;
  }
  if (reminder.repaymentAmount <= ZERO_EPSILON) {
    return null;
  }

  let current: LoanReminder = { ...reminder, payments: [] };
  let lastPaymentDate: string | null = null;
  let guard = 0;

  while (current.status === "active" && guard < MAX_PAYOFF_PERIODS) {
    const balanceBefore = current.remainingBalance;
    const dueDate = current.nextPaymentDate;
    // Discard each payment record as we go; only the final date matters, and
    // keeping thousands of them (with undo snapshots) is pure waste.
    current = { ...applyScheduledPayment(current, "auto"), payments: [] };

    if (current.remainingBalance >= balanceBefore - ZERO_EPSILON) {
      // The repayment does not dent the principal, so the loan never clears.
      return null;
    }

    lastPaymentDate = dueDate;
    guard += 1;
  }

  // Still active means the projection limit was hit rather than a real payoff.
  return current.status === "active" ? null : lastPaymentDate;
};

/**
 * The repayment that clears the loan by its final repayment date once
 * `annualInterestRatePercent` takes effect on `effectiveDate`.
 *
 * The balance is projected forward to the first repayment on or after the
 * effective date, then spread over every repayment left up to and including
 * the final one. Lenders set the minimum repayment on the loan balance alone,
 * so the offset does not lower it. Returns null when there is no final
 * repayment date, or no repayment left before it.
 */
export const calculateRepaymentAfterRateChange = (
  reminder: LoanReminder,
  effectiveDate: string,
  annualInterestRatePercent: number
): number | null => {
  const finalDate = reminder.finalPaymentDate;
  if (!finalDate || reminder.status !== "active") {
    return null;
  }

  let current: LoanReminder = { ...reminder, payments: [] };
  let guard = 0;
  while (
    current.status === "active" &&
    current.nextPaymentDate < effectiveDate &&
    guard < MAX_PAYOFF_PERIODS
  ) {
    current = { ...applyScheduledPayment(current, "auto"), payments: [] };
    guard += 1;
  }
  if (current.status !== "active" || current.remainingBalance <= ZERO_EPSILON) {
    return null;
  }

  let remainingCycles = 0;
  let date = current.nextPaymentDate;
  let schedule = current;
  while (date <= finalDate && remainingCycles < MAX_PAYOFF_PERIODS) {
    remainingCycles += 1;
    const advanced = advancePaymentDate(schedule, date);
    schedule = { ...schedule, customUpcomingDates: advanced.customUpcomingDates };
    date = advanced.nextDate;
  }
  if (remainingCycles === 0) {
    return null;
  }

  const periodsPerYear = FREQUENCY_PER_YEAR[reminder.repaymentFrequency];
  const periodRate = Math.max(0, annualInterestRatePercent) / 100 / periodsPerYear;
  return safeRound(
    calculateBaseRepayment(current.remainingBalance, periodRate, remainingCycles)
  );
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

export interface UpcomingRepayment {
  key: string;
  reminder: LoanReminder;
  date: string;
  amountDue: number;
  remainingAfter: number;
}

/**
 * The next `count` repayments across every active reminder, in date order.
 * Each reminder contributes up to `count` of its own cycles, so a single
 * tracked loan fills the list with its own upcoming cycles while several
 * loans naturally interleave.
 */
export const buildUpcomingRepayments = (
  reminders: LoanReminder[],
  count = 3
): UpcomingRepayment[] => {
  const occurrences: UpcomingRepayment[] = [];

  reminders
    .filter((reminder) => reminder.status === "active")
    .forEach((reminder) => {
      projectUpcomingCycles(reminder, 365 * 2, count).forEach((cycle) => {
        occurrences.push({
          key: `${reminder.id}:${cycle.date}`,
          reminder,
          date: cycle.date,
          amountDue: cycle.amountDue,
          remainingAfter: cycle.remainingAfter,
        });
      });
    });

  return occurrences
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      return byDate !== 0 ? byDate : a.reminder.name.localeCompare(b.reminder.name);
    })
    .slice(0, count);
};

export const setReminderStatus = (
  reminder: LoanReminder,
  status: ReminderStatus
): LoanReminder => {
  return {
    ...reminder,
    status,
    // Only an active reminder can notify, so archiving or completing one
    // turns its alerts off rather than leaving a stale enabled flag behind.
    notificationsEnabled:
      status === "active" ? reminder.notificationsEnabled : false,
    updatedAt: new Date().toISOString(),
  };
};
