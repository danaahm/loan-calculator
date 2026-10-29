#!/usr/bin/env node
/**
 * Prints an iOS AsyncStorage manifest holding the sample data the App Store
 * screenshots are taken with: a home loan with an offset and extra
 * repayments on the calculator, three saved loans to compare, two repayment
 * reminders with some payment history, and a little calculator history.
 *
 *   node scripts/screenshots/seed.mjs > <storage dir>/manifest.json
 *
 * Every value is written in the shape the app itself saves (src/types/), so
 * nothing trips the unreadable-data alert. Reminder dates are set a few days
 * after today: a date that has already arrived would be auto-paid at launch.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const today = new Date();
const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const daysFromToday = (days) => iso(todayUtc + days * DAY_MS);

/** The same day of the month, `months` earlier, kept inside short months. */
const monthsBefore = (isoDate, months) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return iso(target.getTime());
};

const stamp = new Date(todayUtc - 120 * DAY_MS).toISOString();
const round2 = (n) => Math.round(n * 100) / 100;

const loanInput = (overrides) => ({
  currencyCode: "AUD",
  amountBorrowed: 650000,
  annualInterestRatePercent: 6.09,
  rateChanges: { enabled: false, changes: [] },
  interestOnly: { enabled: false, lengthValue: 5, lengthUnit: "years" },
  repaymentFrequency: "monthly",
  loanLengthYears: 30,
  loanTermMode: "length",
  loanStartDate: null,
  loanEndDate: null,
  accountFeeEnabled: false,
  accountFee: 0,
  accountFeeFrequency: "monthly",
  extraRepayment: { enabled: false, amount: 0, frequency: "monthly", startAfterValue: 0, startAfterUnit: "months" },
  lumpSum: { enabled: false, amount: 0 },
  offsetSavings: { enabled: false, amount: 0, contribution: { enabled: false, amount: 0, frequency: "monthly" } },
  ...overrides,
});

const familyHome = loanInput({
  accountFeeEnabled: true,
  accountFee: 10,
  extraRepayment: { enabled: true, amount: 400, frequency: "monthly", startAfterValue: 0, startAfterUnit: "months" },
  offsetSavings: { enabled: true, amount: 45000, contribution: { enabled: true, amount: 500, frequency: "monthly" } },
});

const investmentUnit = loanInput({
  amountBorrowed: 480000,
  annualInterestRatePercent: 6.49,
  interestOnly: { enabled: true, lengthValue: 5, lengthUnit: "years" },
});

const carLoan = loanInput({
  amountBorrowed: 38000,
  annualInterestRatePercent: 7.95,
  repaymentFrequency: "fortnightly",
  loanLengthYears: 5,
});

const profiles = [
  { id: "seed-family-home", name: "Family home", input: familyHome, createdAt: stamp, updatedAt: stamp },
  { id: "seed-investment", name: "Investment unit", input: investmentUnit, createdAt: stamp, updatedAt: stamp },
  { id: "seed-car", name: "Car loan", input: carLoan, createdAt: stamp, updatedAt: stamp },
];

/**
 * Past scheduled payments ending just before `nextPaymentDate`, each split
 * into interest and principal from the balance at the time, so the history
 * and remaining balance agree.
 */
const paymentHistory = ({ id, startBalance, ratePercent, perYear, amount, dates }) => {
  let balance = startBalance;
  const payments = dates.map((date, index) => {
    const interest = round2((balance * ratePercent) / 100 / perYear);
    const principal = round2(amount - interest);
    const before = balance;
    balance = round2(balance - principal);
    return {
      id: `${id}-payment-${index + 1}`,
      date,
      amountPaid: amount,
      interestPortion: interest,
      principalPortion: principal,
      feePortion: 0,
      remainingAfter: balance,
      source: "auto",
      undoSnapshot: {
        remainingBalance: before,
        nextPaymentDate: date,
        customUpcomingDates: [],
        feeEventCarry: 0,
        status: "active",
        notificationsEnabled: false,
        offsetBalance: 0,
        offsetEventCarry: 0,
        extraEventCarry: 0,
      },
    };
  });
  // Newest first, as the app records them.
  return { payments: payments.reverse(), remainingBalance: balance };
};

const reminder = ({ id, name, linkedProfileId, originalAmount, startBalance, ratePercent, repaymentAmount, repaymentFrequency, perYear, nextPaymentDate, pastDates }) => {
  const { payments, remainingBalance } = paymentHistory({
    id,
    startBalance,
    ratePercent,
    perYear,
    amount: repaymentAmount,
    dates: pastDates,
  });
  return {
    id,
    name,
    linkedProfileId,
    currencyCode: "AUD",
    originalAmount,
    remainingBalance,
    annualInterestRatePercent: ratePercent,
    repaymentAmount,
    repaymentFrequency,
    monthlyAnchor: "onDate",
    paymentDayOfMonth: Number(nextPaymentDate.slice(8, 10)),
    nextPaymentDate,
    customUpcomingDates: [],
    accountFee: 0,
    accountFeeFrequency: "monthly",
    feeEventCarry: 0,
    finalPaymentDate: null,
    interestOnlyUntil: null,
    offsetBalance: 0,
    offsetDeposit: { amount: 0, frequency: "monthly" },
    offsetEventCarry: 0,
    extraRepayment: { amount: 0, frequency: "monthly" },
    extraEventCarry: 0,
    notificationsEnabled: false,
    notifyLeads: [{ value: 1, unit: "days" }],
    status: "active",
    payments,
    notes: "",
    scheduledNotificationIds: [],
    rateChanges: [],
    createdAt: stamp,
    updatedAt: stamp,
  };
};

const homeNext = daysFromToday(5);
const carNext = daysFromToday(9);

const reminders = [
  reminder({
    id: "seed-reminder-home",
    name: "Family home",
    linkedProfileId: "seed-family-home",
    originalAmount: 650000,
    startBalance: 641250,
    ratePercent: 6.09,
    repaymentAmount: 3935,
    repaymentFrequency: "monthly",
    perYear: 12,
    nextPaymentDate: homeNext,
    pastDates: [3, 2, 1].map((months) => monthsBefore(homeNext, months)),
  }),
  reminder({
    id: "seed-reminder-car",
    name: "Car loan",
    linkedProfileId: "seed-car",
    originalAmount: 38000,
    startBalance: 33120,
    ratePercent: 7.95,
    repaymentAmount: 355,
    repaymentFrequency: "fortnightly",
    perYear: 26,
    nextPaymentDate: carNext,
    pastDates: [42, 28, 14].map((days) => iso(Date.parse(carNext) - days * DAY_MS)),
  }),
];

const settings = {
  themeMode: "auto",
  language: "en",
  dateFormat: "auto",
  defaultCurrencyCode: "AUD",
  reminderNotificationsEnabled: false,
  defaultNotifyHour: 9,
  dueSoonDays: 7,
  dueUrgentDays: 3,
};

const basicHistory = [
  ["3935 × 12", "47220"],
  ["45000 + 500 × 12", "51000"],
  ["650000 × 0.8", "520000"],
].map(([expression, result], index) => ({
  id: `seed-history-${index + 1}`,
  expression,
  result,
  createdAt: new Date(todayUtc - index * DAY_MS).toISOString(),
}));

// AsyncStorage's manifest maps each key to its stored string.
const manifest = {
  "loan-calculator-input-v1": familyHome,
  "loan-calculator-saved-profiles-v1": profiles,
  "loan-calculator-settings-v1": settings,
  "loan-calculator-basic-history-v1": basicHistory,
  "loan-calculator-reminders-v1": reminders,
};

console.log(
  JSON.stringify(Object.fromEntries(Object.entries(manifest).map(([key, value]) => [key, JSON.stringify(value)])))
);
