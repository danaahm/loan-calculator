import { type LoanInput, type SavedLoanProfile } from "../types/loan";
import { calculateLoan, normalizeInput } from "./loanMath";
import {
  formatCurrency,
  formatDurationLabel,
  formatFrequencyLabel,
  formatPercent,
  formatYearsAndPeriods,
} from "./format";

const PERIODS_PER_YEAR: Record<LoanInput["repaymentFrequency"], number> = {
  yearly: 1,
  quarterly: 4,
  monthly: 12,
  fortnightly: 26,
  weekly: 52,
};

const safeRound = (value: number): number => Math.round(value * 100) / 100;

export interface ComparedProfile {
  profile: SavedLoanProfile;
  input: LoanInput;
  periodRepayment: number;
  monthlyEquivalent: number;
  totalInterest: number;
  totalPaid: number;
  totalFees: number;
  payoffYears: number;
  payoffPeriods: number;
  extraEnabled: boolean;
  extraSavingsMoney: number;
  extraSavingsPeriods: number;
  extraSavingsYears: number;
  extraLabel: string;
  offsetLabel: string;
  amountLabel: string;
  rateLabel: string;
  termLabel: string;
  frequencyLabel: string;
  periodRepaymentLabel: string;
  monthlyEquivalentLabel: string;
  totalInterestLabel: string;
  totalPaidLabel: string;
  totalFeesLabel: string;
  payoffLabel: string;
  extraSavingsLabel: string;
}

export type WinnerSide = "left" | "right" | "tie" | null;

export const buildComparedProfile = (profile: SavedLoanProfile): ComparedProfile => {
  const input = normalizeInput(profile.input);
  const result = calculateLoan(input);
  const first = result.baseline.periodRows[0];
  const periodRepayment = first
    ? safeRound(first.principalPaid + first.interestPaid)
    : 0;
  const periodsPerYear = PERIODS_PER_YEAR[input.repaymentFrequency];
  const monthlyEquivalent = safeRound((periodRepayment * periodsPerYear) / 12);
  const schedule = result.activeSchedule;
  const extraEnabled = input.extraRepayment.enabled;
  const extraLabel = extraEnabled
    ? `${formatCurrency(input.extraRepayment.amount, input.currencyCode)} ${formatFrequencyLabel(
        input.extraRepayment.frequency
      ).toLowerCase()}`
    : "None";
  const offsetParts: string[] = [];
  if (input.offsetSavings.enabled) {
    offsetParts.push(
      formatCurrency(input.offsetSavings.amount, input.currencyCode) + " start"
    );
    if (input.offsetSavings.contribution.enabled) {
      offsetParts.push(
        `+${formatCurrency(
          input.offsetSavings.contribution.amount,
          input.currencyCode
        )} ${formatFrequencyLabel(input.offsetSavings.contribution.frequency).toLowerCase()}`
      );
    }
  }
  const payoffLabel = formatDurationLabel(schedule.summary.payoffYears).replace(
    /^over /,
    ""
  );
  const extraSavingsLabel = extraEnabled
    ? `${formatCurrency(result.savings.moneySaved, input.currencyCode)} · ${formatYearsAndPeriods(
        result.savings.yearsSaved,
        result.savings.periodsSaved,
        periodsPerYear
      )}`
    : "—";

  return {
    profile,
    input,
    periodRepayment,
    monthlyEquivalent,
    totalInterest: schedule.summary.totalInterestPaid,
    totalPaid: schedule.summary.totalPaid,
    totalFees: schedule.summary.totalFeesPaid,
    payoffYears: schedule.summary.payoffYears,
    payoffPeriods: schedule.summary.payoffPeriods,
    extraEnabled,
    extraSavingsMoney: extraEnabled ? result.savings.moneySaved : 0,
    extraSavingsPeriods: extraEnabled ? result.savings.periodsSaved : 0,
    extraSavingsYears: extraEnabled ? result.savings.yearsSaved : 0,
    extraLabel,
    offsetLabel: offsetParts.length > 0 ? offsetParts.join(" · ") : "None",
    amountLabel: formatCurrency(input.amountBorrowed, input.currencyCode),
    rateLabel: formatPercent(input.annualInterestRatePercent),
    termLabel: `${input.loanLengthYears} year${input.loanLengthYears === 1 ? "" : "s"}`,
    frequencyLabel: formatFrequencyLabel(input.repaymentFrequency),
    periodRepaymentLabel: `${formatCurrency(periodRepayment, input.currencyCode)} / ${formatFrequencyLabel(
      input.repaymentFrequency
    ).toLowerCase()}`,
    monthlyEquivalentLabel: formatCurrency(monthlyEquivalent, input.currencyCode),
    totalInterestLabel: formatCurrency(schedule.summary.totalInterestPaid, input.currencyCode),
    totalPaidLabel: formatCurrency(schedule.summary.totalPaid, input.currencyCode),
    totalFeesLabel: formatCurrency(schedule.summary.totalFeesPaid, input.currencyCode),
    payoffLabel,
    extraSavingsLabel,
  };
};

export const betterLower = (
  left: number,
  right: number,
  comparable: boolean
): WinnerSide => {
  if (!comparable) {
    return null;
  }
  if (Math.abs(left - right) < 0.005) {
    return "tie";
  }
  return left < right ? "left" : "right";
};

export const betterHigher = (
  left: number,
  right: number,
  comparable: boolean
): WinnerSide => {
  if (!comparable) {
    return null;
  }
  if (Math.abs(left - right) < 0.005) {
    return "tie";
  }
  return left > right ? "left" : "right";
};
