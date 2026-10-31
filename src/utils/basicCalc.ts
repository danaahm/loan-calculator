import { t } from "../i18n/translate";
export type Operator = "+" | "-" | "×" | "÷";

export type CalcKey =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "."
  | "+"
  | "-"
  | "×"
  | "÷"
  | "="
  | "C"
  | "⌫"
  | "%"
  | "±";

/** A finished number in the chain and the operator typed after it. */
export interface CalcTerm {
  value: number;
  /** How the number reads in the chain: "6.2%" rather than 0.062. */
  label: string;
  op: Operator;
}

export interface CalcState {
  /** The number on the big display, as raw text so "12." can keep typing. */
  display: string;
  /** Everything before the number being typed, e.g. 1291.67 × 12 +. */
  terms: CalcTerm[];
  /** An operator was just pressed and the display shows the running value. */
  waitingForOperand: boolean;
  /** The next digit starts a new number rather than extending this one. */
  overwrite: boolean;
  /** Set when "%" produced the display, so the chain can say "6.2%". */
  percentLabel: string | null;
  /** The sum that "=" just completed, without results; empty otherwise. */
  lastExpression: string;
  error: boolean;
  justEvaluated: boolean;
}

const MAX_DIGITS = 12;

export const createInitialCalcState = (): CalcState => ({
  display: "0",
  terms: [],
  waitingForOperand: false,
  overwrite: false,
  percentLabel: null,
  lastExpression: "",
  error: false,
  justEvaluated: false,
});

export const formatCalcNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    return t("basicCalc.error");
  }
  const rounded = Number(value.toPrecision(12));
  if (Object.is(rounded, -0) || rounded === 0) {
    return "0";
  }
  const abs = Math.abs(rounded);
  if (abs >= 1e12 || abs < 1e-9) {
    return rounded.toExponential(6).replace(/\.?0+e/, "e");
  }
  let next = String(rounded);
  if (next.includes("e")) {
    return next;
  }
  if (next.includes(".")) {
    next = next.replace(/\.?0+$/, "");
  }
  return next === "-0" ? "0" : next;
};

/**
 * Groups thousands in every number of a calculator text, for display only:
 * state and stored history keep the raw digits. Exponent forms are left as
 * they are, and a trailing "." or "0" the user is still typing is kept.
 */
export const groupCalcText = (text: string): string =>
  text.replace(/\d+(?:\.\d*)?(?:e[+-]?\d+)?/g, (number) => {
    if (number.includes("e")) {
      return number;
    }
    const [integer, decimals] = number.split(".");
    const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decimals === undefined ? grouped : `${grouped}.${decimals}`;
  });

/** The chain typed so far, for the line above the display. */
export const chainText = (state: CalcState): string =>
  state.terms.map((term) => `${term.label} ${term.op}`).join(" ");

const parseDisplay = (value: string): number => Number(value);

/**
 * Evaluates `values` joined by `ops` with × and ÷ before + and −. With the
 * whole chain on screen, "2 + 3 × 4" has to come to 14, as it reads.
 */
const evaluate = (values: number[], ops: Operator[]): number => {
  let total = 0;
  let sign = 1;
  let product = values[0];
  ops.forEach((op, index) => {
    const next = values[index + 1];
    if (op === "×") {
      product *= next;
    } else if (op === "÷") {
      product = next === 0 ? Number.NaN : product / next;
    } else {
      total += sign * product;
      sign = op === "+" ? 1 : -1;
      product = next;
    }
  });
  return total + sign * product;
};

const evaluateTerms = (terms: CalcTerm[]): number =>
  evaluate(
    terms.map((term) => term.value),
    terms.slice(0, -1).map((term) => term.op)
  );

/**
 * What the display shows once an operator is pressed. After + or − the sum so
 * far is settled. After × or ÷ only the product being built is, since a later
 * × could still bind to it: "2 + 3 ×" shows 3, not 5.
 */
const runningValue = (terms: CalcTerm[]): number => {
  const last = terms[terms.length - 1];
  if (last.op === "+" || last.op === "-") {
    return evaluateTerms(terms);
  }
  let start = terms.length - 1;
  while (start > 0 && (terms[start - 1].op === "×" || terms[start - 1].op === "÷")) {
    start -= 1;
  }
  return evaluateTerms(terms.slice(start));
};

const digitCount = (value: string): number =>
  value.replace("-", "").replace(".", "").length;

const isDigitKey = (key: CalcKey): key is "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" =>
  key.length === 1 && key >= "0" && key <= "9";

const isOperatorKey = (key: CalcKey): key is Operator =>
  key === "+" || key === "-" || key === "×" || key === "÷";

const errorState = (): CalcState => ({
  ...createInitialCalcState(),
  display: t("basicCalc.error"),
  error: true,
});

/** Starts a new number on the display, keeping the chain before it. */
const startOperand = (state: CalcState, display: string): CalcState => ({
  ...state,
  display,
  waitingForOperand: false,
  overwrite: false,
  percentLabel: null,
  justEvaluated: false,
  lastExpression: "",
});

/**
 * Puts a past result into the calculation as the number being typed, as if
 * it had been keyed in. Typing straight after it starts a new number.
 */
export const recallCalcValue = (state: CalcState, value: string): CalcState => {
  const base = state.error ? createInitialCalcState() : state;
  return { ...startOperand(base, value), overwrite: true };
};

export const applyCalcKey = (state: CalcState, key: CalcKey): CalcState => {
  if (state.error && key !== "C" && key !== "⌫") {
    return applyCalcKey(createInitialCalcState(), key);
  }

  if (key === "C" || (state.error && key === "⌫")) {
    return createInitialCalcState();
  }

  if (key === "⌫") {
    if (state.waitingForOperand || state.overwrite) {
      return state;
    }
    if (
      state.display.length <= 1 ||
      (state.display.length === 2 && state.display.startsWith("-"))
    ) {
      return { ...state, display: "0", percentLabel: null };
    }
    return { ...state, display: state.display.slice(0, -1), percentLabel: null };
  }

  if (key === "±") {
    if (state.waitingForOperand) {
      return startOperand(state, "-0");
    }
    if (state.display === "0") {
      return state;
    }
    const next = state.display.startsWith("-")
      ? state.display.slice(1)
      : `-${state.display}`;
    return { ...state, display: next, percentLabel: null, justEvaluated: false };
  }

  if (key === "%") {
    const current = parseDisplay(state.display);
    const last = state.terms[state.terms.length - 1];
    // "200 + 10%" adds 10% of 200, as on a shop receipt. After × or ÷ the
    // percentage is just the fraction: "200 × 10%" is 20.
    const next =
      last && (last.op === "+" || last.op === "-")
        ? evaluateTerms(state.terms) * (current / 100)
        : current / 100;
    if (!Number.isFinite(next)) {
      return errorState();
    }
    return {
      ...state,
      display: formatCalcNumber(next),
      percentLabel: `${formatCalcNumber(current)}%`,
      waitingForOperand: false,
      overwrite: true,
      justEvaluated: false,
      lastExpression: "",
    };
  }

  if (key === ".") {
    if (state.justEvaluated) {
      return { ...createInitialCalcState(), display: "0." };
    }
    if (state.waitingForOperand || state.overwrite) {
      return startOperand(state, "0.");
    }
    if (state.display.includes(".")) {
      return state;
    }
    return { ...state, display: `${state.display}.` };
  }

  if (isDigitKey(key)) {
    if (state.justEvaluated) {
      return { ...createInitialCalcState(), display: key };
    }
    if (state.waitingForOperand || state.overwrite) {
      return startOperand(state, key);
    }
    if (state.display === "0") {
      return { ...state, display: key };
    }
    if (state.display === "-0") {
      return { ...state, display: `-${key}` };
    }
    if (digitCount(state.display) >= MAX_DIGITS) {
      return state;
    }
    return { ...state, display: `${state.display}${key}` };
  }

  if (isOperatorKey(key)) {
    // A second operator in a row changes its mind rather than adding a term.
    if (state.waitingForOperand && state.terms.length > 0) {
      const terms = [
        ...state.terms.slice(0, -1),
        { ...state.terms[state.terms.length - 1], op: key },
      ];
      const running = runningValue(terms);
      if (!Number.isFinite(running)) {
        return errorState();
      }
      return { ...state, terms, display: formatCalcNumber(running) };
    }
    const current = parseDisplay(state.display);
    if (!Number.isFinite(current)) {
      return errorState();
    }
    const terms = [
      ...state.terms,
      {
        value: current,
        label: state.percentLabel ?? formatCalcNumber(current),
        op: key,
      },
    ];
    const running = runningValue(terms);
    if (!Number.isFinite(running)) {
      return errorState();
    }
    return {
      ...state,
      terms,
      display: formatCalcNumber(running),
      waitingForOperand: true,
      overwrite: false,
      percentLabel: null,
      justEvaluated: false,
      lastExpression: "",
    };
  }

  if (key === "=") {
    // A dangling operator ("5 + =") is dropped rather than guessed at.
    const operand = state.waitingForOperand
      ? null
      : {
          value: parseDisplay(state.display),
          label: state.percentLabel ?? formatCalcNumber(parseDisplay(state.display)),
        };
    const values = [
      ...state.terms.map((term) => term.value),
      ...(operand ? [operand.value] : []),
    ];
    const labels = [
      ...state.terms.map((term) => term.label),
      ...(operand ? [operand.label] : []),
    ];
    const ops = state.terms.map((term) => term.op).slice(0, values.length - 1);

    if (values.length < 2) {
      return {
        ...state,
        terms: [],
        display: values.length === 1 ? formatCalcNumber(values[0]) : state.display,
        waitingForOperand: false,
        overwrite: true,
        percentLabel: null,
        justEvaluated: true,
        lastExpression: "",
      };
    }

    const result = evaluate(values, ops);
    if (!Number.isFinite(result)) {
      return errorState();
    }
    const expression = labels
      .map((label, index) => (index < ops.length ? `${label} ${ops[index]}` : label))
      .join(" ");
    return {
      ...createInitialCalcState(),
      display: formatCalcNumber(result),
      overwrite: true,
      lastExpression: expression,
      justEvaluated: true,
    };
  }

  return state;
};
