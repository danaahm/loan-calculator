import * as Localization from "expo-localization";

import { getAvailableCurrencies } from "./format";

export const FALLBACK_CURRENCY_CODE = "AUD";

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
