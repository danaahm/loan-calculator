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
  const principal = Math.max(0, input.amountBorrowed);
  const offsetAmount = getOffsetAmount(input);
  const balloonAmount = getBalloonAmount(input, principal);
  const scheduledRepayment = calculateBaseRepayment(
    principal,
    periodRate,
    totalPeriods,
    balloonAmount
  );

  let balance = principal;
  let feeEventCarry = 0;
  let extraEventCarry = 0;
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
    const interestPaid = Math.max(0, openingBalance - offsetAmount) * periodRate;

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

    if (balloonAmount > 0 && periodIndex >= totalPeriods && balance > ZERO_EPSILON) {
      principalPaid += balance;
      balance = 0;
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
      });
    } else {
      existingYear.principalPaid += principalPaid;
      existingYear.interestPaid += interestPaid;
      existingYear.feesPaid += feePaid;
      existingYear.extraPaid += extraPaid;
      existingYear.totalPaid += periodTotalPaid;
      existingYear.closingBalance = balance;
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
    lumpSum: {
      enabled: Boolean(input.lumpSum?.enabled),
      amount: Math.max(0, input.lumpSum?.amount ?? 0),
    },
    offsetSavings: {
      enabled: Boolean(input.offsetSavings?.enabled),
      amount: Math.max(0, input.offsetSavings?.amount ?? 0),
    },
  };
};
