import { type SavedLoanProfile } from "../../types/loan";
import {
  addRateChange,
  amountDueForReminder,
  applyExtraPayment,
  buildUpcomingRepayments,
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

  it("charges the new rate on a repayment falling on the effective date", () => {
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

    const { reminder: caughtUp } = catchUpReminder(item, "2026-03-01");
    // 100,000 at 12%/12 = 1,000, not the 500 the old 6% would have charged.
    expect(caughtUp.payments[0].interestPortion).toBe(1_000);
    expect(caughtUp.payments[0].principalPortion).toBe(1_000);
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
