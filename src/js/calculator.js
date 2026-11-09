// Calculator state: the expression being typed, the latest result, angle mode and history. No DOM, no AI.
import { compileExpression } from './expression.js';
import { ANGLE_MODES, ANGLE_MODE_CYCLE } from './scientific.js';
import { HISTORY_LIMIT, createHistoryEntry } from './history-store.js';

const CONTINUE_WITH_RESULT = /^[+\-*/^!%]/;

export function formatResult(value, precision) {
  const rounded = Number(value.toPrecision(precision));
  const magnitude = Math.abs(rounded);
  if (magnitude !== 0 && (magnitude >= 1e15 || magnitude < 1e-7)) return rounded.toExponential();
  return String(rounded);
}

const ENG_EXPONENTS = [
  [12, 'T'], [9, 'G'], [6, 'M'], [3, 'k'], [0, ''],
  [-3, 'm'], [-6, 'µ'], [-9, 'n'], [-12, 'p'],
];

// Engineering notation: mantissa in [1, 1000) with an SI prefix.
export function formatEngineering(value, precision) {
  if (!Number.isFinite(value) || value === 0) return formatResult(value, precision);
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const exponent = Math.floor(Math.log10(abs) / 3) * 3;
  const entry = ENG_EXPONENTS.find(([exp]) => exp === exponent);
  if (!entry) return formatResult(value, precision);
  const [, prefix] = entry;
  const mantissa = Number((abs / 10 ** exponent).toPrecision(precision));
  return `${sign}${mantissa}${prefix}`;
}

// Best rational approximation via continued fractions; null when the value is an integer or has no small fraction.
export function toFraction(value, maxDenominator = 10000) {
  if (!Number.isFinite(value) || Number.isInteger(value)) return null;
  const sign = value < 0 ? '-' : '';
  const x = Math.abs(value);
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  let rest = x;
  for (let i = 0; i < 32; i++) {
    const a = Math.floor(rest);
    [h0, h1] = [h1, a * h1 + h0];
    [k0, k1] = [k1, a * k1 + k0];
    if (k1 > maxDenominator) return null;
    if (Math.abs(x - h1 / k1) <= 1e-10 * Math.max(1, x)) return k1 === 1 ? null : `${sign}${h1}/${k1}`;
    rest = 1 / (rest - a);
    if (!Number.isFinite(rest)) break;
  }
  return null;
}

export function createCalculator({ precision = 12, history: initialHistory = [] } = {}) {
  let expression = '';
  let angleMode = ANGLE_MODES.DEG;
  let error = null;
  let resultValue = null;
  let resultDisplay = '';
  let history = initialHistory;
  let memory = 0;
  let fractionMode = false;
  let replayIndex = -1;
  let engMode = false;
  const variables = {};

  function variableScope() {
    const scope = {};
    for (const letter of 'abcdefghijklmnopqrstuvwxyz') scope[letter] = variables[letter] ?? 0;
    return scope;
  }

  function evalExpression(source, overrides = {}) {
    return compileExpression(source, angleMode).evaluate({ ...variableScope(), ...overrides });
  }

  function displayFormat(value) {
    return engMode ? formatEngineering(value, precision) : formatResult(value, precision);
  }

  function preview() {
    if (!expression) return null;
    try {
      return displayFormat(evalExpression(expression));
    } catch {
      return null;
    }
  }

  function clear() {
    fractionMode = false;
    replayIndex = -1;
    expression = '';
    error = null;
    resultValue = null;
    resultDisplay = '';
  }

  function insert(text) {
    fractionMode = false;
    replayIndex = -1;
    if (resultValue !== null) {
      expression = CONTINUE_WITH_RESULT.test(text) ? String(resultValue) : '';
      resultValue = null;
      resultDisplay = '';
    }
    error = null;

    // --- GUARD AGAINST DOUBLE OPERATORS & MULTIPLE DOTS ---
    const operators = ['+', '-', '*', '/', '×', '÷', '^', '%'];
    const lastChar = expression.slice(-1);

    // 1. If trying to insert an operator when the last character is already an operator, replace it
    if (operators.includes(lastChar) && operators.includes(text)) {
      expression = expression.slice(0, -1) + text;
      return;
    }

    // 2. Prevent consecutive decimal points in the same number block (e.g., "12.3.4")
    if (text === '.') {
      const segments = expression.split(/[\+\-\*\/\×\÷\^%]/);
      const currentSegment = segments[segments.length - 1];
      if (currentSegment.includes('.')) {
        return; // Ignore duplicate dot
      }
    }
    // ------------------------------------------------------

    expression += text;
  }

  function backspace() {
    if (resultValue !== null) {
      clear();
      return;
    }
    expression = expression.slice(0, -1);
    error = null;
  }

  function equals() {
    if (!expression || resultValue !== null) return;
    try {
      const value = evalExpression(expression);
      resultValue = value;
      resultDisplay = displayFormat(value);
      error = null;
      const entry = createHistoryEntry({ expression, display: resultDisplay });
      history = [entry, ...history].slice(0, HISTORY_LIMIT);
    } catch (caught) {
      error = caught.message;
    }
  }

  function recall(id) {
    const entry = history.find((item) => item.id === id);
    if (!entry) return;
    clear();
    expression = entry.expression;
  }

  function currentValue() {
    if (resultValue !== null) return resultValue;
    if (!expression) return 0;
    try {
      return evaluateExpression(expression, angleMode);
    } catch {
      return null;
    }
  }

  function numberToken(value) {
    const text = formatResult(value, precision);
    return value < 0 ? `(${text})` : text;
  }

  function insertAns() {
    const latest = history[0];
    if (!latest) return;
    try {
      insert(numberToken(evalExpression(latest.display)));
    } catch {
      // Ignore unparsable stored results.
    }
  }

  function memoryAdd(sign = 1) {
    const value = currentValue();
    if (value === null) return;
    memory += sign * value;
    if (resultValue === null && expression) equals();
  }

  function memoryStore() {
    const value = currentValue();
    if (value !== null) memory = value;
  }

  function memoryRecall() {
    insert(numberToken(memory));
  }

  function toggleFraction() {
    if (resultValue !== null) fractionMode = !fractionMode;
  }

  function applyScalarResult(value) {
    clear();
    resultValue = value;
    resultDisplay = displayFormat(value);
    const entry = createHistoryEntry({ expression: formatResult(value, precision), display: resultDisplay });
    history = [entry, ...history].slice(0, HISTORY_LIMIT);
    error = null;
  }

  // Numerical derivative of the current expression with respect to x, at x = 1.
  function derivative() {
    if (!expression) return;
    const source = expression;
    try {
      const compiled = compileExpression(source, angleMode);
      const base = variableScope();
      const f = (x) => compiled.evaluate({ ...base, x });
      const h = 1e-5;
      const value = (f(1 + h) - f(1 - h)) / (2 * h);
      if (!Number.isFinite(value)) throw new Error('Result too large');
      applyScalarResult(value);
    } catch (caught) {
      error = caught.message;
    }
  }

  // Numerical integral of the current expression with respect to x, from 0 to 1 (Simpson's rule).
  function integral() {
    if (!expression) return;
    const source = expression;
    try {
      const compiled = compileExpression(source, angleMode);
      const base = variableScope();
      const f = (x) => compiled.evaluate({ ...base, x });
      const a = 0;
      const b = 1;
      const n = 200;
      const step = (b - a) / n;
      let sum = f(a) + f(b);
      for (let i = 1; i < n; i += 1) sum += (i % 2 === 0 ? 2 : 4) * f(a + i * step);
      const value = (sum * step) / 3;
      if (!Number.isFinite(value)) throw new Error('Result too large');
      applyScalarResult(value);
    } catch (caught) {
      error = caught.message;
    }
  }

  function toggleEng() {
    engMode = !engMode;
  }

  function setVariable(name, value) {
    variables[String(name).toLowerCase()] = value;
  }

  // direction: 1 = older entry, -1 = newer entry.
  function replay(direction) {
    if (history.length === 0) return;
    const next = Math.min(Math.max(replayIndex + direction, 0), history.length - 1);
    const entry = history[next];
    expression = entry.expression;
    error = null;
    resultValue = null;
    resultDisplay = '';
    fractionMode = false;
    replayIndex = next;
  }

  function removeHistoryItem(id) {
    history = history.filter((item) => item.id !== id);
  }

  function toggleAngleMode() {
    const index = ANGLE_MODE_CYCLE.indexOf(angleMode);
    angleMode = ANGLE_MODE_CYCLE[(index + 1) % ANGLE_MODE_CYCLE.length];
  }

  function clearHistory() {
    history = [];
  }

  function setPrecision(value) {
    precision = value;
  }

  function getState() {
    let display;
    if (error !== null) display = error;
    else if (resultValue !== null) display = (fractionMode && toFraction(resultValue)) || displayFormat(resultValue);
    else display = preview() ?? '0';

    return {
      expression,
      display,
      isError: error !== null,
      hasResult: resultValue !== null,
      fractionMode,
      engMode,
      variables,
      memory,
      angleMode,
      precision,
      history,
      latest: history[0] ?? null,
    };
  }

  return {
    insert,
    backspace,
    clear,
    equals,
    recall,
    removeHistoryItem,
    toggleAngleMode,
    clearHistory,
    setPrecision,
    insertAns,
    memoryAdd,
    memoryStore,
    memoryRecall,
    toggleFraction,
    toggleEng,
    derivative,
    integral,
    setVariable,
    replay,
    getState,
  };
}