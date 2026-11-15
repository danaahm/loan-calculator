import { formatCurrencyWhole } from "../format";
import { buildLiveEstimate } from "../liveEstimate";
import { loanInput } from "./fixtures";

describe("live repayment estimate", () => {
  it("gives the repayment and totals for a plain loan", () => {
    // $300k at 6% over 30 years, monthly: the textbook repayment is $1,798.65.
    const estimate = buildLiveEstimate(loanInput());

    expect(estimate).not.toBeNull();
    expect(estimate?.frequency).toBe("monthly");
    expect(estimate?.repayment).toBeCloseTo(1798.65, 2);
    expect(estimate?.principal).toBe(300_000);
    expect(estimate?.totalInterest).toBeCloseTo(347_514.57, 0);
    expect(estimate?.totalRepayments).toBeCloseTo(647_514.57, 0);
  });

  it("gives the repayment at the chosen frequency, not a monthly equivalent", () => {
    const monthly = buildLiveEstimate(loanInput());
    const fortnightly = buildLiveEstimate(loanInput({ repaymentFrequency: "fortnightly" }));

    expect(fortnightly?.frequency).toBe("fortnightly");
    expect(fortnightly?.repayment).toBeGreaterThan((monthly?.repayment ?? 0) * 0.45);
    expect(fortnightly?.repayment).toBeLessThan((monthly?.repayment ?? 0) * 0.5);
  });

  it("counts fees and extra repayments in the total, not in the repayment", () => {
    const plain = buildLiveEstimate(loanInput());
    const withFee = buildLiveEstimate(
      loanInput({ accountFeeEnabled: true, accountFee: 10, accountFeeFrequency: "monthly" })
    );

    expect(withFee?.repayment).toBeCloseTo(plain?.repayment ?? 0, 2);
    expect(withFee?.totalRepayments).toBeCloseTo((plain?.totalRepayments ?? 0) + 3600, 0);
  });

  it("shows less interest once extra repayments are switched on", () => {
    const plain = buildLiveEstimate(loanInput());
    const withExtra = buildLiveEstimate(
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

    expect(withExtra?.repayment).toBeCloseTo(plain?.repayment ?? 0, 2);
    expect(withExtra?.totalInterest).toBeLessThan(plain?.totalInterest ?? 0);
  });

  it("gives nothing until the form holds an amount and a term", () => {
    // Built by hand: the fixture normalises a zero term up to one month.
    expect(buildLiveEstimate({ ...loanInput(), amountBorrowed: 0 })).toBeNull();
    expect(buildLiveEstimate({ ...loanInput(), loanLengthYears: 0 })).toBeNull();
  });

  it("gives nothing while the form has an error", () => {
    const interestOnlyForWholeTerm = {
      ...loanInput(),
      interestOnly: { enabled: true, lengthValue: 30, lengthUnit: "years" as const },
    };

    expect(buildLiveEstimate(interestOnlyForWholeTerm)).toBeNull();
  });
});

describe("formatCurrencyWhole", () => {
  it("drops the cents and keeps the currency's own grouping", () => {
    expect(formatCurrencyWhole(1_185_076.4, "USD")).toBe("$1,185,076");
    expect(formatCurrencyWhole(1_185_076.4, "EUR")).toBe("€1.185.076");
  });

  it("rounds to the nearest whole unit", () => {
    expect(formatCurrencyWhole(2809.5, "USD")).toBe("$2,810");
    expect(formatCurrencyWhole(2809.49, "USD")).toBe("$2,809");
  });

  it("leaves a currency with no decimals as it is", () => {
    // A thousands group must not be mistaken for a fraction.
    expect(formatCurrencyWhole(1_185_000, "JPY")).toBe("¥ 1,185,000");
  });

  it("handles a currency with three decimals", () => {
    expect(formatCurrencyWhole(1_185_076, "KWD")).toMatch(/1,185,076$/);
  });

  it("treats a value that is not a number as zero", () => {
    expect(formatCurrencyWhole(Number.NaN, "USD")).toBe("$0");
  });
});
