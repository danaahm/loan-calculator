import { type RepaymentFrequency } from "../types/loan";
import {
  formatCurrency as formatWithLibrary,
  getSupportedCurrencies,
} from "react-native-format-currency";

const FALLBACK_CURRENCIES = ["AUD", "USD", "CNY", "EUR", "GBP", "JPY"];

export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
}

export const getCurrencySymbol = (currencyCode: string): string => {
  try {
    const [, , symbol] = formatWithLibrary({
      amount: 0,
      code: currencyCode,
    });
    return symbol || currencyCode;
  } catch {
    return currencyCode;
  }
};

export const getAvailableCurrencies = (): CurrencyOption[] => {
  try {
    return getSupportedCurrencies()
      .map((currency) => {
        const symbol = getCurrencySymbol(currency.code);
        return {
          code: currency.code,
          symbol,
          label: `${currency.code} (${symbol})`,
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  } catch {
    return FALLBACK_CURRENCIES.map((code) => {
      const symbol = getCurrencySymbol(code);
      return {
        code,
        symbol,
        label: `${code} (${symbol})`,
      };
    });
  }
};

export const formatCurrency = (value: number, currencyCode: string): string => {
  const safeValue = Number.isFinite(value) ? value : 0;
  try {
    const [formatted] = formatWithLibrary({
      amount: safeValue,
      code: currencyCode,
    });
    return formatted;
  } catch {
    return `${currencyCode} ${safeValue.toFixed(2)}`;
  }
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
  const remainingPeriods = Math.max(0, periods - wholeYears * periodsPerYear);
  const monthsPerPeriod = 12 / periodsPerYear;
  const remainingMonths = Math.max(
    0,
    Math.round(remainingPeriods * monthsPerPeriod)
  );

  if (wholeYears === 0) {
    return `${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`;
  }

  return `${wholeYears} year${wholeYears === 1 ? "" : "s"} and ${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`;
};

export const formatMonthAnchorLabel = (
  anchor: "onDate" | "startOfMonth" | "endOfMonth"
): string => {
  switch (anchor) {
    case "startOfMonth":
      return "Start of month";
    case "endOfMonth":
      return "End of month";
    default:
      return "Same day each month";
  }
};

export interface LoanLengthParts {
  years: number;
  months: number;
}

export const composeLoanYears = (years: number, months: number): number => {
  return (Math.max(0, years) * 12 + Math.max(0, months)) / 12;
};

/**
 * Split decimal years into whole years and months. Rounding the *total* months
 * is deliberate: 30 + 7 / 12 is 30.583333333333332, so flooring the fractional
 * remainder would yield 6 months instead of 7.
 */
export const decomposeLoanYears = (value: number): LoanLengthParts => {
  if (!Number.isFinite(value) || value <= 0) {
    return { years: 0, months: 0 };
  }
  const totalMonths = Math.max(0, Math.round(value * 12));
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
};

const pluralize = (value: number, unit: string): string => {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
};

export const formatLoanLengthLabel = (loanLengthYears: number): string => {
  const { years, months } = decomposeLoanYears(loanLengthYears);

  if (years === 0 && months === 0) {
    return "";
  }
  if (years === 0) {
    return pluralize(months, "month");
  }
  if (months === 0) {
    return pluralize(years, "year");
  }
  return `${pluralize(years, "year")} ${pluralize(months, "month")}`;
};

export const formatDurationLabel = (loanLengthYears: number): string => {
  const label = formatLoanLengthLabel(loanLengthYears);
  return label ? `over ${label}` : "over loan term";
};
