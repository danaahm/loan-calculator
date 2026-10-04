import {
  isDateFormatSetting,
  type DateFormatCode,
  type DateFormatSetting,
} from "../types/dateFormat";
import { detectDateFormat } from "./locale";

const ENGLISH_SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * The format every displayed date uses. A module singleton for the same
 * reason the active language is one: notification text and the `utils/`
 * helpers format dates outside React. `LocaleProvider` keeps it in step with
 * the stored setting. Resolved lazily so the first read already follows the
 * device, before settings have loaded.
 */
let activeDateFormat: DateFormatCode | null = null;

export const resolveDateFormat = (setting: DateFormatSetting): DateFormatCode =>
  setting === "auto" ? detectDateFormat() : setting;

export const setActiveDateFormat = (setting: unknown): DateFormatCode => {
  activeDateFormat = resolveDateFormat(isDateFormatSetting(setting) ? setting : "auto");
  return activeDateFormat;
};

export const getActiveDateFormat = (): DateFormatCode =>
  activeDateFormat ?? setActiveDateFormat("auto");

const pad = (value: number): string => String(value).padStart(2, "0");

/** Month names follow the app's language, not the date format. */
const shortMonth = (date: Date, language: string): string => {
  try {
    return new Intl.DateTimeFormat(language, { month: "short" }).format(date);
  } catch {
    return ENGLISH_SHORT_MONTHS[date.getMonth()];
  }
};

export const formatDateWith = (
  date: Date,
  format: DateFormatCode,
  language: string
): string => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  switch (format) {
    case "dmy-slash":
      return `${pad(day)}/${pad(month)}/${year}`;
    case "dmy-dot":
      return `${pad(day)}.${pad(month)}.${year}`;
    case "ymd-dash":
      return `${year}-${pad(month)}-${pad(day)}`;
    case "mdy-slash":
      return `${pad(month)}/${pad(day)}/${year}`;
    case "mon-d-y":
      return `${shortMonth(date, language)} ${day}, ${year}`;
    case "d-mon-y":
    default:
      return `${day} ${shortMonth(date, language)} ${year}`;
  }
};
