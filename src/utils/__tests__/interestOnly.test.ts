import { type InterestOnlyConfig } from "../../types/loan";
import { calculateLoan, normalizeInput, validateLoanInput } from "../loanMath";
import { loanInput } from "./fixtures";

/** Level repayment from the closed-form annuity formula. */
const annuityPayment = (
  principal: number,
  periodRate: number,
  periods: number,
  futureValue = 0
) => {
  const factor = (1 + periodRate) ** periods;
  return (principal * periodRate * factor - futureValue * periodRate) / (factor - 1);
};

const fiveYearsInterestOnly: InterestOnlyConfig = {
  enabled: true,
  lengthValue: 5,
  lengthUnit: "years",
};

const rowAt = <T,>(rows: T[], period: number): T => rows[period - 1];

describe("interest-only period", () => {
  // $300k at 6% over 30 years: 5 years interest only, then 25 years of P&I.
  const interestOnlyPayment = 1500;
  const principalAndInterest = annuityPayment(300_000, 0.005, 300);

  it("charges interest only, then repays over the rest of the term", () => {
    const { activeSchedule } = calculateLoan(
      loanInput({ interestOnly: fiveYearsInterestOnly })
    );

    for (const period of [1, 30, 60]) {
      const row = rowAt(activeSchedule.periodRows, period);
      expect(row.interestPaid).toBe(interestOnlyPayment);
      expect(row.principalPaid).toBe(0);
      expect(row.closingBalance).toBe(300_000);
    }

    const firstRepaying = rowAt(activeSchedule.periodRows, 61);
    expect(firstRepaying.interestPaid).toBe(interestOnlyPayment);
    expect(firstRepaying.principalPaid + firstRepaying.interestPaid).toBeCloseTo(
      principalAndInterest,
      2
    );
    expect(activeSchedule.summary.payoffPeriods).toBe(360);
    expect(rowAt(activeSchedule.periodRows, 360).closingBalance).toBe(0);
  });

  it("costs more interest than the same loan repaid from the start", () => {
    const plain = calculateLoan(loanInput()).activeSchedule.summary;
    const { summary } = calculateLoan(
      loanInput({ interestOnly: fiveYearsInterestOnly })
    ).activeSchedule;

    expect(summary.totalPrincipalPaid).toBeCloseTo(300_000, 2);
    expect(summary.totalInterestPaid).toBeCloseTo(
      60 * interestOnlyPayment + 300 * principalAndInterest - 300_000,
      0
    );
    expect(summary.totalInterestPaid).toBeGreaterThan(plain.totalInterestPaid);
  });

  it("reports the interest-only phase and the repayment that follows", () => {
    const { repaymentPhases } = calculateLoan(
      loanInput({ interestOnly: fiveYearsInterestOnly })
    );

    expect(repaymentPhases).toEqual([
      {
        firstPeriod: 1,
        annualInterestRatePercent: 6,
        interestOnly: true,
        repayment: interestOnlyPayment,
      },
      {
        firstPeriod: 61,
        annualInterestRatePercent: 6,
        interestOnly: false,
        repayment: expect.any(Number),
      },
    ]);
    expect(repaymentPhases[1].repayment).toBeCloseTo(principalAndInterest, 2);
  });

  it("follows a rate change inside the interest-only period", () => {
    const { repaymentPhases } = calculateLoan(
      loanInput({
        interestOnly: fiveYearsInterestOnly,
        rateChanges: {
          enabled: true,
          changes: [
            {
              id: "rise",
              startAfterValue: 3,
              startAfterUnit: "years",
              annualInterestRatePercent: 7,
            },
          ],
        },
      })
    );

    expect(
      repaymentPhases.map(({ firstPeriod, annualInterestRatePercent, interestOnly }) => ({
        firstPeriod,
        annualInterestRatePercent,
        interestOnly,
      }))
    ).toEqual([
      { firstPeriod: 1, annualInterestRatePercent: 6, interestOnly: true },
      { firstPeriod: 37, annualInterestRatePercent: 7, interestOnly: true },
      { firstPeriod: 61, annualInterestRatePercent: 7, interestOnly: false },
    ]);
    expect(repaymentPhases[1].repayment).toBe(1750);
    expect(repaymentPhases[2].repayment).toBeCloseTo(
      annuityPayment(300_000, 0.07 / 12, 300),
      2
    );
  });

  it("merges a rate change that lands where interest-only ends", () => {
    const { repaymentPhases } = calculateLoan(
      loanInput({
        interestOnly: fiveYearsInterestOnly,
        rateChanges: {
          enabled: true,
          changes: [
            {
              id: "rise",
              startAfterValue: 60,
              startAfterUnit: "months",
              annualInterestRatePercent: 7,
            },
          ],
        },
      })
    );

    expect(repaymentPhases).toHaveLength(2);
    expect(repaymentPhases[1]).toMatchObject({
      firstPeriod: 61,
      annualInterestRatePercent: 7,
      interestOnly: false,
    });
  });

  it("charges interest-only repayments on the balance above the offset", () => {
    const result = calculateLoan(
      loanInput({
        interestOnly: fiveYearsInterestOnly,
        offsetSavings: { enabled: true, amount: 100_000 },
      })
    );

    const row = rowAt(result.activeSchedule.periodRows, 1);
    expect(row.interestPaid).toBe(1000); // 200,000 at 0.5%
    expect(row.principalPaid).toBe(0);
    expect(result.repaymentPhases[0].repayment).toBe(1000);
    // The offset does not lower the P&I repayment that follows.
    expect(result.repaymentPhases[1].repayment).toBeCloseTo(principalAndInterest, 2);
  });

  it("lets extra repayments cut the balance during the interest-only period", () => {
    const result = calculateLoan(
      loanInput({
        interestOnly: fiveYearsInterestOnly,
        extraRepayment: { enabled: true, amount: 500, frequency: "monthly" },
      })
    );
    const withExtra = result.withExtra!;

    expect(rowAt(withExtra.periodRows, 60).closingBalance).toBeCloseTo(270_000, 2);
    // The repayment after the period is still set on the full $300k.
    const row = rowAt(withExtra.periodRows, 61);
    expect(row.principalPaid + row.interestPaid).toBeCloseTo(principalAndInterest, 2);
    expect(withExtra.summary.payoffPeriods).toBeLessThan(360);
    expect(result.contracted.summary.payoffPeriods).toBe(360);
  });

  it("repays down to a lump sum residual after the period", () => {
    const { activeSchedule, repaymentPhases } = calculateLoan(
      loanInput({
        interestOnly: fiveYearsInterestOnly,
        lumpSum: { enabled: true, amount: 50_000 },
      })
    );

    expect(repaymentPhases[1].repayment).toBeCloseTo(
      annuityPayment(300_000, 0.005, 300, 50_000),
      2
    );
    expect(activeSchedule.summary.payoffPeriods).toBe(360);
    expect(rowAt(activeSchedule.periodRows, 360).principalPaid).toBeGreaterThan(50_000);
  });

  it("ignores the period while the section is switched off", () => {
    const off = calculateLoan(
      loanInput({ interestOnly: { ...fiveYearsInterestOnly, enabled: false } })
    );

    expect(off.repaymentPhases).toHaveLength(1);
    expect(off.activeSchedule.summary).toEqual(
      calculateLoan(loanInput()).activeSchedule.summary
    );
  });
});

describe("interest-only validation", () => {
  const errorFor = (interestOnly: InterestOnlyConfig) =>
    validateLoanInput(loanInput({ interestOnly })).error;

  it("asks for a length once the section is on", () => {
    expect(errorFor({ ...fiveYearsInterestOnly, lengthValue: 0 })).toMatch(
      /how long/i
    );
    expect(errorFor({ ...fiveYearsInterestOnly, lengthValue: 0, enabled: false })).toBeNull();
  });

  it("requires the period to end before the loan does", () => {
    expect(errorFor({ ...fiveYearsInterestOnly, lengthValue: 30 })).toMatch(
      /end before the loan/i
    );
    expect(
      errorFor({ enabled: true, lengthValue: 359, lengthUnit: "months" })
    ).toBeNull();
  });
});

describe("normalizing the interest-only period", () => {
  it("treats a profile saved before the option existed as P&I", () => {
    expect(normalizeInput({ amountBorrowed: 1_000 }).interestOnly).toEqual({
      enabled: false,
      lengthValue: 0,
      lengthUnit: "years",
    });
  });

  it("repairs a malformed length and unit", () => {
    expect(
      normalizeInput({
        interestOnly: { enabled: true, lengthValue: "abc", lengthUnit: "weeks" },
      } as never).interestOnly
    ).toEqual({ enabled: true, lengthValue: 0, lengthUnit: "years" });
  });
});
