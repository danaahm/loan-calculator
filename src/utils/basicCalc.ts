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

export interface CalcState {
  display: string;
  expression: string;
  accumulator: number | null;
  pendingOp: Operator | null;
  waitingForOperand: boolean;
  lastExpression: string;
  error: boolean;
  justEvaluated: boolean;
}

const MAX_DIGITS = 12;

export const createInitialCalcState = (): CalcState => ({
  display: "0",
  expression: "",
  accumulator: null,
  pendingOp: null,
  waitingForOperand: false,
  lastExpression: "",
  error: false,
  justEvaluated: false,
});

export const formatCalcNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "Error";
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

const parseDisplay = (value: string): number => Number(value);

const compute = (left: number, op: Operator, right: number): number => {
  switch (op) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "×":
      return left * right;
    case "÷":
      return right === 0 ? Number.NaN : left / right;
  }
};

const digitCount = (value: string): number =>
  value.replace("-", "").replace(".", "").length;

const isDigitKey = (key: CalcKey): key is "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" =>
  key.length === 1 && key >= "0" && key <= "9";

const isOperatorKey = (key: CalcKey): key is Operator =>
  key === "+" || key === "-" || key === "×" || key === "÷";

const errorState = (): CalcState => ({
  ...createInitialCalcState(),
  display: "Error",
  error: true,
});

export const applyCalcKey = (state: CalcState, key: CalcKey): CalcState => {
  if (state.error && key !== "C" && key !== "⌫") {
    return applyCalcKey(createInitialCalcState(), key);
  }

  if (key === "C" || (state.error && key === "⌫")) {
    return createInitialCalcState();
  }

  if (key === "⌫") {
    if (state.waitingForOperand || state.justEvaluated) {
      return state;
    }
    if (
      state.display.length <= 1 ||
      (state.display.length === 2 && state.display.startsWith("-"))
    ) {
      return { ...state, display: "0" };
    }
    return { ...state, display: state.display.slice(0, -1) };
  }

  if (key === "±") {
    if (state.display === "0") {
      return state;
    }
    const next = state.display.startsWith("-")
      ? state.display.slice(1)
      : `-${state.display}`;
    return { ...state, display: next, justEvaluated: false };
  }

  if (key === "%") {
    const current = parseDisplay(state.display);
    const next =
      state.accumulator !== null &&
      state.pendingOp !== null &&
      (state.pendingOp === "+" || state.pendingOp === "-")
        ? state.accumulator * (current / 100)
        : current / 100;
    if (!Number.isFinite(next)) {
      return errorState();
    }
    return {
      ...state,
      display: formatCalcNumber(next),
      waitingForOperand: false,
      justEvaluated: false,
    };
  }

  if (key === ".") {
    if (state.justEvaluated) {
      return {
        ...createInitialCalcState(),
        display: "0.",
      };
    }
    if (state.waitingForOperand) {
      return { ...state, display: "0.", waitingForOperand: false };
    }
    if (state.display.includes(".")) {
      return state;
    }
    return { ...state, display: `${state.display}.` };
  }

  if (isDigitKey(key)) {
    if (state.justEvaluated) {
      return {
        ...createInitialCalcState(),
        display: key,
      };
    }
    if (state.waitingForOperand) {
      return { ...state, display: key, waitingForOperand: false };
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
    const current = parseDisplay(state.display);
    if (!Number.isFinite(current)) {
      return errorState();
    }
    if (state.pendingOp && state.accumulator !== null && !state.waitingForOperand) {
      const result = compute(state.accumulator, state.pendingOp, current);
      if (!Number.isFinite(result)) {
        return errorState();
      }
      const formatted = formatCalcNumber(result);
      return {
        ...state,
        accumulator: result,
        display: formatted,
        pendingOp: key,
        waitingForOperand: true,
        justEvaluated: false,
        expression: `${formatted} ${key}`,
        lastExpression: "",
      };
    }
    return {
      ...state,
      accumulator: current,
      pendingOp: key,
      waitingForOperand: true,
      justEvaluated: false,
      expression: `${formatCalcNumber(current)} ${key}`,
      lastExpression: "",
    };
  }

  if (key === "=") {
    if (state.pendingOp === null || state.accumulator === null || state.waitingForOperand) {
      return {
        ...state,
        justEvaluated: true,
        expression: state.display,
        lastExpression: "",
      };
    }
    const current = parseDisplay(state.display);
    const result = compute(state.accumulator, state.pendingOp, current);
    if (!Number.isFinite(result)) {
      return errorState();
    }
    const left = formatCalcNumber(state.accumulator);
    const right = formatCalcNumber(current);
    const expr = `${left} ${state.pendingOp} ${right}`;
    return {
      display: formatCalcNumber(result),
      expression: `${expr} =`,
      accumulator: null,
      pendingOp: null,
      waitingForOperand: false,
      lastExpression: expr,
      error: false,
      justEvaluated: true,
    };
  }

  return state;
};
