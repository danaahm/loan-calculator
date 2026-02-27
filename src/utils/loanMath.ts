import {
  type LoanCalculationResult,
  type LoanInput,
  type LoanSchedule,
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

const safeRound = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const getPeriodsPerYear = (frequency: RepaymentFrequency): number => {
  return FREQUENCY_PER_YEAR[frequency];
};

const calculateBaseRepayment = (
  principal: number,
  periodRate: number,
  numberOfPeriods: number
): number => {
  if (numberOfPeriods <= 0) {
    return 0;
  }

  if (periodRate <= ZERO_EPSILON) {
    return principal / numberOfPeriods;
  }

  const factor = Math.pow(1 + periodRate, numberOfPeriods);
  return (principal * periodRate * factor) / (factor - 1);
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
  const extraEventsPerYear = getPeriodsPerYear(input.extraRepayment.frequency);
  const extraStartAfterPeriods = getExtraRepaymentStartAfterPeriods(
    input.extraRepayment.startAfterValue,
    input.extraRepayment.startAfterUnit,
    periodsPerYear
  );
  const totalPeriods = Math.max(
    1,
    Math.round(input.loanLengthYears * periodsPerYear)
  );
  const periodRate =
    input.annualInterestRatePercent / 100 / Math.max(1, periodsPerYear);
  const scheduledRepayment = calculateBaseRepayment(
    input.amountBorrowed,
    periodRate,
    totalPeriods
  );

  let balance = input.amountBorrowed;
  let feeEventCarry = 0;
  let extraEventCarry = 0;
  const periodRows: PeriodRow[] = [];
  let periodIndex = 0;

  // Keep a safety cap for unusual values where tiny rates can create long tails.
  const maxSimulationPeriods = totalPeriods * 3;

  while (balance > ZERO_EPSILON && periodIndex < maxSimulationPeriods) {
    periodIndex += 1;
    const yearIndex = Math.ceil(periodIndex / periodsPerYear);
    const openingBalance = balance;
    const interestPaid = openingBalance * periodRate;

    let principalPaid = Math.max(0, scheduledRepayment - interestPaid);
    principalPaid = Math.min(principalPaid, balance);
    balance = Math.max(0, balance - principalPaid);

    feeEventCarry += feeEventsPerYear / periodsPerYear;
    const feeEventsThisPeriod = Math.floor(feeEventCarry + ZERO_EPSILON);
    const feePaid = input.accountFee * feeEventsThisPeriod;
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

    const row: PeriodRow = {
      periodIndex,
      yearIndex,
      openingBalance: safeRound(openingBalance),
      interestPaid: safeRound(interestPaid),
      feePaid: safeRound(feePaid),
      principalPaid: safeRound(principalPaid),
      extraPaid: safeRound(extraPaid),
      totalPaid: safeRound(interestPaid + feePaid + principalPaid + extraPaid),
      closingBalance: safeRound(balance),
    };
    periodRows.push(row);
  }

  const yearlyMap = new Map<number, YearlyRow>();
  for (const row of periodRows) {
    const existing = yearlyMap.get(row.yearIndex);
    if (!existing) {
      yearlyMap.set(row.yearIndex, {
        year: row.yearIndex,
        openingBalance: row.openingBalance,
        principalPaid: row.principalPaid,
        interestPaid: row.interestPaid,
        feesPaid: row.feePaid,
        extraPaid: row.extraPaid,
        totalPaid: row.totalPaid,
        closingBalance: row.closingBalance,
      });
      continue;
    }

    existing.principalPaid = safeRound(existing.principalPaid + row.principalPaid);
    existing.interestPaid = safeRound(existing.interestPaid + row.interestPaid);
    existing.feesPaid = safeRound(existing.feesPaid + row.feePaid);
    existing.extraPaid = safeRound(existing.extraPaid + row.extraPaid);
    existing.totalPaid = safeRound(existing.totalPaid + row.totalPaid);
    existing.closingBalance = row.closingBalance;
  }

  const yearlyRows = Array.from(yearlyMap.values()).sort((a, b) => a.year - b.year);

  const lastReportedYear = Math.max(1, Math.ceil(input.loanLengthYears));
  const yearlyBalancePoints: Array<{ year: number; balance: number }> = [];
  for (let year = 1; year <= lastReportedYear; year += 1) {
    const matching = yearlyRows.find((entry) => entry.year === year);
    const lastKnownBalance =
      matching?.closingBalance ??
      (yearlyBalancePoints.length > 0
        ? yearlyBalancePoints[yearlyBalancePoints.length - 1].balance
        : input.amountBorrowed);
    yearlyBalancePoints.push({
      year,
      balance: safeRound(lastKnownBalance),
    });
  }

  const summary = {
    totalPrincipalPaid: safeRound(
      periodRows.reduce((sum, row) => sum + row.principalPaid, 0)
    ),
    totalInterestPaid: safeRound(
      periodRows.reduce((sum, row) => sum + row.interestPaid, 0)
    ),
    totalFeesPaid: safeRound(periodRows.reduce((sum, row) => sum + row.feePaid, 0)),
    totalExtraPaid: safeRound(
      periodRows.reduce((sum, row) => sum + row.extraPaid, 0)
    ),
    totalPaid: safeRound(periodRows.reduce((sum, row) => sum + row.totalPaid, 0)),
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

export const calculateLoan = (input: LoanInput): LoanCalculationResult => {
  const baseline = computeSchedule(input, false);
  const withExtra = input.extraRepayment.enabled
    ? computeSchedule(input, true)
    : undefined;
  const activeSchedule = withExtra ?? baseline;

  const moneySaved = withExtra
    ? safeRound(baseline.summary.totalPaid - withExtra.summary.totalPaid)
    : 0;
  const periodsSaved = withExtra
    ? Math.max(0, baseline.summary.payoffPeriods - withExtra.summary.payoffPeriods)
    : 0;
  const yearsSaved = withExtra
    ? baseline.summary.payoffYears - withExtra.summary.payoffYears
    : 0;

  return {
    baseline,
    withExtra,
    activeSchedule,
    savings: {
      moneySaved,
      periodsSaved,
      yearsSaved,
    },
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

  return {
    currencyCode: input.currencyCode ?? "AUD",
    amountBorrowed: Math.max(0, input.amountBorrowed ?? 0),
    annualInterestRatePercent: Math.max(0, input.annualInterestRatePercent ?? 0),
    repaymentFrequency,
    loanLengthYears: Math.max(0.5, input.loanLengthYears ?? 0.5),
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
  };
};
