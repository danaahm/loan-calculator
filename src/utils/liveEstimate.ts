import { type LoanInput, type RepaymentFrequency } from "../types/loan";
import { calculateLoan, normalizeInput, validateLoanInput } from "./loanMath";

/** The headline figures for a loan, worked out from the form as it is typed. */
export interface LiveEstimate {
  /** The frequency `repayment` is paid at. */
  frequency: RepaymentFrequency;
  /**
   * The first scheduled repayment: principal and interest, or interest alone
   * when the loan opens with an interest-only period. Fees and extra
   * repayments are not part of it.
   */
  repayment: number;
  principal: number;
  /** Interest over the whole loan, with every switched-on option applied. */
  totalInterest: number;
  /** Everything paid over the whole loan: principal, interest, fees and extras. */
  totalRepayments: number;
}

/**
 * `null` until the form holds a loan that can be calculated, so a half-typed
 * form shows no figures instead of wrong ones.
 */
export const buildLiveEstimate = (draft: LoanInput): LiveEstimate | null => {
  const validation = validateLoanInput(draft);
  if (!validation.ready || validation.error) {
    return null;
  }
  const input = normalizeInput(draft);
  const result = calculateLoan(input);
  const firstPeriod = result.baseline.periodRows[0];
  if (!firstPeriod) {
    return null;
  }
  const { summary } = result.activeSchedule;
  return {
    frequency: input.repaymentFrequency,
    repayment: firstPeriod.principalPaid + firstPeriod.interestPaid,
    principal: input.amountBorrowed,
    totalInterest: summary.totalInterestPaid,
    totalRepayments: summary.totalPaid,
  };
};
