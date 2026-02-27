export type RepaymentFrequency =
  | "yearly"
  | "quarterly"
  | "monthly"
  | "fortnightly"
  | "weekly";
export type ExtraRepaymentStartUnit = "months" | "years";

export interface ExtraRepaymentConfig {
  enabled: boolean;
  amount: number;
  frequency: RepaymentFrequency;
  startAfterValue: number;
  startAfterUnit: ExtraRepaymentStartUnit;
}

export interface LoanInput {
  currencyCode: string;
  amountBorrowed: number;
  annualInterestRatePercent: number;
  repaymentFrequency: RepaymentFrequency;
  loanLengthYears: number;
  accountFee: number;
  accountFeeFrequency: RepaymentFrequency;
  extraRepayment: ExtraRepaymentConfig;
}

export interface PeriodRow {
  periodIndex: number;
  yearIndex: number;
  openingBalance: number;
  interestPaid: number;
  feePaid: number;
  principalPaid: number;
  extraPaid: number;
  totalPaid: number;
  closingBalance: number;
}

export interface YearlyRow {
  year: number;
  openingBalance: number;
  principalPaid: number;
  interestPaid: number;
  feesPaid: number;
  extraPaid: number;
  totalPaid: number;
  closingBalance: number;
}

export interface ScheduleSummary {
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  totalFeesPaid: number;
  totalExtraPaid: number;
  totalPaid: number;
  payoffPeriods: number;
  payoffYears: number;
}

export interface LoanSchedule {
  periodRows: PeriodRow[];
  yearlyRows: YearlyRow[];
  summary: ScheduleSummary;
  yearlyBalancePoints: Array<{
    year: number;
    balance: number;
  }>;
}

export interface LoanCalculationResult {
  baseline: LoanSchedule;
  withExtra?: LoanSchedule;
  activeSchedule: LoanSchedule;
  savings: {
    moneySaved: number;
    periodsSaved: number;
    yearsSaved: number;
  };
}

export const FREQUENCIES: RepaymentFrequency[] = [
  "yearly",
  "quarterly",
  "monthly",
  "fortnightly",
  "weekly",
];
