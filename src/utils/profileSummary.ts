import { t } from "../i18n/translate";
import { type LoanInput, type SavedLoanProfile } from "../types/loan";
import {
  formatCurrency,
  formatFrequencyLabel,
  formatLoanLengthLabel,
  formatPercent,
} from "./format";
import { getRateSequence, normalizeInput } from "./loanMath";

export interface SavedProfileCardSummary {
  amountLabel: string;
  termLabel: string;
  rateLabel: string;
  headline: string;
  tags: string[];
}

export const formatLoanTermLabel = (loanLengthYears: number): string => {
  return formatLoanLengthLabel(loanLengthYears) || t("common.emptyValue");
};

/** The starting rate, then each rate change in the order it applies. */
export const formatRateLabel = (input: LoanInput): string =>
  getRateSequence(input).map(formatPercent).join(" → ");

const extraRepaymentTag = (input: LoanInput): string | null => {
  if (!input.extraRepayment.enabled || input.extraRepayment.amount <= 0) {
    return null;
  }

  const label = t("profileTag.extra", {
    amount: formatCurrency(input.extraRepayment.amount, input.currencyCode),
    frequency: formatFrequencyLabel(input.extraRepayment.frequency).toLowerCase(),
  });

  if (input.extraRepayment.startAfterValue <= 0) {
    return label;
  }

  const unitKey =
    input.extraRepayment.startAfterUnit === "months"
      ? "duration.months"
      : "duration.years";
  return t("profileTag.extraAfter", {
    label,
    after: t(unitKey, { count: input.extraRepayment.startAfterValue }),
  });
};

export const interestOnlyLabel = (input: LoanInput): string | null => {
  if (!input.interestOnly.enabled || input.interestOnly.lengthValue <= 0) {
    return null;
  }
  return t(
    input.interestOnly.lengthUnit === "months" ? "duration.months" : "duration.years",
    { count: input.interestOnly.lengthValue }
  );
};

const interestOnlyTag = (input: LoanInput): string | null => {
  const length = interestOnlyLabel(input);
  return length ? t("profileTag.interestOnly", { length }) : null;
};

const lumpSumTag = (input: LoanInput): string | null => {
  if (!input.lumpSum.enabled || input.lumpSum.amount <= 0) {
    return null;
  }
  return t("profileTag.lumpSum", {
    amount: formatCurrency(input.lumpSum.amount, input.currencyCode),
  });
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

  return parts.length > 0
    ? t("profileTag.offsetWithParts", { parts: parts.join(" ") })
    : t("profileTag.offset");
};

const accountFeeTag = (input: LoanInput): string | null => {
  if (!input.accountFeeEnabled || input.accountFee <= 0) {
    return null;
  }
  return t("profileTag.fee", {
    amount: formatCurrency(input.accountFee, input.currencyCode),
    frequency: formatFrequencyLabel(input.accountFeeFrequency).toLowerCase(),
  });
};

export const buildSavedProfileCardSummary = (
  profile: SavedLoanProfile
): SavedProfileCardSummary => {
  const input = normalizeInput(profile.input);
  const amountLabel = formatCurrency(input.amountBorrowed, input.currencyCode);
  const termLabel = formatLoanTermLabel(input.loanLengthYears);
  const rateLabel = formatRateLabel(input);
  const tags = [
    t("profileTag.repayments", {
      frequency: formatFrequencyLabel(input.repaymentFrequency),
    }),
    interestOnlyTag(input),
    extraRepaymentTag(input),
    lumpSumTag(input),
    offsetTag(input),
    accountFeeTag(input),
  ].filter((tag): tag is string => Boolean(tag));

  return {
    amountLabel,
    termLabel,
    rateLabel,
    headline: t("profileTag.headline", {
      amount: amountLabel,
      term: termLabel,
      rate: rateLabel,
    }),
    tags,
  };
};
