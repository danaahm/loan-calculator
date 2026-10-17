import { t } from "../i18n/translate";
import { daysBetween, isValidIsoDate, todayLocalIso } from "./dateIso";
import {
  FREQUENCIES,
  type LoanCalculationResult,
  type LoanInput,
  type LoanSchedule,
  type LoanTermMode,
  type OffsetContributionConfig,
  type PeriodRow,
  type RateChangesConfig,
  type RepaymentFrequency,
  type RepaymentPhase,
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

const AVERAGE_DAYS_PER_MONTH = 365.25 / 12;

/**
 * The loan term implied by a start date and a final repayment date, in the
 * same decimal years `loanLengthYears` uses. Rounded to whole months, the
 * smallest term the length fields can express, so a 30-year loan entered as
 * dates calculates exactly like one entered as 30 years. Returns 0 when the
 * dates are missing, invalid or out of order.
 */
export const loanYearsBetween = (
  startIso: string | null,
  endIso: string | null
): number => {
  if (!startIso || !endIso || !isValidIsoDate(startIso) || !isValidIsoDate(endIso)) {
    return 0;
  }
  const days = daysBetween(startIso, endIso);
  if (days <= 0) {
    return 0;
  }
  const months = Math.max(1, Math.round(days / AVERAGE_DAYS_PER_MONTH));
  return months / 12;
};

const getPeriodsPerYear = (frequency: RepaymentFrequency): number => {
  return FREQUENCY_PER_YEAR[frequency];
};

/**
 * The level repayment that clears `principal` (down to `futureValue`) over
 * `numberOfPeriods` at `periodRate` per period.
 */
export const calculateBaseRepayment = (
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

/** A delay entered in months or years, as a whole number of repayments. */
const getStartAfterPeriods = (
  startAfterValue: number,
  startAfterUnit: "months" | "years",
  periodsPerYear: number
): number => {
  if (startAfterUnit === "years") {
    return Math.max(0, Math.round(startAfterValue * periodsPerYear));
  }
  return Math.max(0, Math.round((startAfterValue / 12) * periodsPerYear));
};

const getTotalPeriods = (input: LoanInput, periodsPerYear: number): number =>
  Math.max(1, Math.round(input.loanLengthYears * periodsPerYear));

interface RateStart {
  /** 1-based index of the first repayment charged at this rate. */
  firstPeriod: number;
  annualInterestRatePercent: number;
}

/**
 * The enabled rate changes as the repayment each first applies to, in order.
 * A change that would land on the first repayment or after the last one is
 * dropped; when two land on the same repayment the later entry wins.
 * `validateLoanInput` reports both cases, so neither reaches a real result.
 */
const getRateStarts = (
  rateChanges: RateChangesConfig,
  periodsPerYear: number,
  totalPeriods: number
): RateStart[] => {
  if (!rateChanges.enabled) {
    return [];
  }
  const byPeriod = new Map<number, number>();
  for (const change of rateChanges.changes) {
    const afterPeriods = getStartAfterPeriods(
      change.startAfterValue,
      change.startAfterUnit,
      periodsPerYear
    );
    if (afterPeriods > 0 && afterPeriods < totalPeriods) {
      byPeriod.set(afterPeriods + 1, change.annualInterestRatePercent);
    }
  }
  return Array.from(byPeriod.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([firstPeriod, annualInterestRatePercent]) => ({
      firstPeriod,
      annualInterestRatePercent,
    }));
};

/** Every rate the loan is charged, the starting rate first, in the order they apply. */
export const getRateSequence = (input: LoanInput): number[] => {
  const periodsPerYear = getPeriodsPerYear(input.repaymentFrequency);
  const totalPeriods = getTotalPeriods(input, periodsPerYear);
  return [
    input.annualInterestRatePercent,
    ...getRateStarts(input.rateChanges, periodsPerYear, totalPeriods).map(
      (start) => start.annualInterestRatePercent
    ),
  ];
};

/**
 * Repayments in the interest-only period. 0 when it is off, or when it would
 * leave no repayment to clear the principal, which `validateLoanInput` reports.
 */
const getInterestOnlyPeriods = (
  input: LoanInput,
  periodsPerYear: number,
  totalPeriods: number
): number => {
  if (!input.interestOnly.enabled) {
    return 0;
  }
  const periods = getStartAfterPeriods(
    input.interestOnly.lengthValue,
    input.interestOnly.lengthUnit,
    periodsPerYear
  );
  return periods < totalPeriods ? periods : 0;
};

interface PlannedPhase extends RateStart {
  periodRate: number;
  interestOnly: boolean;
  /**
   * Scheduled principal and interest per repayment. In an interest-only phase
   * this is the interest on the contracted balance; the simulation charges
   * the interest actually due instead.
   */
  repayment: number;
}

/**
 * The scheduled repayment for each stretch of the loan. A new stretch starts
 * at each rate change and where the interest-only period ends. There the
 * lender resets the repayment so the loan still ends on its final date, and
 * sets it on the contracted balance: extra repayments and offset shorten the
 * loan rather than lowering the repayment. So the repayments are worked out
 * once along the plain contracted path, and every schedule shares them.
 */
const planRepaymentPhases = (input: LoanInput): PlannedPhase[] => {
  const periodsPerYear = getPeriodsPerYear(input.repaymentFrequency);
  const totalPeriods = getTotalPeriods(input, periodsPerYear);
  const principal = Math.max(0, input.amountBorrowed);
  const balloonAmount = getBalloonAmount(input, principal);
  const interestOnlyPeriods = getInterestOnlyPeriods(input, periodsPerYear, totalPeriods);
  const rateStarts: RateStart[] = [
    { firstPeriod: 1, annualInterestRatePercent: input.annualInterestRatePercent },
    ...getRateStarts(input.rateChanges, periodsPerYear, totalPeriods),
  ];
  const boundaries = Array.from(
    new Set([
      ...rateStarts.map((start) => start.firstPeriod),
      ...(interestOnlyPeriods > 0 ? [interestOnlyPeriods + 1] : []),
    ])
  ).sort((left, right) => left - right);

  const phases: PlannedPhase[] = [];
  let contractedBalance = principal;
  let rateIndex = 0;
  boundaries.forEach((firstPeriod, index) => {
    while (
      rateIndex + 1 < rateStarts.length &&
      rateStarts[rateIndex + 1].firstPeriod <= firstPeriod
    ) {
      rateIndex += 1;
    }
    const { annualInterestRatePercent } = rateStarts[rateIndex];
    const periodRate = annualInterestRatePercent / 100 / Math.max(1, periodsPerYear);
    const interestOnly = firstPeriod <= interestOnlyPeriods;
    const repayment = interestOnly
      ? contractedBalance * periodRate
      : calculateBaseRepayment(
          contractedBalance,
          periodRate,
          totalPeriods - firstPeriod + 1,
          balloonAmount
        );
    phases.push({ firstPeriod, annualInterestRatePercent, periodRate, interestOnly, repayment });

    if (interestOnly) {
      return;
    }
    const nextFirstPeriod = boundaries[index + 1] ?? totalPeriods + 1;
    for (let period = firstPeriod; period < nextFirstPeriod; period += 1) {
      const principalPaid = Math.max(0, repayment - contractedBalance * periodRate);
      contractedBalance = Math.max(0, contractedBalance - principalPaid);
    }
  });
  return phases;
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
  const extraStartAfterPeriods = getStartAfterPeriods(
    input.extraRepayment.startAfterValue,
    input.extraRepayment.startAfterUnit,
    periodsPerYear
  );
  const offsetContribution = getOffsetContribution(input);
  const offsetEventsPerYear = offsetContribution
    ? getPeriodsPerYear(offsetContribution.frequency)
    : 0;
  const totalPeriods = getTotalPeriods(input, periodsPerYear);
  const principal = Math.max(0, input.amountBorrowed);
  const balloonAmount = getBalloonAmount(input, principal);
  const phases = planRepaymentPhases(input);
  let phaseIndex = 0;

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
    while (
      phaseIndex + 1 < phases.length &&
      periodIndex >= phases[phaseIndex + 1].firstPeriod
    ) {
      phaseIndex += 1;
    }
    const phase = phases[phaseIndex];
    const openingBalance = balance;
    const interestPaid =
      Math.max(0, openingBalance - offsetBalance) * phase.periodRate;

    let principalPaid = phase.interestOnly
      ? 0
      : Math.max(0, phase.repayment - interestPaid);
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

  // Only phases the loan reaches: a large offset can clear it before a change.
  const repaymentPhases: RepaymentPhase[] = planRepaymentPhases(input)
    .filter((phase) => phase.firstPeriod <= baseline.periodRows.length)
    .map((phase) => ({
      firstPeriod: phase.firstPeriod,
      annualInterestRatePercent: phase.annualInterestRatePercent,
      interestOnly: phase.interestOnly,
      repayment: phase.interestOnly
        ? baseline.periodRows[phase.firstPeriod - 1].interestPaid
        : safeRound(phase.repayment),
    }));

  return {
    contracted,
    baseline,
    withExtra,
    activeSchedule,
    repaymentPhases,
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

const validateRateChanges = (input: LoanInput): string | null => {
  if (!input.rateChanges.enabled) {
    return null;
  }
  if (input.rateChanges.changes.length === 0) {
    return t("validation.rateChangesEmpty");
  }
  const periodsPerYear = getPeriodsPerYear(input.repaymentFrequency);
  const totalPeriods = getTotalPeriods(input, periodsPerYear);
  const seen = new Set<number>();
  for (const change of input.rateChanges.changes) {
    const afterPeriods = getStartAfterPeriods(
      change.startAfterValue,
      change.startAfterUnit,
      periodsPerYear
    );
    if (afterPeriods <= 0 || afterPeriods >= totalPeriods) {
      return t("validation.rateChangeTiming");
    }
    if (seen.has(afterPeriods)) {
      return t("validation.rateChangeDuplicate");
    }
    seen.add(afterPeriods);
  }
  return null;
};

/**
 * Mandatory fields are the amount borrowed, the loan length and a currency.
 * The interest rate is optional and treated as 0% when left blank. Optional
 * sections (rate changes, interest only, extra repayment, lump sum, offset)
 * only block once switched on.
 */
export const validateLoanInput = (input: LoanInput): LoanInputValidation => {
  const ready =
    input.currencyCode.trim().length > 0 &&
    input.amountBorrowed > 0 &&
    input.loanLengthYears > 0;

  const error = ((): string | null => {
    if (input.amountBorrowed <= 0) {
      return t("validation.amountBorrowed");
    }
    if (input.loanTermMode === "endDate" && input.loanLengthYears <= 0) {
      return t("validation.loanEndDate");
    }
    if (input.loanLengthYears <= 0) {
      return t("validation.loanLength");
    }
    if (input.currencyCode.trim().length === 0) {
      return t("validation.currency");
    }
    const rateChangeError = validateRateChanges(input);
    if (rateChangeError) {
      return rateChangeError;
    }
    if (input.interestOnly.enabled) {
      const periodsPerYear = getPeriodsPerYear(input.repaymentFrequency);
      const periods = getStartAfterPeriods(
        input.interestOnly.lengthValue,
        input.interestOnly.lengthUnit,
        periodsPerYear
      );
      if (periods <= 0) {
        return t("validation.interestOnlyLength");
      }
      if (periods >= getTotalPeriods(input, periodsPerYear)) {
        return t("validation.interestOnlyTooLong");
      }
    }
    if (input.extraRepayment.enabled && input.extraRepayment.amount <= 0) {
      return t("validation.extraRepayment");
    }
    if (input.lumpSum.enabled && input.lumpSum.amount <= 0) {
      return t("validation.lumpSum");
    }
    if (input.accountFeeEnabled && input.accountFee <= 0) {
      return t("validation.accountFee");
    }
    if (input.offsetSavings.enabled) {
      const hasStart = input.offsetSavings.amount > 0;
      const hasDeposit =
        input.offsetSavings.contribution.enabled &&
        input.offsetSavings.contribution.amount > 0;
      if (!hasStart && !hasDeposit) {
        return t("validation.offsetEmpty");
      }
      if (
        input.offsetSavings.contribution.enabled &&
        input.offsetSavings.contribution.amount <= 0
      ) {
        return t("validation.offsetDeposit");
      }
    }
    return null;
  })();

  return { ready, error };
};

/** Profiles saved before rate changes existed have none, switched off. */
const normalizeRateChanges = (value: unknown): RateChangesConfig => {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<
    Record<keyof RateChangesConfig, unknown>
  >;
  const changes = Array.isArray(raw.changes) ? raw.changes : [];
  return {
    enabled: Boolean(raw.enabled),
    changes: changes
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object"
      )
      .map((item, index) => ({
        id:
          typeof item.id === "string" && item.id.length > 0
            ? item.id
            : `rate-change-${index + 1}`,
        startAfterValue: Math.max(0, Math.floor(Number(item.startAfterValue) || 0)),
        startAfterUnit: item.startAfterUnit === "years" ? "years" : "months",
        annualInterestRatePercent: Math.max(
          0,
          Number(item.annualInterestRatePercent) || 0
        ),
      })),
  };
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
  const validDateOrNull = (value: unknown): string | null =>
    typeof value === "string" && isValidIsoDate(value) ? value : null;
  // Profiles saved before end dates existed have no mode and were all lengths.
  const loanTermMode: LoanTermMode =
    input.loanTermMode === "endDate" ? "endDate" : "length";
  const loanStartDate = validDateOrNull(input.loanStartDate);
  const loanEndDate = validDateOrNull(input.loanEndDate);
  const yearsFromDates =
    loanTermMode === "endDate"
      ? loanYearsBetween(loanStartDate ?? todayLocalIso(), loanEndDate)
      : 0;

  return {
    currencyCode: input.currencyCode ?? "AUD",
    amountBorrowed: Math.max(0, input.amountBorrowed ?? 0),
    annualInterestRatePercent: Math.max(0, input.annualInterestRatePercent ?? 0),
    rateChanges: normalizeRateChanges(input.rateChanges),
    // Profiles saved before interest-only periods existed were all P&I.
    interestOnly: {
      enabled: Boolean(input.interestOnly?.enabled),
      lengthValue: Math.max(0, Math.floor(Number(input.interestOnly?.lengthValue) || 0)),
      lengthUnit: input.interestOnly?.lengthUnit === "months" ? "months" : "years",
    },
    repaymentFrequency,
    loanLengthYears: Math.max(
      MIN_LOAN_LENGTH_YEARS,
      yearsFromDates > 0 ? yearsFromDates : input.loanLengthYears ?? 1
    ),
    loanTermMode,
    loanStartDate,
    loanEndDate,
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
