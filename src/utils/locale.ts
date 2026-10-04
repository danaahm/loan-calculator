import * as Localization from "expo-localization";

import {
  FALLBACK_LANGUAGE,
  isSupportedLanguage,
  type LanguageCode,
} from "../i18n/languages";
import { type DateFormatCode } from "../types/dateFormat";
import { getAvailableCurrencies } from "./format";

export const FALLBACK_CURRENCY_CODE = "AUD";

/**
 * Used when the device gives us nothing to go on. Spelling the month out means
 * nobody can misread it, whichever order they are used to.
 */
export const FALLBACK_DATE_FORMAT: DateFormatCode = "d-mon-y";

// Only consulted when `Intl` cannot describe the locale. Everywhere else not
// listed writes the day first.
const MONTH_FIRST_REGIONS = new Set(["US", "PH", "FM", "MH", "PW", "BZ"]);
const YEAR_FIRST_REGIONS = new Set(["CN", "JP", "KR", "TW", "HU", "LT", "MN", "SE"]);

/** A day above 12 so the day and month cannot be confused when probing. */
const PROBE_DATE = new Date(2026, 10, 23);

const formatFromOrder = (order: string, separator: string): DateFormatCode | null => {
  if (order === "ymd") {
    return "ymd-dash";
  }
  if (order === "mdy") {
    return "mdy-slash";
  }
  if (order === "dmy") {
    return separator === "." ? "dmy-dot" : "dmy-slash";
  }
  return null;
};

/** Reads the order and separator the locale writes a short numeric date in. */
const formatFromIntl = (languageTag: string): DateFormatCode | null => {
  const formatter = new Intl.DateTimeFormat(languageTag, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  if (typeof formatter.formatToParts !== "function") {
    return null;
  }
  const parts = formatter.formatToParts(PROBE_DATE);
  const order = parts
    .filter((part) => part.type === "day" || part.type === "month" || part.type === "year")
    .map((part) => part.type[0])
    .join("");
  const separator = parts.find((part) => part.type === "literal")?.value.trim() ?? "";
  return formatFromOrder(order, separator);
};

/**
 * Best-effort date format for the device, used while the user has the
 * "match my device" setting. Platforms expose the locale but not the user's
 * chosen short-date pattern, so this follows the locale's conventions.
 */
export const detectDateFormat = (
  fallback: DateFormatCode = FALLBACK_DATE_FORMAT
): DateFormatCode => {
  try {
    const locale = Localization.getLocales()[0];
    if (!locale) {
      return fallback;
    }

    try {
      const fromIntl = locale.languageTag ? formatFromIntl(locale.languageTag) : null;
      if (fromIntl) {
        return fromIntl;
      }
    } catch {
      // An engine without full Intl support; fall through to the region.
    }

    const region = locale.regionCode?.toUpperCase();
    if (!region) {
      return fallback;
    }
    if (MONTH_FIRST_REGIONS.has(region)) {
      return "mdy-slash";
    }
    if (YEAR_FIRST_REGIONS.has(region)) {
      return "ymd-dash";
    }
    return "dmy-slash";
  } catch {
    return fallback;
  }
};

/**
 * Region -> currency for the cases where the platform does not hand us a
 * currency code directly. Not exhaustive; anything unmapped falls back.
 */
const REGION_CURRENCY: Record<string, string> = {
  AE: "AED", AR: "ARS", AT: "EUR", AU: "AUD", BE: "EUR", BG: "BGN",
  BR: "BRL", CA: "CAD", CH: "CHF", CL: "CLP", CN: "CNY", CO: "COP",
  CY: "EUR", CZ: "CZK", DE: "EUR", DK: "DKK", EE: "EUR", EG: "EGP",
  ES: "EUR", FI: "EUR", FR: "EUR", GB: "GBP", GR: "EUR", HK: "HKD",
  HR: "EUR", HU: "HUF", ID: "IDR", IE: "EUR", IL: "ILS", IN: "INR",
  IS: "ISK", IT: "EUR", JP: "JPY", KE: "KES", KR: "KRW", LT: "EUR",
  LU: "EUR", LV: "EUR", MA: "MAD", MT: "EUR", MX: "MXN", MY: "MYR",
  NG: "NGN", NL: "EUR", NO: "NOK", NZ: "NZD", PE: "PEN", PH: "PHP",
  PK: "PKR", PL: "PLN", PT: "EUR", RO: "RON", RS: "RSD", SA: "SAR",
  SE: "SEK", SG: "SGD", SI: "EUR", SK: "EUR", TH: "THB", TR: "TRY",
  TW: "TWD", UA: "UAH", US: "USD", VN: "VND", ZA: "ZAR",
};

/**
 * Best-effort currency for the device's region, used only as the default for
 * a brand-new loan. Never overrides a stored profile or a user's choice.
 */
export const detectCurrencyCode = (
  fallback: string = FALLBACK_CURRENCY_CODE
): string => {
  try {
    const locale = Localization.getLocales()[0];
    if (!locale) {
      return fallback;
    }

    const supported = new Set(getAvailableCurrencies().map((item) => item.code));
    const candidates = [
      locale.currencyCode,
      locale.regionCode ? REGION_CURRENCY[locale.regionCode.toUpperCase()] : null,
    ];

    for (const candidate of candidates) {
      const code = candidate?.toUpperCase();
      // Only return something the currency picker can actually render.
      if (code && supported.has(code)) {
        return code;
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
};

/**
 * Best-effort language for the device, used only when the user has not picked
 * one in Settings. Matches on the base tag so "en-AU" resolves to "en".
 */
export const detectLanguageCode = (): LanguageCode => {
  try {
    for (const locale of Localization.getLocales()) {
      const tag = locale.languageCode ?? locale.languageTag?.split("-")[0];
      const code = tag?.toLowerCase();
      if (isSupportedLanguage(code)) {
        return code;
      }
    }
    return FALLBACK_LANGUAGE;
  } catch {
    return FALLBACK_LANGUAGE;
  }
};
