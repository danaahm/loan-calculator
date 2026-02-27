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
