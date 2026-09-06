import {
  FREQUENCIES,
  type LoanCalculationResult,
  type LoanInput,
  type LoanSchedule,
  type OffsetContributionConfig,
  type PeriodRow,
  type RepaymentFrequency,
  type YearlyRow,
} from "../types/loan";

const FREQUENCY_PER_YEAR: Record<RepaymentFrequency, number> = {
  yearly: 1,
  quarterly: 4,
  monthly: 12,
  fortnightly: 26,
  weekly: 52,
};

const ZERO_EPSILON = 1e-7;

// Loan length is stored as decimal years but entered as whole years + months,
// so the smallest expressible term is one month.
export const MIN_LOAN_LENGTH_YEARS = 1 / 12;

const safeRound = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const getPeriodsPerYear = (frequency: RepaymentFrequency): number => {
  return FREQUENCY_PER_YEAR[frequency];
};

const calculateBaseRepayment = (
  principal: number,
  periodRate: number,
  numberOfPeriods: number,
  futureValue = 0
): number => {
  if (numberOfPeriods <= 0) {
    return 0;
  }

  const presentValue = Math.max(0, principal);
  const residual = Math.max(0, Math.min(futureValue, presentValue));

  if (periodRate <= ZERO_EPSILON) {
    return (presentValue - residual) / numberOfPeriods;
  }

  const factor = Math.pow(1 + periodRate, numberOfPeriods);
  return (presentValue * periodRate * factor - residual * periodRate) / (factor - 1);
};

const getOffsetAmount = (input: LoanInput): number => {
  if (!input.offsetSavings.enabled) {
    return 0;
  }
  return Math.max(0, input.offsetSavings.amount);
};

const getOffsetContribution = (input: LoanInput): OffsetContributionConfig | null => {
  if (!input.offsetSavings.enabled || !input.offsetSavings.contribution.enabled) {
    return null;
  }
  if (input.offsetSavings.contribution.amount <= ZERO_EPSILON) {
    return null;
  }
  return input.offsetSavings.contribution;
};

const getBalloonAmount = (input: LoanInput, principal: number): number => {
  if (!input.lumpSum.enabled) {
    return 0;
  }
  return Math.max(0, Math.min(input.lumpSum.amount, principal));
};

const getExtraRepaymentStartAfterPeriods = (
  startAfterValue: number,
  startAfterUnit: "months" | "years",
  periodsPerYear: number
): number => {
  if (startAfterUnit === "years") {
    return Math.max(0, Math.round(startAfterValue * periodsPerYear));
  }
  return Math.max(0, Math.round((startAfterValue / 12) * periodsPerYear));
};

const computeSchedule = (
  input: LoanInput,
  includeExtraRepayment: boolean
): LoanSchedule => {
  const periodsPerYear = getPeriodsPerYear(input.repaymentFrequency);
  const feeEventsPerYear = getPeriodsPerYear(input.accountFeeFrequency);
  const accountFeeAmount = input.accountFeeEnabled
    ? Math.max(0, input.accountFee)
    : 0;
  const extraEventsPerYear = getPeriodsPerYear(input.extraRepayment.frequency);
  const extraStartAfterPeriods = getExtraRepaymentStartAfterPeriods(
    input.extraRepayment.startAfterValue,
    input.extraRepayment.startAfterUnit,
    periodsPerYear
  );
  const offsetContribution = getOffsetContribution(input);
  const offsetEventsPerYear = offsetContribution
    ? getPeriodsPerYear(offsetContribution.frequency)
    : 0;
  const totalPeriods = Math.max(
    1,
    Math.round(input.loanLengthYears * periodsPerYear)
  );
  const periodRate =
    input.annualInterestRatePercent / 100 / Math.max(1, periodsPerYear);
  const principal = Math.max(0, input.amountBorrowed);
  const balloonAmount = getBalloonAmount(input, principal);
  const scheduledRepayment = calculateBaseRepayment(
    principal,
    periodRate,
    totalPeriods,
    balloonAmount
  );

  let balance = principal;
  let offsetBalance = getOffsetAmount(input);
  let feeEventCarry = 0;
  let extraEventCarry = 0;
  let offsetEventCarry = 0;
  const periodRows: PeriodRow[] = [];
  const yearlyMap = new Map<number, YearlyRow>();
  let periodIndex = 0;
  let totalPrincipalPaid = 0;
  let totalInterestPaid = 0;
  let totalFeesPaid = 0;
  let totalExtraPaid = 0;
  let totalPaid = 0;

  // Keep a safety cap for unusual values where tiny rates can create long tails.
  const maxSimulationPeriods = totalPeriods * 3;

  while (balance > ZERO_EPSILON && periodIndex < maxSimulationPeriods) {
    periodIndex += 1;
    const yearIndex = Math.ceil(periodIndex / periodsPerYear);
    const openingBalance = balance;
    const interestPaid = Math.max(0, openingBalance - offsetBalance) * periodRate;

    let principalPaid = Math.max(0, scheduledRepayment - interestPaid);
    principalPaid = Math.min(principalPaid, balance);
    balance = Math.max(0, balance - principalPaid);

    feeEventCarry += feeEventsPerYear / periodsPerYear;
    const feeEventsThisPeriod = Math.floor(feeEventCarry + ZERO_EPSILON);
    const feePaid = accountFeeAmount * feeEventsThisPeriod;
    feeEventCarry -= feeEventsThisPeriod;

    let extraPaid = 0;
    if (
      includeExtraRepayment &&
      input.extraRepayment.enabled &&
      periodIndex > extraStartAfterPeriods &&
      balance > ZERO_EPSILON
    ) {
      extraEventCarry += extraEventsPerYear / periodsPerYear;
      const extraEventsThisPeriod = Math.floor(extraEventCarry + ZERO_EPSILON);
      if (extraEventsThisPeriod > 0) {
        extraPaid = Math.min(
          input.extraRepayment.amount * extraEventsThisPeriod,
          balance
        );
        balance = Math.max(0, balance - extraPaid);
        extraEventCarry -= extraEventsThisPeriod;
      }
    }

    if (balloonAmount > 0 && periodIndex >= totalPeriods && balance > ZERO_EPSILON) {
      principalPaid += balance;
      balance = 0;
    }

    if (offsetContribution) {
      offsetEventCarry += offsetEventsPerYear / periodsPerYear;
      const offsetEventsThisPeriod = Math.floor(offsetEventCarry + ZERO_EPSILON);
      if (offsetEventsThisPeriod > 0) {
        offsetBalance += offsetContribution.amount * offsetEventsThisPeriod;
        offsetEventCarry -= offsetEventsThisPeriod;
      }
    }

    const periodTotalPaid = interestPaid + feePaid + principalPaid + extraPaid;
    totalPrincipalPaid += principalPaid;
    totalInterestPaid += interestPaid;
    totalFeesPaid += feePaid;
    totalExtraPaid += extraPaid;
    totalPaid += periodTotalPaid;

    const existingYear = yearlyMap.get(yearIndex);
    if (!existingYear) {
      yearlyMap.set(yearIndex, {
        year: yearIndex,
        openingBalance,
        principalPaid,
        interestPaid,
        feesPaid: feePaid,
        extraPaid,
        totalPaid: periodTotalPaid,
        closingBalance: balance,
        offsetBalance,
      });
    } else {
      existingYear.principalPaid += principalPaid;
      existingYear.interestPaid += interestPaid;
      existingYear.feesPaid += feePaid;
      existingYear.extraPaid += extraPaid;
      existingYear.totalPaid += periodTotalPaid;
      existingYear.closingBalance = balance;
      existingYear.offsetBalance = offsetBalance;
    }

    periodRows.push({
      periodIndex,
      yearIndex,
      openingBalance: safeRound(openingBalance),
      interestPaid: safeRound(interestPaid),
      feePaid: safeRound(feePaid),
      principalPaid: safeRound(principalPaid),
      extraPaid: safeRound(extraPaid),
      totalPaid: safeRound(periodTotalPaid),
      closingBalance: safeRound(balance),
    });
  }

  const yearlyRows = Array.from(yearlyMap.values())
    .sort((a, b) => a.year - b.year)
    .map((row) => ({
      year: row.year,
      openingBalance: safeRound(row.openingBalance),
      principalPaid: safeRound(row.principalPaid),
      interestPaid: safeRound(row.interestPaid),
      feesPaid: safeRound(row.feesPaid),
      extraPaid: safeRound(row.extraPaid),
      totalPaid: safeRound(row.totalPaid),
      closingBalance: safeRound(row.closingBalance),
      offsetBalance: safeRound(row.offsetBalance),
    }));

  const lastReportedYear = Math.max(1, Math.ceil(input.loanLengthYears));
  const yearlyBalancePoints: Array<{ year: number; balance: number }> = [];
  for (let year = 1; year <= lastReportedYear; year += 1) {
    const matching = yearlyRows.find((entry) => entry.year === year);
    const lastKnownBalance =
      matching?.closingBalance ??
      (yearlyBalancePoints.length > 0
        ? yearlyBalancePoints[yearlyBalancePoints.length - 1].balance
        : principal);
    yearlyBalancePoints.push({
      year,
      balance: safeRound(lastKnownBalance),
    });
  }

  const summary = {
    totalPrincipalPaid: safeRound(totalPrincipalPaid),
    totalInterestPaid: safeRound(totalInterestPaid),
    totalFeesPaid: safeRound(totalFeesPaid),
    totalExtraPaid: safeRound(totalExtraPaid),
    totalPaid: safeRound(totalPaid),
    payoffPeriods: periodRows.length,
    payoffYears: periodRows.length / periodsPerYear,
  };

  return {
    periodRows,
    yearlyRows,
    summary,
    yearlyBalancePoints,
  };
};

/** Anything the user adds on top of the contracted loan terms. */
export const hasPlanAdjustments = (input: LoanInput): boolean => {
  return (
    input.extraRepayment.enabled ||
    input.lumpSum.enabled ||
    input.offsetSavings.enabled
  );
};

/** Strips every optional feature back to the plain contracted loan. */
const withoutPlanAdjustments = (input: LoanInput): LoanInput => ({
  ...input,
  extraRepayment: { ...input.extraRepayment, enabled: false },
  lumpSum: { ...input.lumpSum, enabled: false },
  offsetSavings: {
    ...input.offsetSavings,
    enabled: false,
    contribution: { ...input.offsetSavings.contribution, enabled: false },
  },
});

export const calculateLoan = (input: LoanInput): LoanCalculationResult => {
  const baseline = computeSchedule(input, false);
  const withExtra = input.extraRepayment.enabled
    ? computeSchedule(input, true)
    : undefined;
  const activeSchedule = withExtra ?? baseline;

  const hasPlanComparison = hasPlanAdjustments(input);
  // With nothing switched on the contracted loan *is* the baseline, so skip
  // simulating an identical schedule.
  const contracted = hasPlanComparison
    ? computeSchedule(withoutPlanAdjustments(input), false)
    : baseline;

  // Signed on purpose: a lump-sum residual lowers the repayment but raises the
  // total cost, so the difference can legitimately be negative.
  const moneySaved = hasPlanComparison
    ? safeRound(contracted.summary.totalPaid - activeSchedule.summary.totalPaid)
    : 0;
  const interestSaved = hasPlanComparison
    ? safeRound(
        contracted.summary.totalInterestPaid -
          activeSchedule.summary.totalInterestPaid
      )
    : 0;
  const periodsSaved = hasPlanComparison
    ? contracted.summary.payoffPeriods - activeSchedule.summary.payoffPeriods
    : 0;
  const yearsSaved = hasPlanComparison
    ? contracted.summary.payoffYears - activeSchedule.summary.payoffYears
    : 0;

  return {
    contracted,
    baseline,
    withExtra,
    activeSchedule,
    hasPlanComparison,
    savings: {
      moneySaved,
      interestSaved,
      periodsSaved,
      yearsSaved,
    },
  };
};

export interface LoanInputValidation {
  /** The mandatory fields are filled in, so a calculation is possible. */
  ready: boolean;
  /** First blocking problem, if any. Null means safe to calculate. */
  error: string | null;
}

/**
 * Mandatory fields are the amount borrowed, the loan length and a currency.
 * The interest rate is optional and treated as 0% when left blank. Optional
 * sections (extra repayment, lump sum, offset) only block once switched on.
 */
export const validateLoanInput = (input: LoanInput): LoanInputValidation => {
  const ready =
    input.currencyCode.trim().length > 0 &&
    input.amountBorrowed > 0 &&
    input.loanLengthYears > 0;

  const error = ((): string | null => {
    if (input.amountBorrowed <= 0) {
      return "Enter the amount borrowed.";
    }
    if (input.loanLengthYears <= 0) {
      return "Loan length must be at least 1 month.";
    }
    if (input.currencyCode.trim().length === 0) {
      return "Select a currency.";
    }
    if (input.extraRepayment.enabled && input.extraRepayment.amount <= 0) {
      return "Extra repayment amount must be greater than zero.";
    }
    if (input.lumpSum.enabled && input.lumpSum.amount <= 0) {
      return "Lump sum amount must be greater than zero.";
    }
    if (input.accountFeeEnabled && input.accountFee <= 0) {
      return "Account fee must be greater than zero.";
    }
    if (input.offsetSavings.enabled) {
      const hasStart = input.offsetSavings.amount > 0;
      const hasDeposit =
        input.offsetSavings.contribution.enabled &&
        input.offsetSavings.contribution.amount > 0;
      if (!hasStart && !hasDeposit) {
        return "Enter an offset amount or a regular offset deposit.";
      }
      if (
        input.offsetSavings.contribution.enabled &&
        input.offsetSavings.contribution.amount <= 0
      ) {
        return "Offset deposit amount must be greater than zero.";
      }
    }
    return null;
  })();

  return { ready, error };
};

export const normalizeInput = (input: Partial<LoanInput>): LoanInput => {
  const repaymentFrequency = input.repaymentFrequency ?? "monthly";
  const periodsPerYear = getPeriodsPerYear(repaymentFrequency);
  const legacyStartAfterPeriods =
    (
      input.extraRepayment as Partial<{ startAfterPeriods: number }> | undefined
    )?.startAfterPeriods ?? 0;
  const legacyMonths = Math.max(
    0,
    Math.round((legacyStartAfterPeriods / periodsPerYear) * 12)
  );

  return {
    currencyCode: input.currencyCode ?? "AUD",
    amountBorrowed: Math.max(0, input.amountBorrowed ?? 0),
    annualInterestRatePercent: Math.max(0, input.annualInterestRatePercent ?? 0),
    repaymentFrequency,
    loanLengthYears: Math.max(
      MIN_LOAN_LENGTH_YEARS,
      input.loanLengthYears ?? 1
    ),
    // Older saved profiles predate the toggle: a stored fee above zero means
    // the fee was in effect, so preserve that behaviour on load.
    accountFeeEnabled: input.accountFeeEnabled ?? (input.accountFee ?? 0) > 0,
    accountFee: Math.max(0, input.accountFee ?? 0),
    accountFeeFrequency: input.accountFeeFrequency ?? "monthly",
    extraRepayment: {
      enabled: Boolean(input.extraRepayment?.enabled),
      amount: Math.max(0, input.extraRepayment?.amount ?? 0),
      frequency: input.extraRepayment?.frequency ?? "monthly",
      startAfterValue: Math.max(
        0,
        Math.floor(input.extraRepayment?.startAfterValue ?? legacyMonths)
      ),
      startAfterUnit: input.extraRepayment?.startAfterUnit ?? "months",
    },
    lumpSum: {
      enabled: Boolean(input.lumpSum?.enabled),
      amount: Math.max(0, input.lumpSum?.amount ?? 0),
    },
    offsetSavings: {
      enabled: Boolean(input.offsetSavings?.enabled),
      amount: Math.max(0, input.offsetSavings?.amount ?? 0),
      contribution: {
        enabled: Boolean(input.offsetSavings?.contribution?.enabled),
        amount: Math.max(0, input.offsetSavings?.contribution?.amount ?? 0),
        frequency: FREQUENCIES.includes(
          input.offsetSavings?.contribution?.frequency as RepaymentFrequency
        )
          ? (input.offsetSavings?.contribution?.frequency as RepaymentFrequency)
          : "monthly",
      },
    },
  };
};
