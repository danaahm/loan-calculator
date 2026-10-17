import { normalizeReminder } from "../../storage/localState";
import { type SavedLoanProfile } from "../../types/loan";
import { type LoanReminder } from "../../types/reminder";
import {
  addRateChange,
  amountDueForReminder,
  calculateRepaymentAfterInterestOnly,
  calculateRepaymentAfterRateChange,
  catchUpReminder,
  draftFromSavedProfile,
  estimatePayoffDate,
  isInterestOnlyDue,
  projectUpcomingCycles,
  refreshTermsFromProfile,
  undoLastPayment,
} from "../reminderMath";
import { loanInput, reminder } from "./fixtures";

/** Local midnight, matching how `dateIso` builds and reads ISO days. */
const freezeToday = (iso: string): void => {
  const [year, month, day] = iso.split("-").map(Number);
  jest.useFakeTimers();
  jest.setSystemTime(new Date(year, month - 1, day, 9, 0, 0));
};

afterEach(() => {
  jest.useRealTimers();
});

const annuityPayment = (principal: number, periodRate: number, periods: number) => {
  const factor = (1 + periodRate) ** periods;
  return (principal * periodRate * factor) / (factor - 1);
};

/**
 * $120,000 at 12% (1% a month), due on the 15th from 15 Jan 2026. Interest
 * only up to and including 15 Mar, then $2,000 principal and interest.
 */
const interestOnlyLoan = (overrides: Partial<LoanReminder> = {}): LoanReminder =>
  reminder({
    originalAmount: 120_000,
    remainingBalance: 120_000,
    annualInterestRatePercent: 12,
    repaymentAmount: 2_000,
    interestOnlyUntil: "2026-03-15",
    ...overrides,
  });

describe("interest-only period on a reminder", () => {
  it("treats repayments due up to and including the end date as interest only", () => {
    const item = interestOnlyLoan();
    expect(isInterestOnlyDue(item, "2026-03-15")).toBe(true);
    expect(isInterestOnlyDue(item, "2026-03-16")).toBe(false);
    expect(isInterestOnlyDue(interestOnlyLoan({ interestOnlyUntil: null }), "2026-01-15")).toBe(
      false
    );
  });

  it("charges interest only, then starts repaying principal", () => {
    const { reminder: caughtUp } = catchUpReminder(interestOnlyLoan(), "2026-05-15");

    expect(
      caughtUp.payments.map(({ date, interestPortion, principalPortion, remainingAfter }) => ({
        date,
        interestPortion,
        principalPortion,
        remainingAfter,
      }))
    ).toEqual([
      { date: "2026-01-15", interestPortion: 1_200, principalPortion: 0, remainingAfter: 120_000 },
      { date: "2026-02-15", interestPortion: 1_200, principalPortion: 0, remainingAfter: 120_000 },
      { date: "2026-03-15", interestPortion: 1_200, principalPortion: 0, remainingAfter: 120_000 },
      // From here the $2,000 repayment covers the interest and repays the rest.
      { date: "2026-04-15", interestPortion: 1_200, principalPortion: 800, remainingAfter: 119_200 },
      { date: "2026-05-15", interestPortion: 1_192, principalPortion: 808, remainingAfter: 118_392 },
    ]);
  });

  it("asks for the interest, then the full repayment", () => {
    const item = interestOnlyLoan({ accountFee: 10 });
    expect(amountDueForReminder(item)).toBe(1_210);

    const { reminder: afterPeriod } = catchUpReminder(item, "2026-03-15");
    expect(afterPeriod.nextPaymentDate).toBe("2026-04-15");
    expect(amountDueForReminder(afterPeriod)).toBe(2_010);
  });

  it("charges interest-only repayments on the balance above the offset", () => {
    const { reminder: caughtUp } = catchUpReminder(
      interestOnlyLoan({
        offsetBalance: 20_000,
        offsetDeposit: { amount: 10_000, frequency: "monthly" },
      }),
      "2026-02-15"
    );

    // The offset grows after each repayment, so the next one is lower.
    expect(caughtUp.payments.map((payment) => payment.amountPaid)).toEqual([1_000, 900]);
    expect(caughtUp.remainingBalance).toBe(120_000);
  });

  it("lets regular extras cut the balance, and the interest with it", () => {
    const { reminder: caughtUp } = catchUpReminder(
      interestOnlyLoan({ extraRepayment: { amount: 1_000, frequency: "monthly" } }),
      "2026-02-15"
    );

    expect(caughtUp.payments.map((payment) => payment.interestPortion)).toEqual([
      1_200,
      1_190,
    ]);
    expect(caughtUp.remainingBalance).toBe(118_000);
  });

  it("projects the coming interest-only and principal repayments", () => {
    freezeToday("2026-01-01");
    const cycles = projectUpcomingCycles(interestOnlyLoan(), 365, 5);

    expect(cycles.map((cycle) => cycle.amountDue)).toEqual([
      1_200, 1_200, 1_200, 2_000, 2_000,
    ]);
    expect(cycles[3].remainingAfter).toBe(119_200);
  });

  it("estimates a payoff date instead of giving up during the interest-only period", () => {
    // After three interest-only months, $2,000 a month at 1% clears $120,000
    // in 93 repayments: 15 Apr 2026 to 15 Dec 2033.
    expect(estimatePayoffDate(interestOnlyLoan())).toBe("2033-12-15");
  });

  it("still reports a loan that never clears once repayments start", () => {
    expect(estimatePayoffDate(interestOnlyLoan({ repaymentAmount: 1_000 }))).toBeNull();
  });

  it("undoes an interest-only repayment like any other", () => {
    const { reminder: caughtUp } = catchUpReminder(interestOnlyLoan(), "2026-01-15");
    const undone = undoLastPayment(caughtUp);

    expect(undone.nextPaymentDate).toBe("2026-01-15");
    expect(undone.remainingBalance).toBe(120_000);
    expect(undone.payments).toHaveLength(0);
  });
});

describe("repayment after the interest-only period", () => {
  const tracked = (overrides: Partial<LoanReminder> = {}) =>
    interestOnlyLoan({ finalPaymentDate: "2026-12-15", ...overrides });

  it("spreads the balance over the repayments left after the period", () => {
    // 15 Apr to 15 Dec is nine repayments to clear $120,000 at 1% a month.
    expect(calculateRepaymentAfterInterestOnly(tracked())).toBeCloseTo(
      annuityPayment(120_000, 0.01, 9),
      2
    );
  });

  it("uses the rate in force when the period ends", () => {
    const withRise = addRateChange(tracked(), "2026-03-01", 24);
    expect(calculateRepaymentAfterInterestOnly(withRise)).toBeCloseTo(
      annuityPayment(120_000, 0.02, 9),
      2
    );
  });

  it("needs both an interest-only end and a final repayment date", () => {
    expect(calculateRepaymentAfterInterestOnly(tracked({ interestOnlyUntil: null }))).toBeNull();
    expect(calculateRepaymentAfterInterestOnly(tracked({ finalPaymentDate: null }))).toBeNull();
  });

  it("starts a rate change made during the period from the first principal repayment", () => {
    // Changing on 1 Feb still leaves the balance untouched until 15 Apr.
    expect(calculateRepaymentAfterRateChange(tracked(), "2026-02-01", 24)).toBeCloseTo(
      annuityPayment(120_000, 0.02, 9),
      2
    );
  });

  it("leaves a rate change after the period as it was", () => {
    // 15 Apr and 15 May repay principal first, then seven repayments remain.
    const { reminder: projected } = catchUpReminder(tracked(), "2026-05-15");
    expect(calculateRepaymentAfterRateChange(tracked(), "2026-06-01", 12)).toBeCloseTo(
      annuityPayment(projected.remainingBalance, 0.01, 7),
      2
    );
  });
});

describe("interest-only handoff from a saved loan", () => {
  const profile = (input = loanInput()): SavedLoanProfile => ({
    id: "profile-1",
    name: "Investment loan",
    input,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const fiveYearsInterestOnly = {
    interestOnly: { enabled: true, lengthValue: 5, lengthUnit: "years" as const },
  };

  it("ends the period its length after the loan's start date", () => {
    const draft = draftFromSavedProfile(
      profile(
        loanInput({
          ...fiveYearsInterestOnly,
          loanTermMode: "endDate",
          loanStartDate: "2026-01-01",
          loanEndDate: "2056-01-01",
        })
      )
    );

    expect(draft.interestOnlyUntil).toBe("2031-01-01");
  });

  it("takes a loan without a start date to start today", () => {
    freezeToday("2026-10-17");
    const draft = draftFromSavedProfile(profile(loanInput(fiveYearsInterestOnly)));

    expect(draft.interestOnlyUntil).toBe("2031-10-17");
  });

  it("seeds the principal-and-interest repayment, not the interest-only one", () => {
    const draft = draftFromSavedProfile(profile(loanInput(fiveYearsInterestOnly)));

    // $300k at 6% repaid over the 25 years left after the period.
    expect(draft.repaymentAmount).toBeCloseTo(annuityPayment(300_000, 0.005, 300), 2);
  });

  it("has no interest-only period when the profile has none", () => {
    expect(draftFromSavedProfile(profile()).interestOnlyUntil).toBeNull();
  });

  it("refreshes the end date only from a profile with its own start date", () => {
    const tracked = reminder({ interestOnlyUntil: "2030-06-15" });

    expect(
      refreshTermsFromProfile(tracked, profile(loanInput(fiveYearsInterestOnly)))
        .interestOnlyUntil
    ).toBe("2030-06-15");
    expect(
      refreshTermsFromProfile(
        tracked,
        profile(
          loanInput({
            ...fiveYearsInterestOnly,
            loanTermMode: "endDate",
            loanStartDate: "2026-01-01",
            loanEndDate: "2056-01-01",
          })
        )
      ).interestOnlyUntil
    ).toBe("2031-01-01");
  });
});

describe("stored interest-only end dates", () => {
  const stored = (interestOnlyUntil: unknown) =>
    normalizeReminder({ ...reminder(), interestOnlyUntil } as Partial<LoanReminder>);

  it("loads a reminder saved before the field existed with none", () => {
    const { interestOnlyUntil: _omitted, ...legacy } = reminder();
    expect(normalizeReminder(legacy as Partial<LoanReminder>)?.interestOnlyUntil).toBeNull();
  });

  it("keeps a valid date and drops anything else", () => {
    expect(stored("2027-06-30")?.interestOnlyUntil).toBe("2027-06-30");
    expect(stored("not a date")?.interestOnlyUntil).toBeNull();
    expect(stored(42)?.interestOnlyUntil).toBeNull();
  });
});
