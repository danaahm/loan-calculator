import { t } from "../i18n/translate";
import { type LoanInput, type SavedLoanProfile } from "../types/loan";
import { calculateLoan, normalizeInput } from "./loanMath";
import { formatLoanTermLabel } from "./profileSummary";
import {
  formatCurrency,
  formatLoanLengthLabel,
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
    ? t("compare.amountPerFrequency", {
        amount: formatCurrency(input.extraRepayment.amount, input.currencyCode),
        frequency: formatFrequencyLabel(
          input.extraRepayment.frequency
        ).toLowerCase(),
      })
    : t("common.none");
  const offsetParts: string[] = [];
  if (input.offsetSavings.enabled) {
    offsetParts.push(
      t("compare.offsetStart", {
        amount: formatCurrency(input.offsetSavings.amount, input.currencyCode),
      })
    );
    if (input.offsetSavings.contribution.enabled) {
      offsetParts.push(
        t("compare.offsetContribution", {
          amount: formatCurrency(
            input.offsetSavings.contribution.amount,
            input.currencyCode
          ),
          frequency: formatFrequencyLabel(
            input.offsetSavings.contribution.frequency
          ).toLowerCase(),
        })
      );
    }
  }
  const payoffLabel =
    formatLoanLengthLabel(schedule.summary.payoffYears) || t("common.emptyValue");
  const extraSavingsLabel = result.hasPlanComparison
    ? t("compare.savingsPair", {
        money: formatCurrency(result.savings.moneySaved, input.currencyCode),
        time: formatYearsAndPeriods(
          Math.abs(result.savings.yearsSaved),
          Math.abs(result.savings.periodsSaved),
          periodsPerYear
        ),
      })
    : t("common.emptyValue");

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
    extraSavingsMoney: result.savings.moneySaved,
    extraSavingsPeriods: result.savings.periodsSaved,
    extraSavingsYears: result.savings.yearsSaved,
    extraLabel,
    offsetLabel: offsetParts.length > 0 ? offsetParts.join(" · ") : t("common.none"),
    amountLabel: formatCurrency(input.amountBorrowed, input.currencyCode),
    rateLabel: formatPercent(input.annualInterestRatePercent),
    termLabel: formatLoanTermLabel(input.loanLengthYears),
    frequencyLabel: formatFrequencyLabel(input.repaymentFrequency),
    periodRepaymentLabel: t("compare.perFrequency", {
      amount: formatCurrency(periodRepayment, input.currencyCode),
      frequency: formatFrequencyLabel(input.repaymentFrequency).toLowerCase(),
    }),
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
