import { type ReminderStatus } from "../types/reminder";
import { daysUntil } from "./dateIso";

/**
 * How many days ahead of a payment each colour band begins. Both are editable
 * in Settings, so nothing may hard-code the old 7/3 constants: read them from
 * `useDueThresholds` (UI) or from the stored settings (plain modules).
 */
export interface DueThresholds {
  /** Due within this many days reads as approaching (amber). */
  soonDays: number;
  /** Due within this many days reads as urgent (red). Never above `soonDays`. */
  urgentDays: number;
}

export const DEFAULT_DUE_THRESHOLDS: DueThresholds = {
  soonDays: 7,
  urgentDays: 3,
};

/** Choices offered in Settings. A stored value outside them still loads, clamped. */
export const DUE_SOON_DAY_OPTIONS = [2, 3, 5, 7, 10, 14, 21, 30];
export const DUE_URGENT_DAY_OPTIONS = [0, 1, 2, 3, 5, 7, 14];

const MAX_DUE_DAYS = 90;
/**
 * Amber must span at least the due day itself, so that red at 0 still leaves it
 * somewhere to sit. Red may be 0, meaning only overdue and same-day payments.
 */
const MIN_SOON_DAYS = 1;
const MIN_URGENT_DAYS = 0;

const clampDays = (value: unknown, fallback: number, min: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(MAX_DUE_DAYS, Math.max(min, Math.round(value)));
};

/**
 * Guards the one invariant the bands rely on: red starts strictly inside amber.
 * Equal values would leave amber with no day it could ever apply to, so the red
 * window is pulled back rather than trusted.
 */
export const normaliseDueThresholds = (
  input: Partial<DueThresholds> | null | undefined
): DueThresholds => {
  const soonDays = clampDays(input?.soonDays, DEFAULT_DUE_THRESHOLDS.soonDays, MIN_SOON_DAYS);
  const urgentDays = clampDays(
    input?.urgentDays,
    DEFAULT_DUE_THRESHOLDS.urgentDays,
    MIN_URGENT_DAYS
  );
  return {
    soonDays,
    urgentDays: Math.max(MIN_URGENT_DAYS, Math.min(urgentDays, soonDays - 1)),
  };
};

export const isReminderOverdue = (dateIso: string, status: ReminderStatus): boolean => {
  return status === "active" && daysUntil(dateIso) < 0;
};

export type DueTone = "paid" | "urgent" | "soon" | "normal";

/**
 * Urgency only applies to live reminders; archived and paid-off ones stay
 * neutral regardless of how close the stored date is.
 */
export const dueTone = (
  dateIso: string,
  status: ReminderStatus,
  thresholds: DueThresholds
): DueTone => {
  if (status === "completed") {
    return "paid";
  }
  if (status !== "active") {
    return "normal";
  }
  const until = daysUntil(dateIso);
  // Overdue dates are negative, so they land in the urgent band even when the
  // user has set the red window to 0 days.
  if (until <= thresholds.urgentDays) {
    return "urgent";
  }
  if (until <= thresholds.soonDays) {
    return "soon";
  }
  return "normal";
};

/** What the header dot shows: `null` means nothing needs attention, so no dot. */
export type DueAlertTone = "urgent" | "soon" | null;

/**
 * The strongest tone across live reminders. Collapsing to one tone is what lets
 * the header show a state rather than a count, which users read as unread mail.
 */
export const strongestDueTone = (
  dateIsos: readonly string[],
  thresholds: DueThresholds
): DueAlertTone => {
  let strongest: DueAlertTone = null;
  for (const dateIso of dateIsos) {
    const tone = dueTone(dateIso, "active", thresholds);
    if (tone === "urgent") {
      return "urgent";
    }
    if (tone === "soon") {
      strongest = "soon";
    }
  }
  return strongest;
};
