// Pure scientific math functions. No DOM, no AI, no calculator state.

export const ANGLE_MODES = { DEG: 'deg', RAD: 'rad', GRAD: 'grad' };

export const ANGLE_MODE_CYCLE = [ANGLE_MODES.DEG, ANGLE_MODES.RAD, ANGLE_MODES.GRAD];

export const ANGLE_MODE_LABELS = { deg: 'D', rad: 'R', grad: 'G' };

export const CONSTANTS = {
  pi: Math.PI,
  e: Math.E,
};

function toRadians(value, angleMode) {
  if (angleMode === ANGLE_MODES.DEG) return (value * Math.PI) / 180;
  if (angleMode === ANGLE_MODES.GRAD) return (value * Math.PI) / 200;
  return value;
}

function fromRadians(value, angleMode) {
  if (angleMode === ANGLE_MODES.DEG) return (value * 180) / Math.PI;
  if (angleMode === ANGLE_MODES.GRAD) return (value * 200) / Math.PI;
  return value;
}

function factorial(n) {
  if (!Number.isInteger(n) || n < 0) return NaN;
  if (n > 170) return Infinity;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

const FUNCTIONS = {
  sin: (x, mode) => Math.sin(toRadians(x, mode)),
  cos: (x, mode) => Math.cos(toRadians(x, mode)),
  tan: (x, mode) => Math.tan(toRadians(x, mode)),
  asin: (x, mode) => fromRadians(Math.asin(x), mode),
  acos: (x, mode) => fromRadians(Math.acos(x), mode),
  atan: (x, mode) => fromRadians(Math.atan(x), mode),
  ln: (x) => Math.log(x),
  log: (x) => Math.log10(x),
  sqrt: (x) => Math.sqrt(x),
  square: (x) => x * x,
  reciprocal: (x) => 1 / x,
    factorial,
  sinh: (x) => Math.sinh(x),
  cosh: (x) => Math.cosh(x),
  tanh: (x) => Math.tanh(x),
  exp: (x) => Math.exp(x),
  cbrt: (x) => Math.cbrt(x),
  abs: (x) => Math.abs(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  round: (x) => Math.round(x),
};

export const SCIENTIFIC_FUNCTION_NAMES = Object.keys(FUNCTIONS);

export function applyScientificFunction(name, value, angleMode = ANGLE_MODES.RAD) {
  const fn = FUNCTIONS[name];
  if (!fn) throw new Error(`Unknown scientific function: ${name}`);
  return fn(value, angleMode);
}
