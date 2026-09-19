import {
  type ExtraRepaymentConfig,
  type LoanInput,
  type OffsetContributionConfig,
  type OffsetSavingsConfig,
  type OptionalAmountConfig,
} from "../../types/loan";
import { type LoanReminder } from "../../types/reminder";
import { normalizeInput } from "../loanMath";
import { createEmptyReminder } from "../reminderMath";

/**
 * Nested sections may be given partially: `normalizeInput` fills every gap
 * with the same defaults the app uses when loading an older saved profile.
 */
type LoanOverrides = Partial<
  Omit<LoanInput, "extraRepayment" | "lumpSum" | "offsetSavings">
> & {
  extraRepayment?: Partial<ExtraRepaymentConfig>;
  lumpSum?: Partial<OptionalAmountConfig>;
  offsetSavings?: Partial<Omit<OffsetSavingsConfig, "contribution">> & {
    contribution?: Partial<OffsetContributionConfig>;
  };
};

/** A plain $300,000 loan at 6% over 30 years, monthly, with no extras. */
export const loanInput = (overrides: LoanOverrides = {}): LoanInput =>
  normalizeInput({
    currencyCode: "AUD",
    amountBorrowed: 300_000,
    annualInterestRatePercent: 6,
    repaymentFrequency: "monthly",
    loanLengthYears: 30,
    ...overrides,
  } as Partial<LoanInput>);

/**
 * A reminder with the clock fields set explicitly, so nothing in a test
 * depends on the day it runs. `createEmptyReminder` seeds `nextPaymentDate`
 * from today, which every caller here overrides.
 */
export const reminder = (overrides: Partial<LoanReminder> = {}): LoanReminder => ({
  ...createEmptyReminder("AUD"),
  name: "Test loan",
  originalAmount: 100_000,
  remainingBalance: 100_000,
  annualInterestRatePercent: 0,
  repaymentAmount: 1_000,
  repaymentFrequency: "monthly",
  monthlyAnchor: "onDate",
  paymentDayOfMonth: 15,
  nextPaymentDate: "2026-01-15",
  notificationsEnabled: true,
  ...overrides,
});
