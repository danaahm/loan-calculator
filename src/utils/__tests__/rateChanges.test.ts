import { type RateChange, type RateChangesConfig } from "../../types/loan";
import { calculateLoan, normalizeInput, validateLoanInput } from "../loanMath";
import { loanInput } from "./fixtures";

/**
 * Expected figures come from the closed-form annuity and balance formulas,
 * worked independently of the period-by-period simulation.
 */
const annuityPayment = (principal: number, periodRate: number, periods: number) => {
  if (periodRate === 0) {
    return principal / periods;
  }
  const factor = (1 + periodRate) ** periods;
  return (principal * periodRate * factor) / (factor - 1);
};

/** Balance left after `periods` level repayments of `payment`. */
const balanceAfter = (
  principal: number,
  periodRate: number,
  payment: number,
  periods: number
) => {
  const factor = (1 + periodRate) ** periods;
  return principal * factor - (payment * (factor - 1)) / periodRate;
};

const rateChanges = (
  ...changes: Array<Omit<RateChange, "id">>
): RateChangesConfig => ({
  enabled: true,
  changes: changes.map((change, index) => ({ id: `change-${index}`, ...change })),
});

const rowAt = <T,>(rows: T[], period: number): T => rows[period - 1];

describe("rate changes", () => {
  // $300k at 6% over 30 years, rising to 7% after five years.
  const firstPayment = annuityPayment(300_000, 0.005, 360);
  const balanceAtChange = balanceAfter(300_000, 0.005, firstPayment, 60);
  const secondPayment = annuityPayment(balanceAtChange, 0.07 / 12, 300);

  const rateRise = () =>
    loanInput({
      rateChanges: rateChanges({
        startAfterValue: 5,
        startAfterUnit: "years",
        annualInterestRatePercent: 7,
      }),
    });

  it("recalculates the repayment so the loan still ends on time", () => {
    const { activeSchedule } = calculateLoan(rateRise());

    const lastAtOldRate = rowAt(activeSchedule.periodRows, 60);
    const firstAtNewRate = rowAt(activeSchedule.periodRows, 61);
    expect(lastAtOldRate.principalPaid + lastAtOldRate.interestPaid).toBeCloseTo(
      firstPayment,
      1
    );
    expect(firstAtNewRate.openingBalance).toBeCloseTo(balanceAtChange, 1);
    expect(firstAtNewRate.interestPaid).toBeCloseTo((balanceAtChange * 0.07) / 12, 1);
    expect(firstAtNewRate.principalPaid + firstAtNewRate.interestPaid).toBeCloseTo(
      secondPayment,
      1
    );

    expect(activeSchedule.summary.payoffPeriods).toBe(360);
    expect(activeSchedule.periodRows[359].closingBalance).toBe(0);
  });

  it("reports each phase with its rate and repayment", () => {
    const { repaymentPhases } = calculateLoan(rateRise());

    expect(repaymentPhases).toHaveLength(2);
    expect(repaymentPhases[0]).toEqual({
      firstPeriod: 1,
      annualInterestRatePercent: 6,
      repayment: expect.any(Number),
    });
    expect(repaymentPhases[0].repayment).toBeCloseTo(firstPayment, 2);
    expect(repaymentPhases[1].firstPeriod).toBe(61);
    expect(repaymentPhases[1].annualInterestRatePercent).toBe(7);
    expect(repaymentPhases[1].repayment).toBeCloseTo(secondPayment, 1);
  });

  it("has a single phase when there are no changes", () => {
    const { repaymentPhases } = calculateLoan(loanInput());

    expect(repaymentPhases).toHaveLength(1);
    expect(repaymentPhases[0].repayment).toBeCloseTo(firstPayment, 2);
  });

  it("ignores changes while the section is switched off", () => {
    const input = rateRise();
    const off = calculateLoan({
      ...input,
      rateChanges: { ...input.rateChanges, enabled: false },
    });

    expect(off.repaymentPhases).toHaveLength(1);
    expect(off.activeSchedule.summary).toEqual(
      calculateLoan(loanInput()).activeSchedule.summary
    );
  });

  it("applies changes in time order whatever order they were entered", () => {
    const entered = loanInput({
      rateChanges: rateChanges(
        { startAfterValue: 10, startAfterUnit: "years", annualInterestRatePercent: 5 },
        { startAfterValue: 24, startAfterUnit: "months", annualInterestRatePercent: 8 }
      ),
    });

    const phases = calculateLoan(entered).repaymentPhases;
    expect(phases.map((phase) => phase.firstPeriod)).toEqual([1, 25, 121]);
    expect(phases.map((phase) => phase.annualInterestRatePercent)).toEqual([6, 8, 5]);
  });

  it("repays in equal principal instalments after a cut to 0%", () => {
    const input = loanInput({
      rateChanges: rateChanges({
        startAfterValue: 5,
        startAfterUnit: "years",
        annualInterestRatePercent: 0,
      }),
    });
    const { activeSchedule } = calculateLoan(input);

    const row = rowAt(activeSchedule.periodRows, 61);
    expect(row.interestPaid).toBe(0);
    expect(row.principalPaid).toBeCloseTo(balanceAtChange / 300, 1);
    expect(activeSchedule.summary.payoffPeriods).toBe(360);
  });

  it("sets the new repayment on the contracted balance, not the reduced one", () => {
    const input = loanInput({
      rateChanges: rateRise().rateChanges,
      extraRepayment: { enabled: true, amount: 500, frequency: "monthly" },
    });
    const result = calculateLoan(input);
    const withExtra = result.withExtra!;

    // Extras lower the balance, but the scheduled repayment is the same one
    // the plain loan gets, so the extras shorten the loan instead.
    const row = rowAt(withExtra.periodRows, 61);
    expect(row.openingBalance).toBeLessThan(balanceAtChange);
    expect(row.principalPaid + row.interestPaid).toBeCloseTo(secondPayment, 1);
    expect(withExtra.summary.payoffPeriods).toBeLessThan(360);
  });

  it("keeps rate changes in the contracted loan that savings are measured against", () => {
    const input = loanInput({
      rateChanges: rateRise().rateChanges,
      extraRepayment: { enabled: true, amount: 500, frequency: "monthly" },
    });
    const { contracted } = calculateLoan(input);

    expect(contracted.summary).toEqual(calculateLoan(rateRise()).activeSchedule.summary);
  });

  it("re-spreads a lump sum residual over the remaining term", () => {
    const input = loanInput({
      rateChanges: rateRise().rateChanges,
      lumpSum: { enabled: true, amount: 50_000 },
    });
    const { activeSchedule } = calculateLoan(input);

    expect(activeSchedule.summary.payoffPeriods).toBe(360);
    const finalRow = rowAt(activeSchedule.periodRows, 360);
    // The last repayment carries the residual.
    expect(finalRow.principalPaid).toBeGreaterThan(50_000);
    expect(finalRow.closingBalance).toBe(0);
  });

  it("drops a phase the loan never reaches", () => {
    // With the offset covering the balance every repayment is principal, so
    // $10k clears in 167 repayments, well before a change after 15 years.
    const input = loanInput({
      amountBorrowed: 10_000,
      rateChanges: rateChanges({
        startAfterValue: 15,
        startAfterUnit: "years",
        annualInterestRatePercent: 7,
      }),
      offsetSavings: { enabled: true, amount: 10_000 },
    });
    const result = calculateLoan(input);

    expect(result.baseline.summary.payoffPeriods).toBeLessThan(181);
    expect(result.repaymentPhases).toHaveLength(1);
  });
});

describe("rate change validation", () => {
  const errorFor = (changes: RateChangesConfig) =>
    validateLoanInput(loanInput({ rateChanges: changes })).error;

  it("asks for a change once the section is on", () => {
    expect(errorFor({ enabled: true, changes: [] })).toMatch(/rate change/i);
    expect(errorFor({ enabled: false, changes: [] })).toBeNull();
  });

  it("rejects a change at the start of the loan or past its end", () => {
    expect(
      errorFor(
        rateChanges({ startAfterValue: 0, startAfterUnit: "months", annualInterestRatePercent: 7 })
      )
    ).toMatch(/before the loan ends/i);
    expect(
      errorFor(
        rateChanges({ startAfterValue: 30, startAfterUnit: "years", annualInterestRatePercent: 7 })
      )
    ).toMatch(/before the loan ends/i);
    expect(
      errorFor(
        rateChanges({ startAfterValue: 29, startAfterUnit: "years", annualInterestRatePercent: 7 })
      )
    ).toBeNull();
  });

  it("rejects two changes on the same repayment", () => {
    expect(
      errorFor(
        rateChanges(
          { startAfterValue: 1, startAfterUnit: "years", annualInterestRatePercent: 7 },
          { startAfterValue: 12, startAfterUnit: "months", annualInterestRatePercent: 8 }
        )
      )
    ).toMatch(/same repayment/i);
  });
});

describe("normalizing rate changes", () => {
  it("gives a profile saved before rate changes existed none, switched off", () => {
    expect(normalizeInput({ amountBorrowed: 1_000 }).rateChanges).toEqual({
      enabled: false,
      changes: [],
    });
  });

  it("repairs malformed entries instead of dropping the profile", () => {
    const result = normalizeInput({
      rateChanges: {
        enabled: true,
        changes: [
          { startAfterValue: 2.7, startAfterUnit: "decades", annualInterestRatePercent: -1 },
          null,
          { id: "kept", startAfterValue: 3, startAfterUnit: "years", annualInterestRatePercent: 7.5 },
        ],
      },
    } as never);

    expect(result.rateChanges).toEqual({
      enabled: true,
      changes: [
        {
          id: "rate-change-1",
          startAfterValue: 2,
          startAfterUnit: "months",
          annualInterestRatePercent: 0,
        },
        {
          id: "kept",
          startAfterValue: 3,
          startAfterUnit: "years",
          annualInterestRatePercent: 7.5,
        },
      ],
    });
  });
});
