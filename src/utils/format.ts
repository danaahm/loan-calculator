import { type RepaymentFrequency } from "../types/loan";

const FALLBACK_CURRENCIES = [
  "AUD",
  "USD",
  "CNY",
  "EUR",
  "GBP",
  "JPY",
  "INR",
  "NZD",
  "CAD",
  "SGD",
];

export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
}

export const getCurrencySymbol = (currencyCode: string): string => {
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? currencyCode;
  } catch {
    return currencyCode;
  }
};

export const getAvailableCurrencies = (): CurrencyOption[] => {
  const hasSupportedValues = typeof Intl.supportedValuesOf === "function";
  const codes = hasSupportedValues
    ? Intl.supportedValuesOf("currency")
    : FALLBACK_CURRENCIES;

  return codes
    .map((code) => ({
      code,
      symbol: getCurrencySymbol(code),
      label: `${code} (${getCurrencySymbol(code)})`,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
};

export const formatCurrency = (value: number, currencyCode: string): string => {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
};

export const formatPercent = (value: number): string => {
  return `${(Number.isFinite(value) ? value : 0).toFixed(2)}%`;
};

export const formatFrequencyLabel = (frequency: RepaymentFrequency): string => {
  switch (frequency) {
    case "yearly":
      return "Yearly";
    case "quarterly":
      return "Quarterly";
    case "monthly":
      return "Monthly";
    case "fortnightly":
      return "Fortnightly";
    case "weekly":
      return "Weekly";
    default:
      return frequency;
  }
};

export const formatYearsAndPeriods = (
  years: number,
  periods: number,
  periodsPerYear: number
): string => {
  if (periods <= 0 || periodsPerYear <= 0) {
    return "No time saved";
  }

  const wholeYears = Math.floor(years);
  const remainingPeriods = Math.max(
    0,
    Math.round(periods - wholeYears * periodsPerYear)
  );

  if (wholeYears === 0) {
    return `${remainingPeriods} period(s)`;
  }

  return `${wholeYears} year(s) and ${remainingPeriods} period(s)`;
};

export const formatDurationLabel = (loanLengthYears: number): string => {
  if (!Number.isFinite(loanLengthYears) || loanLengthYears <= 0) {
    return "over loan term";
  }

  if (loanLengthYears < 1) {
    const months = Math.max(1, Math.round(loanLengthYears * 12));
    return `over ${months} month${months === 1 ? "" : "s"}`;
  }

  const roundedYears = Number.isInteger(loanLengthYears)
    ? `${loanLengthYears}`
    : `${loanLengthYears.toFixed(1)}`;
  return `over ${roundedYears} year${Number(roundedYears) === 1 ? "" : "s"}`;
};
