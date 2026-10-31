import {
  applyCalcKey,
  chainText,
  createInitialCalcState,
  groupCalcText,
  recallCalcValue,
  type CalcKey,
  type CalcState,
} from "../basicCalc";

/** Presses each key in turn: "12+3=" or with spaces for readability. */
const press = (keys: string, from: CalcState = createInitialCalcState()): CalcState =>
  [...keys.replace(/\s+/g, "")].reduce(
    (state, key) => applyCalcKey(state, key as CalcKey),
    from
  );

describe("order of operations", () => {
  it("multiplies before adding, as the chain reads", () => {
    const state = press("2 + 3 × 4 =");
    expect(state.display).toBe("14");
    expect(state.lastExpression).toBe("2 + 3 × 4");
  });

  it("divides before subtracting", () => {
    expect(press("20 - 12 ÷ 4 =").display).toBe("17");
  });

  it("runs a long mixed chain", () => {
    expect(press("1 + 2 × 3 - 8 ÷ 2 + 5 =").display).toBe("8");
  });

  it("shows only the product being built after × so the display never jumps ahead", () => {
    expect(press("2 + 3 ×").display).toBe("3");
    expect(press("2 × 3 × 4 +").display).toBe("24");
    expect(press("2 + 3 × 4 +").display).toBe("14");
  });
});

describe("the chain above the display", () => {
  it("keeps every step instead of collapsing to a running total", () => {
    const state = press("1291.67 × 12 + 350 +");
    expect(chainText(state)).toBe("1291.67 × 12 + 350 +");
    expect(state.display).toBe("15850.04");
  });

  it("lets a second operator replace the first", () => {
    const state = press("9 + ×");
    expect(chainText(state)).toBe("9 ×");
    expect(press("3 =", state).display).toBe("27");
  });

  it("is cleared by =, which hands the full sum to the history", () => {
    const state = press("6 × 7 =");
    expect(chainText(state)).toBe("");
    expect(state.lastExpression).toBe("6 × 7");
    expect(state.justEvaluated).toBe(true);
  });

  it("carries a result into the next sum when an operator follows =", () => {
    const state = press("6 × 7 = + 8 =");
    expect(state.display).toBe("50");
    expect(state.lastExpression).toBe("42 + 8");
  });

  it("starts afresh when a digit follows =", () => {
    expect(press("6 × 7 = 5").display).toBe("5");
    expect(press("6 × 7 = 5 + 1 =").lastExpression).toBe("5 + 1");
  });
});

describe("percent", () => {
  it("adds a percentage of the sum so far after +", () => {
    const state = press("200 + 10 % =");
    expect(state.display).toBe("220");
    expect(state.lastExpression).toBe("200 + 10%");
  });

  it("is a plain fraction after ×", () => {
    const state = press("250000 × 6.2 % =");
    expect(state.display).toBe("15500");
    expect(state.lastExpression).toBe("250000 × 6.2%");
  });
});

describe("=", () => {
  it("drops a dangling operator rather than guessing", () => {
    const state = press("2 + 3 × =");
    expect(state.display).toBe("5");
    expect(state.lastExpression).toBe("2 + 3");
  });

  it("records nothing for a lone number", () => {
    const state = press("5 =");
    expect(state.display).toBe("5");
    expect(state.lastExpression).toBe("");
  });

  it("errors on division by zero and recovers on the next key", () => {
    const state = press("5 ÷ 0 =");
    expect(state.error).toBe(true);
    expect(press("3", state).display).toBe("3");
  });
});

describe("editing", () => {
  it("backspaces the number being typed", () => {
    expect(press("123⌫").display).toBe("12");
  });

  it("negates the next number when ± follows an operator", () => {
    expect(press("5 × ± 3 =").display).toBe("-15");
  });
});

describe("recalling a result from the tape", () => {
  it("drops it in as the number after a pending operator", () => {
    const state = recallCalcValue(press("100 +"), "15850");
    expect(press("=", state).display).toBe("15950");
  });

  it("starts a new number when a digit follows it", () => {
    const state = recallCalcValue(press("100 +"), "15850");
    expect(press("2 =", state).display).toBe("102");
  });

  it("can start a sum on its own", () => {
    const state = recallCalcValue(createInitialCalcState(), "1291.67");
    expect(press("× 12 =", state).display).toBe("15500.04");
  });
});

describe("groupCalcText", () => {
  it("groups every number in an expression", () => {
    expect(groupCalcText("1291.67 × 12000 + 350")).toBe("1,291.67 × 12,000 + 350");
  });

  it("keeps what is still being typed", () => {
    expect(groupCalcText("12000.")).toBe("12,000.");
    expect(groupCalcText("-1234.50")).toBe("-1,234.50");
  });

  it("leaves exponents and words alone", () => {
    expect(groupCalcText("1.5e+13")).toBe("1.5e+13");
    expect(groupCalcText("Error")).toBe("Error");
  });

  it("formats percentages in the chain", () => {
    expect(groupCalcText("250000 × 6.2%")).toBe("250,000 × 6.2%");
  });
});
