export type RepaymentFrequency =
  | "yearly"
  | "quarterly"
  | "monthly"
  | "fortnightly"
  | "weekly";
export type ExtraRepaymentStartUnit = "months" | "years";
/** How the user expressed the loan term: as a length, or as start and end dates. */
export type LoanTermMode = "length" | "endDate";

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

/** A new interest rate that applies from a point in the loan onwards. */
export interface RateChange {
  id: string;
  /** How far into the loan the new rate starts, counted from the first repayment. */
  startAfterValue: number;
  startAfterUnit: ExtraRepaymentStartUnit;
  annualInterestRatePercent: number;
}

export interface RateChangesConfig {
  enabled: boolean;
  changes: RateChange[];
}

/**
 * Repayments cover interest only for a period from the start of the loan,
 * then switch to principal and interest over the rest of the term.
 */
export interface InterestOnlyConfig {
  enabled: boolean;
  lengthValue: number;
  lengthUnit: ExtraRepaymentStartUnit;
}

export interface LoanInput {
  currencyCode: string;
  amountBorrowed: number;
  /** The rate at the start of the loan. `rateChanges` may replace it later. */
  annualInterestRatePercent: number;
  rateChanges: RateChangesConfig;
  interestOnly: InterestOnlyConfig;
  repaymentFrequency: RepaymentFrequency;
  /**
   * Always populated. In "endDate" mode it is derived from the two dates by
   * `normalizeInput`, so the maths never reads the dates directly.
   */
  loanLengthYears: number;
  loanTermMode: LoanTermMode;
  loanStartDate: string | null;
  /** Final repayment date. Only meaningful in "endDate" mode. */
  loanEndDate: string | null;
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

/**
 * A stretch of the loan with one rate and one kind of scheduled repayment. A
 * loan with no rate changes and no interest-only period has exactly one.
 */
export interface RepaymentPhase {
  /** 1-based index of the first repayment in this phase. */
  firstPeriod: number;
  annualInterestRatePercent: number;
  interestOnly: boolean;
  /**
   * Scheduled repayment at the start of the phase. Interest-only repayments
   * follow the baseline schedule, so an offset lowers them.
   */
  repayment: number;
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
  /** Phases the loan actually reaches, in order. Always at least one. */
  repaymentPhases: RepaymentPhase[];
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
