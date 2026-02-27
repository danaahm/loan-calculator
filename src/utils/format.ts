import { type RepaymentFrequency } from "../types/loan";

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
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
