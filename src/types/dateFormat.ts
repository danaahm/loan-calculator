// Deliberately imports nothing: `utils/dateIso` depends on these at runtime,
// and `types/settings` reaches `utils/dateIso` through `utils/dueTone`, so
// keeping them here is what stops that loop from becoming a require cycle.

/**
 * Ways a date can be shown. Ids rather than patterns, because translation keys
 * are dot-separated and "dd.MM.yyyy" would split into three segments.
 */
export type DateFormatCode =
  | "dmy-slash" // 04/10/2026
  | "dmy-dot" // 04.10.2026
  | "d-mon-y" // 4 Oct 2026
  | "ymd-dash" // 2026-10-04
  | "mdy-slash" // 10/04/2026
  | "mon-d-y"; // Oct 4, 2026

/** "auto" follows the device's own date order, re-read on every launch. */
export type DateFormatSetting = "auto" | DateFormatCode;

/** In the order Settings lists them. */
export const DATE_FORMATS: DateFormatCode[] = [
  "dmy-slash",
  "d-mon-y",
  "dmy-dot",
  "ymd-dash",
  "mdy-slash",
  "mon-d-y",
];

export const isDateFormatSetting = (value: unknown): value is DateFormatSetting =>
  value === "auto" || DATE_FORMATS.includes(value as DateFormatCode);
