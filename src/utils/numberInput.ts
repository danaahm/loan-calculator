/**
 * Shared formatting for the app's numeric text inputs.
 *
 * Derived values (e.g. original amount minus remaining balance) come out of
 * float arithmetic as 12.000000000000455, so anything written back into an
 * input goes through here first: round to at most MAX_INPUT_DECIMALS and drop
 * trailing zeros so short values stay short.
 */

export const MAX_INPUT_DECIMALS = 3;

/** Number -> input text, at most `decimals` decimals, trailing zeros trimmed. */
export const formatNumberForInput = (
  value: number,
  decimals: number = MAX_INPUT_DECIMALS
): string => {
  if (!Number.isFinite(value)) {
    return "";
  }
  const fixed = value.toFixed(decimals);
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
};

/** Zero means "not filled in yet", so show an empty field rather than "0". */
export const formatNumberForInputOrBlank = (
  value: number,
  decimals: number = MAX_INPUT_DECIMALS
): string => (Number.isFinite(value) && value > 0 ? formatNumberForInput(value, decimals) : "");

/**
 * Sanitise typed text: strip non-numeric characters, group the integer part
 * with commas, and keep at most `decimals` decimal digits. A trailing "." is
 * preserved so the user can keep typing.
 */
export const formatGroupedNumberInput = (
  value: string,
  decimals: number = MAX_INPUT_DECIMALS
): string => {
  const cleaned = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (!cleaned) {
    return "";
  }

  const firstDotIndex = cleaned.indexOf(".");
  const integerRaw =
    firstDotIndex >= 0 ? cleaned.slice(0, firstDotIndex) : cleaned;
  const decimalRaw =
    firstDotIndex >= 0
      ? cleaned.slice(firstDotIndex + 1).replace(/\./g, "").slice(0, decimals)
      : "";

  const integerPart = integerRaw.replace(/^0+(?=\d)/, "") || "0";
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (firstDotIndex >= 0 && decimals > 0) {
    return `${groupedInteger}.${decimalRaw}`;
  }
  return groupedInteger;
};

/** Number -> grouped input text (rounded and trimmed like the typed path). */
export const formatGroupedNumberValue = (
  value: number,
  decimals: number = MAX_INPUT_DECIMALS
): string => formatGroupedNumberInput(formatNumberForInput(value, decimals), decimals);

/** Number -> grouped input text, blank when the value is zero/unset. */
export const formatGroupedNumberValueOrBlank = (
  value: number,
  decimals: number = MAX_INPUT_DECIMALS
): string =>
  formatGroupedNumberInput(formatNumberForInputOrBlank(value, decimals), decimals);

/** Sanitise typed text without comma grouping (rates, percentages). */
export const formatPlainNumberInput = (
  value: string,
  decimals: number = MAX_INPUT_DECIMALS
): string => formatGroupedNumberInput(value, decimals).replace(/,/g, "");
