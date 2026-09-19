import {
  MIN_LOAN_LENGTH_YEARS,
  calculateLoan,
  hasPlanAdjustments,
  normalizeInput,
  validateLoanInput,
} from "../loanMath";
import { loanInput } from "./fixtures";

/**
 * Expected figures come from the standard annuity formula
 *   PMT = P*r*(1+r)^n / ((1+r)^n - 1)
 * worked independently of this implementation, so a regression in the
 * schedule shows up as a failure rather than being baked into the test.
 */
const annuityPayment = (
  principal: number,
  periodRate: number,
  periods: number,
  futureValue = 0
): number => {
  if (periodRate === 0) {
    return (principal - futureValue) / periods;
  }
  const factor = (1 + periodRate) ** periods;
  return (principal * periodRate * factor - futureValue * periodRate) / (factor - 1);
};

const lastRow = <T,>(rows: T[]): T => rows[rows.length - 1];

describe("contracted amortization", () => {
  it("matches the annuity formula for a 30-year monthly loan", () => {
    const { activeSchedule } = calculateLoan(loanInput());
    const expectedPayment = annuityPayment(300_000, 0.06 / 12, 360);

    // $1,798.65 a month on $300k at 6% over 30 years.
    expect(expectedPayment).toBeCloseTo(1798.65, 2);

    const first = activeSchedule.periodRows[0];
    expect(first.interestPaid).toBe(1500); // 300,000 at 0.5%
    expect(first.principalPaid).toBeCloseTo(expectedPayment - 1500, 2);
    expect(first.openingBalance).toBe(300_000);

    expect(activeSchedule.summary.payoffPeriods).toBe(360);
    expect(activeSchedule.summary.payoffYears).toBe(30);
    expect(lastRow(activeSchedule.periodRows).closingBalance).toBe(0);
  });

  it("totals principal and interest to the sum of the repayments", () => {
    const { activeSchedule } = calculateLoan(loanInput());
    const expectedTotal = annuityPayment(300_000, 0.06 / 12, 360) * 360;

    expect(activeSchedule.summary.totalPrincipalPaid).toBeCloseTo(300_000, 2);
    expect(activeSchedule.summary.totalInterestPaid).toBeCloseTo(
      expectedTotal - 300_000,
      0
    );
    expect(activeSchedule.summary.totalPaid).toBeCloseTo(expectedTotal, 0);
  });

  it("repays a 0% loan in equal principal instalments", () => {
    const { activeSchedule } = calculateLoan(
      loanInput({
        amountBorrowed: 12_000,
        annualInterestRatePercent: 0,
        loanLengthYears: 1,
      })
    );

    expect(activeSchedule.summary.payoffPeriods).toBe(12);
    expect(activeSchedule.summary.totalInterestPaid).toBe(0);
    expect(activeSchedule.summary.totalPaid).toBeCloseTo(12_000, 2);
    activeSchedule.periodRows.forEach((row) => {
      expect(row.principalPaid).toBeCloseTo(1_000, 2);
      expect(row.interestPaid).toBe(0);
    });
  });

  it("amortizes each repayment frequency over the same term", () => {
    const cases = [
      { frequency: "yearly", periods: 5 },
      { frequency: "quarterly", periods: 20 },
      { frequency: "monthly", periods: 60 },
      { frequency: "fortnightly", periods: 130 },
      { frequency: "weekly", periods: 260 },
    ] as const;

    cases.forEach(({ frequency, periods }) => {
      const { activeSchedule } = calculateLoan(
        loanInput({
          amountBorrowed: 50_000,
          loanLengthYears: 5,
          repaymentFrequency: frequency,
        })
      );
      expect(activeSchedule.summary.payoffPeriods).toBe(periods);
      expect(lastRow(activeSchedule.periodRows).closingBalance).toBe(0);
    });
  });

  it("reports a balance point for every year of the term", () => {
    const { activeSchedule } = calculateLoan(loanInput({ loanLengthYears: 30 }));
    expect(activeSchedule.yearlyBalancePoints).toHaveLength(30);
    expect(activeSchedule.yearlyBalancePoints[0].year).toBe(1);
    expect(lastRow(activeSchedule.yearlyBalancePoints).balance).toBe(0);
  });
});

describe("account fees", () => {
  it("charges a yearly fee once every twelfth monthly repayment", () => {
    const { activeSchedule } = calculateLoan(
      loanInput({
        accountFeeEnabled: true,
        accountFee: 395,
        accountFeeFrequency: "yearly",
      })
    );

    expect(activeSchedule.periodRows[0].feePaid).toBe(0);
    expect(activeSchedule.periodRows[10].feePaid).toBe(0);
    expect(activeSchedule.periodRows[11].feePaid).toBe(395); // 12th repayment
    expect(activeSchedule.periodRows[23].feePaid).toBe(395);
    expect(activeSchedule.summary.totalFeesPaid).toBeCloseTo(395 * 30, 2);
  });

  it("charges every fee event when fees are more frequent than repayments", () => {
    const { activeSchedule } = calculateLoan(
      loanInput({
        amountBorrowed: 50_000,
        loanLengthYears: 5,
        repaymentFrequency: "yearly",
        accountFeeEnabled: true,
        accountFee: 10,
        accountFeeFrequency: "monthly",
      })
    );

    // One repayment a year has to carry all twelve monthly fees.
    expect(activeSchedule.periodRows[0].feePaid).toBe(120);
    expect(activeSchedule.summary.totalFeesPaid).toBeCloseTo(600, 2);
  });

  it("keeps a fortnightly fee in step with fortnightly repayments", () => {
    const { activeSchedule } = calculateLoan(
      loanInput({
        loanLengthYears: 5,
        repaymentFrequency: "fortnightly",
        accountFeeEnabled: true,
        accountFee: 15,
        accountFeeFrequency: "fortnightly",
      })
    );

    expect(activeSchedule.periodRows[0].feePaid).toBe(15);
    expect(activeSchedule.summary.totalFeesPaid).toBeCloseTo(15 * 130, 2);
  });

  it("ignores a stored fee while the toggle is off", () => {
    const { activeSchedule } = calculateLoan(
      loanInput({ accountFeeEnabled: false, accountFee: 395 })
    );
    expect(activeSchedule.summary.totalFeesPaid).toBe(0);
  });

  it("leaves the payoff date untouched, since fees are not principal", () => {
    const withFee = calculateLoan(
      loanInput({
        accountFeeEnabled: true,
        accountFee: 395,
        accountFeeFrequency: "yearly",
      })
    );
    const withoutFee = calculateLoan(loanInput());

    expect(withFee.activeSchedule.summary.payoffPeriods).toBe(
      withoutFee.activeSchedule.summary.payoffPeriods
    );
  });
});

describe("offset savings", () => {
  it("suppresses interest entirely while the offset covers the balance", () => {
    const { activeSchedule } = calculateLoan(
      loanInput({
        amountBorrowed: 100_000,
        annualInterestRatePercent: 12,
        loanLengthYears: 10,
        offsetSavings: { enabled: true, amount: 100_000 },
      })
    );

    expect(activeSchedule.periodRows[0].interestPaid).toBe(0);
    expect(activeSchedule.summary.totalInterestPaid).toBe(0);

    // Every repayment is pure principal, so the loan clears in
    // ceil(100,000 / 1,434.71) = 70 of its 120 scheduled periods.
    expect(activeSchedule.summary.payoffPeriods).toBe(70);
  });

  it("charges interest only on the balance above the offset", () => {
    const { activeSchedule } = calculateLoan(
      loanInput({
        amountBorrowed: 100_000,
        annualInterestRatePercent: 12,
        loanLengthYears: 10,
        offsetSavings: { enabled: true, amount: 40_000 },
      })
    );

    // (100,000 - 40,000) at 1% = 600
    expect(activeSchedule.periodRows[0].interestPaid).toBe(600);
  });

  it("grows the offset by each recurring deposit", () => {
    const { activeSchedule } = calculateLoan(
      loanInput({
        amountBorrowed: 100_000,
        annualInterestRatePercent: 12,
        loanLengthYears: 10,
        offsetSavings: {
          enabled: true,
          amount: 10_000,
          contribution: { enabled: true, amount: 500, frequency: "monthly" },
        },
      })
    );

    // Deposits land after the interest charge, so period 1 still uses 10,000.
    expect(activeSchedule.periodRows[0].interestPaid).toBe(900);
    // ...and period 2 sees 10,500.
    expect(activeSchedule.periodRows[1].interestPaid).toBeCloseTo(
      (activeSchedule.periodRows[1].openingBalance - 10_500) * 0.01,
      2
    );
    expect(activeSchedule.yearlyRows[0].offsetBalance).toBeCloseTo(16_000, 2);
  });

  it("ignores an offset deposit whose section is switched off", () => {
    const { activeSchedule } = calculateLoan(
      loanInput({
        amountBorrowed: 100_000,
        annualInterestRatePercent: 12,
        loanLengthYears: 10,
        offsetSavings: {
          enabled: false,
          amount: 100_000,
          contribution: { enabled: true, amount: 500, frequency: "monthly" },
        },
      })
    );

    expect(activeSchedule.periodRows[0].interestPaid).toBe(1_000);
  });
});

describe("extra repayments", () => {
  it("withholds extras until the start delay has passed", () => {
    const { activeSchedule } = calculateLoan(
      loanInput({
        extraRepayment: {
          enabled: true,
          amount: 500,
          frequency: "monthly",
          startAfterValue: 12,
          startAfterUnit: "months",
        },
      })
    );

    expect(activeSchedule.periodRows[11].extraPaid).toBe(0); // 12th repayment
    expect(activeSchedule.periodRows[12].extraPaid).toBe(500); // 13th
  });

  it("reads a delay given in years the same as the equivalent months", () => {
    const inYears = calculateLoan(
      loanInput({
        extraRepayment: {
          enabled: true,
          amount: 500,
          frequency: "monthly",
          startAfterValue: 1,
          startAfterUnit: "years",
        },
      })
    );
    const inMonths = calculateLoan(
      loanInput({
        extraRepayment: {
          enabled: true,
          amount: 500,
          frequency: "monthly",
          startAfterValue: 12,
          startAfterUnit: "months",
        },
      })
    );

    expect(inYears.activeSchedule.summary.payoffPeriods).toBe(
      inMonths.activeSchedule.summary.payoffPeriods
    );
    expect(inYears.activeSchedule.summary.totalExtraPaid).toBeCloseTo(
      inMonths.activeSchedule.summary.totalExtraPaid,
      2
    );
  });

  it("spaces monthly extras correctly across weekly repayments", () => {
    const { activeSchedule } = calculateLoan(
      loanInput({
        repaymentFrequency: "weekly",
        extraRepayment: {
          enabled: true,
          amount: 100,
          frequency: "monthly",
          startAfterValue: 0,
          startAfterUnit: "months",
        },
      })
    );

    const firstYear = activeSchedule.periodRows.slice(0, 52);
    const events = firstYear.filter((row) => row.extraPaid > 0);
    expect(events).toHaveLength(12);
    expect(activeSchedule.periodRows[0].extraPaid).toBe(0); // only 12/52 of an event
  });

  it("shortens the loan and saves interest against the contracted terms", () => {
    const result = calculateLoan(
      loanInput({
        extraRepayment: {
          enabled: true,
          amount: 500,
          frequency: "monthly",
          startAfterValue: 0,
          startAfterUnit: "months",
        },
      })
    );

    expect(result.hasPlanComparison).toBe(true);
    expect(result.withExtra).toBeDefined();
    expect(result.savings.periodsSaved).toBeGreaterThan(0);
    expect(result.savings.interestSaved).toBeGreaterThan(0);
    expect(result.savings.moneySaved).toBeGreaterThan(0);
    expect(result.activeSchedule.summary.payoffPeriods).toBeLessThan(
      result.contracted.summary.payoffPeriods
    );
  });

  it("keeps the baseline free of extras so the repayment stays comparable", () => {
    const result = calculateLoan(
      loanInput({
        extraRepayment: {
          enabled: true,
          amount: 500,
          frequency: "monthly",
          startAfterValue: 0,
          startAfterUnit: "months",
        },
      })
    );

    expect(result.baseline.summary.totalExtraPaid).toBe(0);
    expect(result.baseline.summary.payoffPeriods).toBe(360);
  });

  it("never pays more extra than the balance left", () => {
    const { activeSchedule } = calculateLoan(
      loanInput({
        amountBorrowed: 20_000,
        loanLengthYears: 10,
        extraRepayment: {
          enabled: true,
          amount: 5_000,
          frequency: "monthly",
          startAfterValue: 0,
          startAfterUnit: "months",
        },
      })
    );

    expect(lastRow(activeSchedule.periodRows).closingBalance).toBe(0);
    expect(
      activeSchedule.summary.totalPrincipalPaid +
        activeSchedule.summary.totalExtraPaid
    ).toBeCloseTo(20_000, 2);
  });
});

describe("lump sum residual", () => {
  const withBalloon = () =>
    calculateLoan(
      loanInput({
        amountBorrowed: 100_000,
        loanLengthYears: 5,
        lumpSum: { enabled: true, amount: 20_000 },
      })
    );

  it("lowers the scheduled repayment by the residual", () => {
    const expected = annuityPayment(100_000, 0.06 / 12, 60, 20_000);
    expect(expected).toBeCloseTo(1646.62, 2);

    const { activeSchedule } = withBalloon();
    const first = activeSchedule.periodRows[0];
    expect(first.interestPaid + first.principalPaid).toBeCloseTo(expected, 2);
  });

  it("clears the residual in the final scheduled period", () => {
    const { activeSchedule } = withBalloon();
    expect(activeSchedule.summary.payoffPeriods).toBe(60);
    expect(lastRow(activeSchedule.periodRows).closingBalance).toBe(0);
    // The last repayment carries the residual on top of its own principal.
    expect(lastRow(activeSchedule.periodRows).principalPaid).toBeGreaterThan(
      20_000
    );
  });

  it("costs more overall, so the reported saving is negative", () => {
    const result = withBalloon();
    expect(result.hasPlanComparison).toBe(true);
    expect(result.savings.moneySaved).toBeLessThan(0);
    expect(result.savings.interestSaved).toBeLessThan(0);
  });
});

describe("plan comparison", () => {
  it("skips the comparison when nothing optional is switched on", () => {
    const result = calculateLoan(loanInput());

    expect(result.hasPlanComparison).toBe(false);
    expect(result.withExtra).toBeUndefined();
    expect(result.contracted).toBe(result.baseline);
    expect(result.savings).toEqual({
      moneySaved: 0,
      interestSaved: 0,
      periodsSaved: 0,
      yearsSaved: 0,
    });
  });

  it("flags each optional section as a plan adjustment", () => {
    expect(hasPlanAdjustments(loanInput())).toBe(false);
    expect(
      hasPlanAdjustments(loanInput({ lumpSum: { enabled: true, amount: 1_000 } }))
    ).toBe(true);
    expect(
      hasPlanAdjustments(
        loanInput({ offsetSavings: { enabled: true, amount: 1_000 } })
      )
    ).toBe(true);
    expect(
      hasPlanAdjustments(
        loanInput({
          extraRepayment: {
            enabled: true,
            amount: 100,
            frequency: "monthly",
            startAfterValue: 0,
            startAfterUnit: "months",
          },
        })
      )
    ).toBe(true);
  });

  it("measures an offset-only plan against the contracted loan", () => {
    const result = calculateLoan(
      loanInput({ offsetSavings: { enabled: true, amount: 50_000 } })
    );

    expect(result.contracted.summary.payoffPeriods).toBe(360);
    expect(result.savings.interestSaved).toBeGreaterThan(0);
    expect(result.savings.periodsSaved).toBeGreaterThan(0);
  });
});

describe("validateLoanInput", () => {
  it("accepts a loan with no interest rate", () => {
    const result = validateLoanInput(loanInput({ annualInterestRatePercent: 0 }));
    expect(result).toEqual({ ready: true, error: null });
  });

  it("blocks a missing amount, term or currency", () => {
    expect(validateLoanInput(loanInput({ amountBorrowed: 0 })).ready).toBe(false);
    expect(validateLoanInput(loanInput({ amountBorrowed: 0 })).error).toBeTruthy();
    expect(validateLoanInput(loanInput({ currencyCode: "  " })).ready).toBe(false);
  });

  it("blocks an optional section switched on but left empty", () => {
    expect(
      validateLoanInput(
        loanInput({
          extraRepayment: {
            enabled: true,
            amount: 0,
            frequency: "monthly",
            startAfterValue: 0,
            startAfterUnit: "months",
          },
        })
      ).error
    ).toBeTruthy();

    expect(
      validateLoanInput(loanInput({ lumpSum: { enabled: true, amount: 0 } })).error
    ).toBeTruthy();

    expect(
      validateLoanInput(loanInput({ accountFeeEnabled: true, accountFee: 0 })).error
    ).toBeTruthy();

    expect(
      validateLoanInput(
        loanInput({
          offsetSavings: {
            enabled: true,
            amount: 0,
            contribution: { enabled: false, amount: 0, frequency: "monthly" },
          },
        })
      ).error
    ).toBeTruthy();
  });

  it("accepts an offset funded only by recurring deposits", () => {
    expect(
      validateLoanInput(
        loanInput({
          offsetSavings: {
            enabled: true,
            amount: 0,
            contribution: { enabled: true, amount: 500, frequency: "monthly" },
          },
        })
      ).error
    ).toBeNull();
  });
});

describe("normalizeInput", () => {
  it("fills an empty profile with usable defaults", () => {
    const result = normalizeInput({});
    expect(result.currencyCode).toBe("AUD");
    expect(result.repaymentFrequency).toBe("monthly");
    expect(result.amountBorrowed).toBe(0);
    expect(result.extraRepayment.enabled).toBe(false);
  });

  it("converts a legacy period-based extra repayment delay into months", () => {
    const result = normalizeInput({
      repaymentFrequency: "fortnightly",
      extraRepayment: {
        startAfterPeriods: 26,
      },
    } as never);

    expect(result.extraRepayment.startAfterValue).toBe(12);
    expect(result.extraRepayment.startAfterUnit).toBe("months");
  });

  it("treats a stored fee from before the toggle existed as enabled", () => {
    expect(normalizeInput({ accountFee: 395 }).accountFeeEnabled).toBe(true);
    expect(normalizeInput({ accountFee: 0 }).accountFeeEnabled).toBe(false);
    expect(
      normalizeInput({ accountFee: 395, accountFeeEnabled: false }).accountFeeEnabled
    ).toBe(false);
  });

  it("clamps negatives and an impossibly short term", () => {
    const result = normalizeInput({
      amountBorrowed: -1,
      annualInterestRatePercent: -5,
      loanLengthYears: 0,
    });

    expect(result.amountBorrowed).toBe(0);
    expect(result.annualInterestRatePercent).toBe(0);
    expect(result.loanLengthYears).toBe(MIN_LOAN_LENGTH_YEARS);
  });

  it("falls back to monthly for an unknown offset deposit frequency", () => {
    const result = normalizeInput({
      offsetSavings: {
        enabled: true,
        amount: 1_000,
        contribution: { enabled: true, amount: 100, frequency: "daily" },
      },
    } as never);

    expect(result.offsetSavings.contribution.frequency).toBe("monthly");
  });
});
