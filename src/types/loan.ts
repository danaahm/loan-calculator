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

export interface OptionalAmountConfig {
  enabled: boolean;
  amount: number;
}

export interface OffsetContributionConfig {
  enabled: boolean;
  amount: number;
  frequency: RepaymentFrequency;
}

export interface OffsetSavingsConfig {
  enabled: boolean;
  amount: number;
  contribution: OffsetContributionConfig;
}

export interface LoanInput {
  currencyCode: string;
  amountBorrowed: number;
  annualInterestRatePercent: number;
  repaymentFrequency: RepaymentFrequency;
  loanLengthYears: number;
  accountFeeEnabled: boolean;
  accountFee: number;
  accountFeeFrequency: RepaymentFrequency;
  extraRepayment: ExtraRepaymentConfig;
  lumpSum: OptionalAmountConfig;
  offsetSavings: OffsetSavingsConfig;
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
  offsetBalance: number;
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
  /**
   * The loan on its contracted terms alone: principal, rate and term. No extra
   * repayments, no offset, no lump-sum residual. This is the reference line
   * every comparison is measured against.
   */
  contracted: LoanSchedule;
  /** The user's terms with extra repayments withheld. Defines the scheduled repayment. */
  baseline: LoanSchedule;
  withExtra?: LoanSchedule;
  /** The user's terms with every enabled feature applied. */
  activeSchedule: LoanSchedule;
  /** True when at least one of extra repayment, lump sum or offset is on. */
  hasPlanComparison: boolean;
  /**
   * activeSchedule measured against contracted. Positive means the plan beats
   * the contracted loan; negative means it costs more or takes longer.
   */
  savings: {
    moneySaved: number;
    interestSaved: number;
    periodsSaved: number;
    yearsSaved: number;
  };
}

export interface SavedLoanProfile {
  id: string;
  name: string;
  input: LoanInput;
  createdAt: string;
  updatedAt: string;
}

export const FREQUENCIES: RepaymentFrequency[] = [
  "yearly",
  "quarterly",
  "monthly",
  "fortnightly",
  "weekly",
];
