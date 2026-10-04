import { type SavedLoanProfile } from "../../types/loan";
import { type LoanReminder } from "../../types/reminder";
import {
  addRateChange,
  amountDueForReminder,
  applyExtraPayment,
  buildUpcomingRepayments,
  calculateRepaymentAfterRateChange,
  catchUpReminder,
  catchUpReminders,
  draftFromSavedProfile,
  estimatePayoffDate,
  estimatePeriodRepaymentFromProfile,
  listUpcomingDates,
  payoffProgress,
  projectUpcomingCycles,
  rateAsOf,
  refreshTermsFromProfile,
  removeRateChange,
  repaymentAsOf,
  setReminderStatus,
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

describe("amountDueForReminder", () => {
  it("leaves a yearly fee off the eleven cycles it does not fall in", () => {
    const due = amountDueForReminder(
      reminder({
        repaymentAmount: 2_000,
        accountFee: 395,
        accountFeeFrequency: "yearly",
        feeEventCarry: 0,
      })
    );
    expect(due).toBe(2_000);
  });

  it("adds the yearly fee on the cycle its carry completes", () => {
    // Eleven monthly cycles have already banked 11/12 of a fee event, a sum
    // that lands just under 1 in floating point - the epsilon guard is what
    // makes the twelfth cycle charge.
    const due = amountDueForReminder(
      reminder({
        repaymentAmount: 2_000,
        accountFee: 395,
        accountFeeFrequency: "yearly",
        feeEventCarry: 11 / 12,
      })
    );
    expect(due).toBe(2_395);
  });

  it("carries every fee event when fees outpace repayments", () => {
    const due = amountDueForReminder(
      reminder({
        repaymentAmount: 12_000,
        repaymentFrequency: "yearly",
        accountFee: 10,
        accountFeeFrequency: "monthly",
      })
    );
    expect(due).toBe(12_120);
  });

  it("spreads a monthly fee across fortnightly repayments", () => {
    const due = amountDueForReminder(
      reminder({
        repaymentAmount: 500,
        repaymentFrequency: "fortnightly",
        accountFee: 26,
        accountFeeFrequency: "monthly",
      })
    );
    // 12/26 of a fee event in the first cycle is not yet a charge.
    expect(due).toBe(500);
  });
});

describe("payoffProgress", () => {
  it("reports the fraction of the original balance cleared", () => {
    expect(
      payoffProgress(reminder({ originalAmount: 100_000, remainingBalance: 25_000 }))
    ).toBeCloseTo(0.75, 6);
  });

  it("stays inside 0..1 for an unknown or grown balance", () => {
    expect(payoffProgress(reminder({ originalAmount: 0 }))).toBe(0);
    expect(
      payoffProgress(
        reminder({ originalAmount: 100_000, remainingBalance: 120_000 })
      )
    ).toBe(0);
    expect(
      payoffProgress(reminder({ originalAmount: 100_000, remainingBalance: 0 }))
    ).toBe(1);
  });
});

describe("rate changes", () => {
  const withChange = () =>
    addRateChange(
      reminder({ annualInterestRatePercent: 5 }),
      "2026-03-01",
      7
    );

  it("applies a change from its effective date, not the day after", () => {
    const item = withChange();
    expect(rateAsOf(item, "2026-02-28")).toBe(5);
    expect(rateAsOf(item, "2026-03-01")).toBe(7);
    expect(rateAsOf(item, "2026-03-02")).toBe(7);
  });

  it("uses the latest change on or before the date, whatever the input order", () => {
    let item = reminder({ annualInterestRatePercent: 5 });
    item = addRateChange(item, "2026-09-01", 9);
    item = addRateChange(item, "2026-03-01", 7);

    expect(rateAsOf(item, "2026-01-01")).toBe(5);
    expect(rateAsOf(item, "2026-06-01")).toBe(7);
    expect(rateAsOf(item, "2026-12-01")).toBe(9);
    expect(item.rateChanges.map((change) => change.effectiveDate)).toEqual([
      "2026-03-01",
      "2026-09-01",
    ]);
  });

  it("charges a change made on the due date from the following cycle", () => {
    const item = addRateChange(
      reminder({
        remainingBalance: 100_000,
        annualInterestRatePercent: 6,
        repaymentAmount: 2_000,
        nextPaymentDate: "2026-03-01",
        paymentDayOfMonth: 1,
      }),
      "2026-03-01",
      12
    );

    const { reminder: caughtUp } = catchUpReminder(item, "2026-04-01");
    // The 1 March repayment settles February's interest, all accrued at 6%.
    expect(caughtUp.payments[0].interestPortion).toBe(500);
    expect(caughtUp.payments[0].principalPortion).toBe(1_500);
    // March is the first month charged entirely at 12%: 98,500 at 1%.
    expect(caughtUp.payments[1].interestPortion).toBe(985);
  });

  it("splits a mid-cycle change by the days each rate applied", () => {
    const item = addRateChange(
      reminder({
        remainingBalance: 100_000,
        annualInterestRatePercent: 6,
        repaymentAmount: 2_000,
        nextPaymentDate: "2026-04-01",
        paymentDayOfMonth: 1,
      }),
      "2026-03-11",
      12
    );

    const { reminder: caughtUp } = catchUpReminder(item, "2026-04-01");
    // 10 of March's 31 days at 6% and 21 at 12%: an average of ~10.06%.
    const averageRate = (6 * 10 + 12 * 21) / 31;
    expect(caughtUp.payments[0].interestPortion).toBeCloseTo(
      (100_000 * averageRate) / 100 / 12,
      2
    );
  });

  it("drops a change by id and leaves the rest in place", () => {
    const item = withChange();
    const removed = removeRateChange(item, item.rateChanges[0].id);
    expect(removed.rateChanges).toHaveLength(0);
    expect(rateAsOf(removed, "2026-06-01")).toBe(5);
  });
});

describe("catchUpReminder", () => {
  it("applies one payment per missed cycle and advances the due date", () => {
    const { reminder: caughtUp, appliedCount } = catchUpReminder(
      reminder({ remainingBalance: 10_000, repaymentAmount: 1_000 }),
      "2026-04-15"
    );

    expect(appliedCount).toBe(4); // 15 Jan, Feb, Mar and Apr
    expect(caughtUp.remainingBalance).toBe(6_000);
    expect(caughtUp.nextPaymentDate).toBe("2026-05-15");
    expect(caughtUp.payments.map((payment) => payment.date)).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
    ]);
    expect(caughtUp.payments.every((payment) => payment.source === "auto")).toBe(
      true
    );
  });

  it("leaves a reminder alone while its next payment is still ahead", () => {
    const item = reminder({ nextPaymentDate: "2026-06-15" });
    const { reminder: caughtUp, appliedCount } = catchUpReminder(
      item,
      "2026-04-15"
    );
    expect(appliedCount).toBe(0);
    expect(caughtUp).toBe(item);
  });

  it("splits a payment into interest and principal at the current rate", () => {
    const { reminder: caughtUp } = catchUpReminder(
      reminder({
        remainingBalance: 100_000,
        annualInterestRatePercent: 12,
        repaymentAmount: 1_500,
      }),
      "2026-01-15"
    );

    const payment = caughtUp.payments[0];
    expect(payment.interestPortion).toBe(1_000); // 100,000 at 1%
    expect(payment.principalPortion).toBe(500);
    expect(payment.remainingAfter).toBe(99_500);
    expect(caughtUp.remainingBalance).toBe(99_500);
  });

  it("completes the reminder and silences it once the balance clears", () => {
    const { reminder: caughtUp, appliedCount } = catchUpReminder(
      reminder({
        remainingBalance: 2_000,
        repaymentAmount: 1_000,
        notificationsEnabled: true,
      }),
      "2026-06-15"
    );

    expect(appliedCount).toBe(2);
    expect(caughtUp.remainingBalance).toBe(0);
    expect(caughtUp.status).toBe("completed");
    expect(caughtUp.notificationsEnabled).toBe(false);
    // The due date stops at the final repayment rather than rolling on.
    expect(caughtUp.nextPaymentDate).toBe("2026-02-15");
  });

  it("never charges more interest than the payment covers", () => {
    const { reminder: caughtUp } = catchUpReminder(
      reminder({
        remainingBalance: 100_000,
        annualInterestRatePercent: 12,
        repaymentAmount: 400, // less than the 1,000 of interest owed
      }),
      "2026-01-15"
    );

    const payment = caughtUp.payments[0];
    expect(payment.interestPortion).toBe(400);
    expect(payment.principalPortion).toBe(0);
    expect(caughtUp.remainingBalance).toBe(100_000);
  });

  it("stops at its loop guard when a repayment never dents the principal", () => {
    const { appliedCount } = catchUpReminder(
      reminder({
        remainingBalance: 100_000,
        annualInterestRatePercent: 12,
        repaymentAmount: 400,
      }),
      "2056-01-15" // thirty years of missed cycles
    );

    expect(appliedCount).toBe(120);
  });

  it("skips archived and completed reminders", () => {
    (["archived", "completed"] as const).forEach((status) => {
      const item = reminder({ status });
      const result = catchUpReminder(item, "2026-12-31");
      expect(result.appliedCount).toBe(0);
      expect(result.reminder).toBe(item);
    });
  });

  it("summarises only the reminders it actually advanced", () => {
    const { reminders, summaries } = catchUpReminders(
      [
        reminder({ id: "a", name: "Car", remainingBalance: 10_000 }),
        reminder({ id: "b", name: "Home", nextPaymentDate: "2026-12-01" }),
      ],
      "2026-02-15"
    );

    expect(summaries).toEqual([{ name: "Car", appliedCount: 2 }]);
    expect(reminders).toHaveLength(2);
    expect(reminders[1].payments).toHaveLength(0);
  });
});

describe("undoLastPayment", () => {
  it("restores every field the payment moved", () => {
    const before = reminder({
      remainingBalance: 10_000,
      repaymentAmount: 1_000,
      accountFee: 395,
      accountFeeFrequency: "yearly",
      feeEventCarry: 11 / 12,
    });
    const { reminder: after } = catchUpReminder(before, "2026-01-15");
    const undone = undoLastPayment(after);

    expect(undone.remainingBalance).toBe(before.remainingBalance);
    expect(undone.nextPaymentDate).toBe(before.nextPaymentDate);
    expect(undone.feeEventCarry).toBe(before.feeEventCarry);
    expect(undone.status).toBe(before.status);
    expect(undone.notificationsEnabled).toBe(before.notificationsEnabled);
    expect(undone.payments).toHaveLength(0);
  });

  it("unwinds one cycle at a time", () => {
    const { reminder: after } = catchUpReminder(
      reminder({ remainingBalance: 10_000, repaymentAmount: 1_000 }),
      "2026-03-15"
    );
    expect(after.payments).toHaveLength(3);

    const undone = undoLastPayment(after);
    expect(undone.payments).toHaveLength(2);
    expect(undone.remainingBalance).toBe(8_000);
    expect(undone.nextPaymentDate).toBe("2026-03-15");
  });

  it("reopens a reminder that the payment had completed", () => {
    const { reminder: after } = catchUpReminder(
      reminder({ remainingBalance: 1_000, repaymentAmount: 1_000 }),
      "2026-01-15"
    );
    expect(after.status).toBe("completed");

    const undone = undoLastPayment(after);
    expect(undone.status).toBe("active");
    expect(undone.remainingBalance).toBe(1_000);
  });

  it("does nothing when there is no payment to undo", () => {
    const item = reminder();
    expect(undoLastPayment(item)).toBe(item);
  });
});

describe("applyExtraPayment", () => {
  it("puts the whole amount against principal", () => {
    freezeToday("2026-02-01");
    const after = applyExtraPayment(
      reminder({ remainingBalance: 10_000 }),
      2_500
    );

    expect(after.remainingBalance).toBe(7_500);
    const payment = after.payments[0];
    expect(payment.source).toBe("extra");
    expect(payment.principalPortion).toBe(2_500);
    expect(payment.interestPortion).toBe(0);
    expect(payment.feePortion).toBe(0);
    expect(payment.date).toBe("2026-02-01");
  });

  it("leaves the schedule alone", () => {
    const before = reminder({ remainingBalance: 10_000 });
    const after = applyExtraPayment(before, 2_500);
    expect(after.nextPaymentDate).toBe(before.nextPaymentDate);
    expect(after.feeEventCarry).toBe(before.feeEventCarry);
  });

  it("caps at the balance and completes the reminder", () => {
    const after = applyExtraPayment(
      reminder({ remainingBalance: 1_000, notificationsEnabled: true }),
      5_000
    );

    expect(after.remainingBalance).toBe(0);
    expect(after.payments[0].principalPortion).toBe(1_000);
    expect(after.status).toBe("completed");
    expect(after.notificationsEnabled).toBe(false);
  });

  it("ignores a zero or negative amount", () => {
    const item = reminder({ remainingBalance: 10_000 });
    expect(applyExtraPayment(item, 0)).toBe(item);
    expect(applyExtraPayment(item, -100)).toBe(item);
  });

  it("is reversible through the undo snapshot", () => {
    const before = reminder({ remainingBalance: 10_000 });
    const undone = undoLastPayment(applyExtraPayment(before, 2_500));
    expect(undone.remainingBalance).toBe(before.remainingBalance);
    expect(undone.payments).toHaveLength(0);
  });
});

describe("estimatePayoffDate", () => {
  it("returns the date of the final scheduled repayment", () => {
    expect(
      estimatePayoffDate(
        reminder({ remainingBalance: 10_000, repaymentAmount: 1_000 })
      )
    ).toBe("2026-10-15"); // ten monthly repayments from 15 Jan
  });

  it("returns null when the repayment never covers the interest", () => {
    expect(
      estimatePayoffDate(
        reminder({
          remainingBalance: 100_000,
          annualInterestRatePercent: 12,
          repaymentAmount: 1_000, // exactly the interest, so principal never moves
        })
      )
    ).toBeNull();
  });

  it("returns null for a reminder with no repayment set", () => {
    expect(estimatePayoffDate(reminder({ repaymentAmount: 0 }))).toBeNull();
  });

  it("returns null for an archived reminder", () => {
    expect(estimatePayoffDate(reminder({ status: "archived" }))).toBeNull();
  });

  it("does not accumulate payment history while projecting", () => {
    const item = reminder({ remainingBalance: 10_000, repaymentAmount: 1_000 });
    estimatePayoffDate(item);
    expect(item.payments).toHaveLength(0);
  });
});

describe("projectUpcomingCycles", () => {
  it("lists the next cycles with their due amounts and balances", () => {
    freezeToday("2026-01-10");
    const cycles = projectUpcomingCycles(
      reminder({ remainingBalance: 10_000, repaymentAmount: 1_000 }),
      365,
      3
    );

    expect(cycles).toEqual([
      { date: "2026-01-15", amountDue: 1_000, remainingAfter: 9_000 },
      { date: "2026-02-15", amountDue: 1_000, remainingAfter: 8_000 },
      { date: "2026-03-15", amountDue: 1_000, remainingAfter: 7_000 },
    ]);
  });

  it("skips cycles that are already in the past", () => {
    freezeToday("2026-03-01");
    const cycles = projectUpcomingCycles(
      reminder({ remainingBalance: 10_000, repaymentAmount: 1_000 }),
      365,
      2
    );

    expect(cycles[0].date).toBe("2026-03-15");
    // Jan and Feb were applied silently, so the balance already reflects them.
    expect(cycles[0].remainingAfter).toBe(7_000);
  });

  it("stops at the horizon", () => {
    freezeToday("2026-01-10");
    const cycles = projectUpcomingCycles(
      reminder({ remainingBalance: 100_000, repaymentAmount: 1_000 }),
      90,
      24
    );

    expect(cycles.map((cycle) => cycle.date)).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
    ]);
  });

  it("returns nothing for an archived or cleared reminder", () => {
    freezeToday("2026-01-10");
    expect(projectUpcomingCycles(reminder({ status: "archived" }))).toEqual([]);
    expect(projectUpcomingCycles(reminder({ remainingBalance: 0 }))).toEqual([]);
  });

  it("lists upcoming dates only", () => {
    freezeToday("2026-01-10");
    expect(
      listUpcomingDates(
        reminder({ remainingBalance: 10_000, repaymentAmount: 1_000 }),
        2
      )
    ).toEqual(["2026-01-15", "2026-02-15"]);
  });
});

describe("buildUpcomingRepayments", () => {
  it("interleaves several loans in date order", () => {
    freezeToday("2026-01-10");
    const upcoming = buildUpcomingRepayments(
      [
        reminder({
          id: "home",
          name: "Home",
          nextPaymentDate: "2026-01-20",
          remainingBalance: 10_000,
        }),
        reminder({
          id: "car",
          name: "Car",
          nextPaymentDate: "2026-01-15",
          remainingBalance: 10_000,
        }),
      ],
      3
    );

    expect(upcoming.map((item) => `${item.reminder.name} ${item.date}`)).toEqual([
      "Car 2026-01-15",
      "Home 2026-01-20",
      "Car 2026-02-15",
    ]);
    expect(upcoming[0].key).toBe("car:2026-01-15");
  });

  it("fills the list from a single loan when only one is tracked", () => {
    freezeToday("2026-01-10");
    const upcoming = buildUpcomingRepayments(
      [reminder({ remainingBalance: 10_000 })],
      3
    );
    expect(upcoming).toHaveLength(3);
  });

  it("leaves out archived loans", () => {
    freezeToday("2026-01-10");
    expect(
      buildUpcomingRepayments([reminder({ status: "archived" })], 3)
    ).toEqual([]);
  });
});

describe("setReminderStatus", () => {
  it("silences notifications on anything but an active reminder", () => {
    const active = reminder({ notificationsEnabled: true });
    expect(setReminderStatus(active, "archived").notificationsEnabled).toBe(false);
    expect(setReminderStatus(active, "completed").notificationsEnabled).toBe(false);
    expect(setReminderStatus(active, "active").notificationsEnabled).toBe(true);
  });
});

describe("saved profile handoff", () => {
  const profile = (): SavedLoanProfile => ({
    id: "profile-1",
    name: "Home loan",
    input: loanInput({
      accountFeeEnabled: true,
      accountFee: 10,
      accountFeeFrequency: "monthly",
    }),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  it("estimates the repayment from the loan's own schedule", () => {
    // The same $1,798.65 the calculator shows for $300k at 6% over 30 years.
    expect(estimatePeriodRepaymentFromProfile(profile())).toBeCloseTo(1798.65, 2);
  });

  it("seeds a reminder from the profile's terms", () => {
    const draft = draftFromSavedProfile(profile());

    expect(draft.name).toBe("Home loan");
    expect(draft.linkedProfileId).toBe("profile-1");
    expect(draft.originalAmount).toBe(300_000);
    expect(draft.remainingBalance).toBe(300_000);
    expect(draft.annualInterestRatePercent).toBe(6);
    expect(draft.repaymentFrequency).toBe("monthly");
    expect(draft.accountFee).toBe(10);
    expect(draft.repaymentAmount).toBeCloseTo(1798.65, 2);
  });

  it("keeps a name the user already typed", () => {
    const draft = draftFromSavedProfile(profile(), reminder({ name: "My car" }));
    expect(draft.name).toBe("My car");
  });

  it("drops a fee whose toggle is off in the profile", () => {
    const source = profile();
    const draft = draftFromSavedProfile({
      ...source,
      input: { ...source.input, accountFeeEnabled: false },
    });
    expect(draft.accountFee).toBe(0);
  });

  it("refreshes terms without touching the tracked balance", () => {
    const tracked = reminder({
      remainingBalance: 250_000,
      annualInterestRatePercent: 6,
    });
    const source = profile();
    const refreshed = refreshTermsFromProfile(tracked, {
      ...source,
      input: { ...source.input, annualInterestRatePercent: 7.25 },
    });

    expect(refreshed.annualInterestRatePercent).toBe(7.25);
    expect(refreshed.remainingBalance).toBe(250_000);
    expect(refreshed.nextPaymentDate).toBe(tracked.nextPaymentDate);
  });
});

describe("repayment set by a rate change", () => {
  const withNewRepayment = () =>
    addRateChange(
      reminder({ remainingBalance: 10_000, repaymentAmount: 1_000 }),
      "2026-03-01",
      0,
      1_250
    );

  it("takes over from its effective date", () => {
    const item = withNewRepayment();
    expect(repaymentAsOf(item, "2026-02-28")).toBe(1_000);
    expect(repaymentAsOf(item, "2026-03-01")).toBe(1_250);
  });

  it("is what the amount due and the catch-up both use", () => {
    const { reminder: caughtUp } = catchUpReminder(withNewRepayment(), "2026-03-15");

    expect(caughtUp.payments.map((payment) => payment.amountPaid)).toEqual([
      1_000, // 15 Jan
      1_000, // 15 Feb
      1_250, // 15 Mar, after the change
    ]);
    expect(caughtUp.remainingBalance).toBe(6_750);
    expect(amountDueForReminder(caughtUp)).toBe(1_250);
  });

  it("leaves the repayment alone when the change does not set one", () => {
    const item = addRateChange(reminder({ repaymentAmount: 1_000 }), "2026-03-01", 7);
    expect(item.rateChanges[0].repaymentAmount).toBeUndefined();
    expect(repaymentAsOf(item, "2026-06-01")).toBe(1_000);
  });
});

describe("calculateRepaymentAfterRateChange", () => {
  const tracked = (overrides: Partial<LoanReminder> = {}) =>
    reminder({
      remainingBalance: 12_000,
      repaymentAmount: 1_000,
      finalPaymentDate: "2026-12-15",
      ...overrides,
    });

  it("spreads the projected balance over the repayments left at the new rate", () => {
    // 15 Jan and 15 Feb fall before the change, leaving 10,000 owing and ten
    // repayments (15 Mar to 15 Dec) to clear it at 1% a month.
    const factor = Math.pow(1.01, 10);
    const expected = (10_000 * 0.01 * factor) / (factor - 1);

    expect(calculateRepaymentAfterRateChange(tracked(), "2026-03-01", 12)).toBeCloseTo(
      expected,
      2
    );
  });

  it("counts a repayment on the effective date as one still to come", () => {
    // Dropping to 0% with eleven repayments left (15 Feb to 15 Dec).
    expect(calculateRepaymentAfterRateChange(tracked(), "2026-02-15", 0)).toBeCloseTo(
      11_000 / 11,
      2
    );
  });

  it("sets the repayment on the loan balance, not the balance less the offset", () => {
    const withOffset = tracked({ offsetBalance: 5_000 });
    expect(calculateRepaymentAfterRateChange(withOffset, "2026-03-01", 12)).toBe(
      calculateRepaymentAfterRateChange(tracked(), "2026-03-01", 12)
    );
  });

  it("needs a final repayment date", () => {
    expect(
      calculateRepaymentAfterRateChange(
        tracked({ finalPaymentDate: null }),
        "2026-03-01",
        12
      )
    ).toBeNull();
  });

  it("returns null when no repayment is left before the final date", () => {
    expect(
      calculateRepaymentAfterRateChange(
        tracked({ finalPaymentDate: "2026-02-01" }),
        "2026-03-01",
        12
      )
    ).toBeNull();
  });
});

describe("offset balance", () => {
  it("charges interest on the balance less the offset", () => {
    const { reminder: caughtUp } = catchUpReminder(
      reminder({
        remainingBalance: 100_000,
        offsetBalance: 40_000,
        annualInterestRatePercent: 12,
        repaymentAmount: 1_500,
      }),
      "2026-01-15"
    );

    const payment = caughtUp.payments[0];
    expect(payment.interestPortion).toBe(600); // 60,000 at 1%
    expect(payment.principalPortion).toBe(900);
    expect(caughtUp.remainingBalance).toBe(99_100);
  });

  it("charges no interest once the offset covers the balance", () => {
    const { reminder: caughtUp } = catchUpReminder(
      reminder({
        remainingBalance: 10_000,
        offsetBalance: 15_000,
        annualInterestRatePercent: 12,
        repaymentAmount: 1_000,
      }),
      "2026-01-15"
    );
    expect(caughtUp.payments[0].interestPortion).toBe(0);
    expect(caughtUp.remainingBalance).toBe(9_000);
  });

  it("grows by its regular deposit each cycle without paying down the loan", () => {
    const { reminder: caughtUp } = catchUpReminder(
      reminder({
        remainingBalance: 10_000,
        offsetBalance: 2_000,
        offsetDeposit: { amount: 500, frequency: "monthly" },
      }),
      "2026-03-15"
    );
    expect(caughtUp.offsetBalance).toBe(3_500);
    expect(caughtUp.remainingBalance).toBe(7_000);
  });

  it("carries a weekly deposit across monthly cycles", () => {
    const { reminder: caughtUp } = catchUpReminder(
      reminder({
        remainingBalance: 100_000,
        offsetDeposit: { amount: 100, frequency: "weekly" },
      }),
      "2026-12-15"
    );
    // Twelve monthly cycles hold all 52 weekly deposits.
    expect(caughtUp.offsetBalance).toBe(5_200);
  });
});

describe("regular extra repayment", () => {
  it("comes off the principal on top of the scheduled repayment", () => {
    const { reminder: caughtUp } = catchUpReminder(
      reminder({
        remainingBalance: 10_000,
        extraRepayment: { amount: 500, frequency: "monthly" },
      }),
      "2026-01-15"
    );

    const payment = caughtUp.payments[0];
    expect(payment.principalPortion).toBe(1_000);
    expect(payment.extraPortion).toBe(500);
    expect(payment.amountPaid).toBe(1_500);
    expect(caughtUp.remainingBalance).toBe(8_500);
  });

  it("lands only on the cycles its own frequency reaches", () => {
    const { reminder: caughtUp } = catchUpReminder(
      reminder({
        remainingBalance: 100_000,
        extraRepayment: { amount: 3_000, frequency: "quarterly" },
      }),
      "2026-06-15"
    );
    expect(caughtUp.payments.map((payment) => payment.extraPortion)).toEqual([
      0, 0, 3_000, 0, 0, 3_000,
    ]);
  });

  it("never takes more than is left owing", () => {
    const { reminder: caughtUp } = catchUpReminder(
      reminder({
        remainingBalance: 1_200,
        extraRepayment: { amount: 500, frequency: "monthly" },
      }),
      "2026-01-15"
    );
    expect(caughtUp.payments[0].extraPortion).toBe(200);
    expect(caughtUp.status).toBe("completed");
  });

  it("brings the payoff date forward", () => {
    const plain = reminder({ remainingBalance: 12_000 });
    const withExtra = reminder({
      remainingBalance: 12_000,
      extraRepayment: { amount: 1_000, frequency: "monthly" },
    });
    expect(estimatePayoffDate(plain)).toBe("2026-12-15");
    expect(estimatePayoffDate(withExtra)).toBe("2026-06-15");
  });
});

describe("undo with offset and extras", () => {
  it("restores the offset balance and both carries", () => {
    const start = reminder({
      remainingBalance: 10_000,
      offsetBalance: 1_000,
      offsetDeposit: { amount: 100, frequency: "weekly" },
      extraRepayment: { amount: 300, frequency: "quarterly" },
    });
    const { reminder: caughtUp } = catchUpReminder(start, "2026-01-15");
    const undone = undoLastPayment(caughtUp);

    expect(undone.offsetBalance).toBe(1_000);
    expect(undone.offsetEventCarry).toBe(start.offsetEventCarry);
    expect(undone.extraEventCarry).toBe(start.extraEventCarry);
  });

  it("keeps today's offset when undoing a payment recorded before offsets existed", () => {
    const { reminder: caughtUp } = catchUpReminder(reminder(), "2026-01-15");
    const legacy: LoanReminder = {
      ...caughtUp,
      offsetBalance: 4_000,
      payments: caughtUp.payments.map((payment) => {
        const {
          offsetBalance: _offset,
          offsetEventCarry: _offsetCarry,
          extraEventCarry: _extraCarry,
          ...snapshot
        } = payment.undoSnapshot;
        return { ...payment, undoSnapshot: snapshot };
      }),
    };

    expect(undoLastPayment(legacy).offsetBalance).toBe(4_000);
  });
});

describe("saved profile handoff of offset, extras and end date", () => {
  const profile = (overrides: Parameters<typeof loanInput>[0] = {}): SavedLoanProfile => ({
    id: "profile-2",
    name: "Offset loan",
    input: loanInput({
      offsetSavings: {
        enabled: true,
        amount: 20_000,
        contribution: { enabled: true, amount: 1_000, frequency: "monthly" },
      },
      extraRepayment: { enabled: true, amount: 250, frequency: "fortnightly" },
      ...overrides,
    }),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  it("carries the offset, its deposits and the extra repayment into a new reminder", () => {
    const draft = draftFromSavedProfile(profile());

    expect(draft.offsetBalance).toBe(20_000);
    expect(draft.offsetDeposit).toEqual({ amount: 1_000, frequency: "monthly" });
    expect(draft.extraRepayment).toEqual({ amount: 250, frequency: "fortnightly" });
    expect(draft.finalPaymentDate).toBeNull();
  });

  it("leaves out sections switched off in the profile", () => {
    const draft = draftFromSavedProfile(
      profile({
        offsetSavings: { enabled: false },
        extraRepayment: { enabled: false },
      })
    );
    expect(draft.offsetBalance).toBe(0);
    expect(draft.offsetDeposit.amount).toBe(0);
    expect(draft.extraRepayment.amount).toBe(0);
  });

  it("takes the final repayment date from a profile entered by end date", () => {
    const draft = draftFromSavedProfile(
      profile({
        loanTermMode: "endDate",
        loanStartDate: "2026-01-15",
        loanEndDate: "2056-01-15",
      })
    );
    expect(draft.finalPaymentDate).toBe("2056-01-15");
  });

  it("refreshes the regular amounts but keeps the tracked offset balance", () => {
    const tracked = reminder({
      offsetBalance: 35_000,
      finalPaymentDate: "2050-01-15",
    });
    const refreshed = refreshTermsFromProfile(tracked, profile());

    expect(refreshed.offsetBalance).toBe(35_000);
    expect(refreshed.offsetDeposit.amount).toBe(1_000);
    expect(refreshed.extraRepayment.amount).toBe(250);
    // A profile entered by length has no end date to offer, so keep ours.
    expect(refreshed.finalPaymentDate).toBe("2050-01-15");
  });
});
