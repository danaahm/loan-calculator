import { type LoanInput, type SavedLoanProfile } from "../types/loan";
import {
  formatCurrency,
  formatFrequencyLabel,
  formatPercent,
} from "./format";
import { normalizeInput } from "./loanMath";

export interface SavedProfileCardSummary {
  amountLabel: string;
  termLabel: string;
  rateLabel: string;
  headline: string;
  tags: string[];
}

export const formatLoanTermLabel = (loanLengthYears: number): string => {
  if (!Number.isFinite(loanLengthYears) || loanLengthYears <= 0) {
    return "—";
  }

  if (loanLengthYears < 1) {
    const months = Math.max(1, Math.round(loanLengthYears * 12));
    return `${months} month${months === 1 ? "" : "s"}`;
  }

  const roundedYears = Number.isInteger(loanLengthYears)
    ? `${loanLengthYears}`
    : `${loanLengthYears.toFixed(1)}`;
  return `${roundedYears} year${Number(roundedYears) === 1 ? "" : "s"}`;
};

const pluralizeUnit = (value: number, unit: "months" | "years"): string => {
  if (value === 1) {
    return unit === "months" ? "month" : "year";
  }
  return unit;
};

const extraRepaymentTag = (input: LoanInput): string | null => {
  if (!input.extraRepayment.enabled || input.extraRepayment.amount <= 0) {
    return null;
  }

  let label = `Extra ${formatCurrency(
    input.extraRepayment.amount,
    input.currencyCode
  )} ${formatFrequencyLabel(input.extraRepayment.frequency).toLowerCase()}`;

  if (input.extraRepayment.startAfterValue > 0) {
    label += ` after ${input.extraRepayment.startAfterValue} ${pluralizeUnit(
      input.extraRepayment.startAfterValue,
      input.extraRepayment.startAfterUnit
    )}`;
  }

  return label;
};

const lumpSumTag = (input: LoanInput): string | null => {
  if (!input.lumpSum.enabled || input.lumpSum.amount <= 0) {
    return null;
  }
  return `Lump sum ${formatCurrency(input.lumpSum.amount, input.currencyCode)}`;
};

const offsetTag = (input: LoanInput): string | null => {
  if (!input.offsetSavings.enabled) {
    return null;
  }

  const parts: string[] = [];
  if (input.offsetSavings.amount > 0) {
    parts.push(formatCurrency(input.offsetSavings.amount, input.currencyCode));
  }
  if (
    input.offsetSavings.contribution.enabled &&
    input.offsetSavings.contribution.amount > 0
  ) {
    parts.push(
      `+${formatCurrency(
        input.offsetSavings.contribution.amount,
        input.currencyCode
      )} ${formatFrequencyLabel(input.offsetSavings.contribution.frequency).toLowerCase()}`
    );
  }

  return parts.length > 0 ? `Offset ${parts.join(" ")}` : "Offset";
};

const accountFeeTag = (input: LoanInput): string | null => {
  if (input.accountFee <= 0) {
    return null;
  }
  return `Fee ${formatCurrency(input.accountFee, input.currencyCode)} ${formatFrequencyLabel(
    input.accountFeeFrequency
  ).toLowerCase()}`;
};

export const buildSavedProfileCardSummary = (
  profile: SavedLoanProfile
): SavedProfileCardSummary => {
  const input = normalizeInput(profile.input);
  const amountLabel = formatCurrency(input.amountBorrowed, input.currencyCode);
  const termLabel = formatLoanTermLabel(input.loanLengthYears);
  const rateLabel = formatPercent(input.annualInterestRatePercent);
  const tags = [
    `${formatFrequencyLabel(input.repaymentFrequency)} repayments`,
    extraRepaymentTag(input),
    lumpSumTag(input),
    offsetTag(input),
    accountFeeTag(input),
  ].filter((tag): tag is string => Boolean(tag));

  return {
    amountLabel,
    termLabel,
    rateLabel,
    headline: `${amountLabel} | ${termLabel} | ${rateLabel}`,
    tags,
  };
};
