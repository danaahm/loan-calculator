import {
  addDays,
  addMonthsClamped,
  daysUntil,
  isValidIsoDate,
  parseUserDate,
  toUserDateInput,
  todayLocalIso,
} from "../dateIso";
import {
  advancePaymentDate,
  leadFireDate,
  leadOffsetDays,
  nextFormulaDate,
  normalizeCustomDates,
} from "../reminderSchedule";
import { reminder } from "./fixtures";

const freezeToday = (iso: string): void => {
  const [year, month, day] = iso.split("-").map(Number);
  jest.useFakeTimers();
  jest.setSystemTime(new Date(year, month - 1, day, 9, 0, 0));
};

afterEach(() => {
  jest.useRealTimers();
});

describe("nextFormulaDate", () => {
  it("steps the fixed-length frequencies by their day count", () => {
    expect(nextFormulaDate("2026-01-15", "weekly", "onDate", 15)).toBe(
      "2026-01-22"
    );
    expect(nextFormulaDate("2026-01-15", "fortnightly", "onDate", 15)).toBe(
      "2026-01-29"
    );
    expect(nextFormulaDate("2026-01-15", "quarterly", "onDate", 15)).toBe(
      "2026-04-16" // 91 days
    );
    expect(nextFormulaDate("2026-01-15", "yearly", "onDate", 15)).toBe(
      "2027-01-15" // 365 days
    );
  });

  it("drifts a day when a yearly step crosses 29 February", () => {
    // Documented consequence of stepping 365 days rather than a calendar year.
    expect(nextFormulaDate("2028-01-15", "yearly", "onDate", 15)).toBe(
      "2029-01-14"
    );
  });

  it("carries a weekly step across a month and a year boundary", () => {
    expect(nextFormulaDate("2026-12-28", "weekly", "onDate", 28)).toBe(
      "2027-01-04"
    );
    expect(nextFormulaDate("2028-02-26", "fortnightly", "onDate", 26)).toBe(
      "2028-03-11" // 29 February counted
    );
  });

  describe("monthly", () => {
    it("clamps a 31st payment day into a short month", () => {
      expect(nextFormulaDate("2026-01-31", "monthly", "onDate", 31)).toBe(
        "2026-02-28"
      );
    });

    it("recovers the original payment day the month after a clamp", () => {
      expect(nextFormulaDate("2026-02-28", "monthly", "onDate", 31)).toBe(
        "2026-03-31"
      );
    });

    it("lands on 29 February in a leap year", () => {
      expect(nextFormulaDate("2028-01-31", "monthly", "onDate", 31)).toBe(
        "2028-02-29"
      );
    });

    it("anchors to the first of the next month", () => {
      expect(nextFormulaDate("2026-01-15", "monthly", "startOfMonth", 15)).toBe(
        "2026-02-01"
      );
      expect(nextFormulaDate("2026-12-15", "monthly", "startOfMonth", 15)).toBe(
        "2027-01-01"
      );
    });

    it("anchors to the last day of the next month", () => {
      expect(nextFormulaDate("2026-01-31", "monthly", "endOfMonth", 31)).toBe(
        "2026-02-28"
      );
      expect(nextFormulaDate("2028-01-31", "monthly", "endOfMonth", 31)).toBe(
        "2028-02-29"
      );
      expect(nextFormulaDate("2026-12-31", "monthly", "endOfMonth", 31)).toBe(
        "2027-01-31"
      );
      expect(nextFormulaDate("2026-04-15", "monthly", "endOfMonth", 15)).toBe(
        "2026-05-31"
      );
    });
  });
});

describe("advancePaymentDate", () => {
  it("uses the formula when no custom dates are queued", () => {
    const result = advancePaymentDate(reminder(), "2026-01-15");
    expect(result).toEqual({
      nextDate: "2026-02-15",
      customUpcomingDates: [],
    });
  });

  it("takes the earliest queued custom date before the formula", () => {
    const result = advancePaymentDate(
      reminder({ customUpcomingDates: ["2026-03-01", "2026-01-20"] }),
      "2026-01-15"
    );

    expect(result.nextDate).toBe("2026-01-20");
    expect(result.customUpcomingDates).toEqual(["2026-03-01"]);
  });

  it("discards custom dates that have already gone by", () => {
    const result = advancePaymentDate(
      reminder({ customUpcomingDates: ["2025-12-01", "2026-01-15", "2026-02-20"] }),
      "2026-01-15"
    );

    // Only dates strictly after the one just paid survive.
    expect(result.nextDate).toBe("2026-02-20");
    expect(result.customUpcomingDates).toEqual([]);
  });

  it("returns to the configured payment day once the queue empties", () => {
    const first = advancePaymentDate(
      reminder({ customUpcomingDates: ["2026-01-20"] }),
      "2026-01-15"
    );
    const second = advancePaymentDate(
      reminder({ customUpcomingDates: first.customUpcomingDates }),
      first.nextDate
    );

    expect(first.nextDate).toBe("2026-01-20");
    // A one-off date moves a single repayment; it does not redefine the
    // schedule, so the next one lands on the 15th again rather than the 20th.
    expect(second.nextDate).toBe("2026-02-15");
  });
});

describe("notification leads", () => {
  it("converts a lead into days", () => {
    expect(leadOffsetDays({ value: 0, unit: "days" })).toBe(0);
    expect(leadOffsetDays({ value: 2, unit: "days" })).toBe(2);
    expect(leadOffsetDays({ value: 1, unit: "weeks" })).toBe(7);
    expect(leadOffsetDays({ value: 2, unit: "weeks" })).toBe(14);
  });

  it("fires at the chosen hour on the lead day", () => {
    const fire = leadFireDate("2026-03-15", { value: 2, unit: "days" }, 9);
    expect(fire.getFullYear()).toBe(2026);
    expect(fire.getMonth()).toBe(2);
    expect(fire.getDate()).toBe(13);
    expect(fire.getHours()).toBe(9);
    expect(fire.getMinutes()).toBe(0);
  });

  it("fires on the due date itself for a zero lead", () => {
    const fire = leadFireDate("2026-03-15", { value: 0, unit: "days" }, 8);
    expect(fire.getDate()).toBe(15);
    expect(fire.getHours()).toBe(8);
  });

  it("steps back over a month boundary", () => {
    const fire = leadFireDate("2026-03-02", { value: 1, unit: "weeks" }, 9);
    expect(fire.getMonth()).toBe(1); // February
    expect(fire.getDate()).toBe(23);
  });

  it("clamps an out-of-range hour", () => {
    expect(leadFireDate("2026-03-15", { value: 0, unit: "days" }, 30).getHours()).toBe(
      23
    );
    expect(leadFireDate("2026-03-15", { value: 0, unit: "days" }, -1).getHours()).toBe(
      0
    );
  });
});

describe("normalizeCustomDates", () => {
  it("removes duplicates and sorts", () => {
    expect(
      normalizeCustomDates(["2026-03-01", "2026-01-20", "2026-03-01"])
    ).toEqual(["2026-01-20", "2026-03-01"]);
  });

  it("handles an empty list", () => {
    expect(normalizeCustomDates([])).toEqual([]);
  });
});

describe("dateIso", () => {
  it("accepts only real calendar days", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2028-02-29")).toBe(true); // leap year
    expect(isValidIsoDate("2026-02-29")).toBe(false); // not a leap year
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("2026-1-1")).toBe(false);
    expect(isValidIsoDate("not a date")).toBe(false);
  });

  it("adds days across month, year and leap-day boundaries", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("clamps a month step to the length of the target month", () => {
    expect(addMonthsClamped("2026-01-31", 1, 31)).toBe("2026-02-28");
    expect(addMonthsClamped("2026-01-15", 12, 15)).toBe("2027-01-15");
    expect(addMonthsClamped("2026-01-15", 1, 45)).toBe("2026-02-28");
    expect(addMonthsClamped("2026-01-15", 1, 0)).toBe("2026-02-01");
  });

  it("reads both ISO and day-first input", () => {
    expect(parseUserDate("2026-03-15")).toBe("2026-03-15");
    expect(parseUserDate("15/03/2026")).toBe("2026-03-15");
    expect(parseUserDate("5-3-2026")).toBe("2026-03-05");
    expect(parseUserDate("  2026-03-15  ")).toBe("2026-03-15");
    expect(parseUserDate("29/02/2026")).toBeNull(); // not a leap year
    expect(parseUserDate("03/15/2026")).toBeNull(); // month-first is not accepted
    expect(parseUserDate("")).toBeNull();
  });

  it("round-trips a date through the day-first input format", () => {
    expect(toUserDateInput("2026-03-05")).toBe("05/03/2026");
    expect(parseUserDate(toUserDateInput("2026-03-05"))).toBe("2026-03-05");
    expect(toUserDateInput("nonsense")).toBe("nonsense");
  });

  it("counts whole days from today", () => {
    freezeToday("2026-03-15");
    expect(todayLocalIso()).toBe("2026-03-15");
    expect(daysUntil("2026-03-15")).toBe(0);
    expect(daysUntil("2026-03-16")).toBe(1);
    expect(daysUntil("2026-03-14")).toBe(-1);
    expect(daysUntil("2026-04-15")).toBe(31);
  });
});
