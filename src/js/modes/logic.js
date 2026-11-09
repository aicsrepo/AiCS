// Pure math for the specialized calculation modes. No DOM, no AI.
import { compileExpression } from '../expression.js';

// ---------- Number formatting ----------

export function formatNum(value, precision = 10) {
  if (typeof value === 'bigint') return value.toString();
  if (!Number.isFinite(value)) return String(value);
  const rounded = Number(value.toPrecision(precision));
  if (Object.is(rounded, -0)) return '0';
  const magnitude = Math.abs(rounded);
  if (magnitude !== 0 && (magnitude >= 1e15 || magnitude < 1e-7)) {
    return rounded.toExponential().replace('e+', 'e').replace('e-0', 'e-').replace('e+0', 'e');
  }
  return String(rounded);
}

// ---------- STAT (1-VAR) ----------

export function parseDataList(text) {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const values = [];
  for (const part of parts) {
    const value = Number(part);
    if (!Number.isFinite(value)) throw new Error(`"${part}" is not a number`);
    values.push(value);
  }
  if (values.length === 0) throw new Error('Enter at least one value');
  if (values.length > 1000) throw new Error('Too many values (max 1000)');
  return values;
}

export function computeStats(values) {
  const n = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const sumSq = values.reduce((a, b) => a + b * b, 0);
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];
  const median = n % 2 === 1
    ? sorted[(n - 1) / 2]
    : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const ss = values.reduce((a, x) => a + (x - mean) ** 2, 0);
  const variancePop = ss / n;
  const varianceSample = n > 1 ? ss / (n - 1) : NaN;
  return {
    n,
    sum,
    mean,
    sumSq,
    min,
    max,
    range: max - min,
    median,
    variancePop,
    stdDevPop: Math.sqrt(variancePop),
    varianceSample,
    stdDevSample: n > 1 ? Math.sqrt(varianceSample) : NaN,
  };
}

// ---------- BASE-N ----------

export const BASES = [
  { id: 'dec', label: 'DEC', base: 10, digits: '0-9' },
  { id: 'hex', label: 'HEX', base: 16, digits: '0-9 A-F' },
  { id: 'oct', label: 'OCT', base: 8, digits: '0-7' },
  { id: 'bin', label: 'BIN', base: 2, digits: '0-1' },
];

const BASE_DIGITS = '0123456789ABCDEF';

export function parseBaseNumber(text, base) {
  const trimmed = text.trim().toUpperCase();
  if (!trimmed) throw new Error('Enter a number');
  if (base === 10) {
    if (!/^[+-]?\d+$/.test(trimmed)) {
      throw new Error('Enter a whole decimal number');
    }
    const value = Number(trimmed);
    if (!Number.isSafeInteger(value)) throw new Error('Decimal value too large');
    return BigInt(value);
  }
  if (!new RegExp(`^[0-9A-F]+$`).test(trimmed) || trimmed.length > 64) {
    throw new Error('Invalid digits for this base');
  }
  const value = BigInt(`0x${trimmed}`);
  if (base !== 16) {
    // Re-interpret the digit string in the target base.
    let result = 0n;
    for (const ch of trimmed) {
      const digit = BASE_DIGITS.indexOf(ch);
      if (digit >= base) throw new Error(`Digit ${ch} is not valid in base ${base}`);
      result = result * BigInt(base) + BigInt(digit);
    }
    return result;
  }
  return value;
}

export function toBaseString(value, base) {
  if (base === 10) return value.toString();
  if (value === 0n) return '0';
  let result = '';
  let rest = value;
  const bigBase = BigInt(base);
  while (rest > 0n) {
    result = BASE_DIGITS[Number(rest % bigBase)] + result;
    rest /= bigBase;
  }
  return result;
}

export const BITWISE_OPS = [
  { id: 'and', label: 'AND', fn: (a, b) => a & b },
  { id: 'or', label: 'OR', fn: (a, b) => a | b },
  { id: 'xor', label: 'XOR', fn: (a, b) => a ^ b },
  { id: 'not', label: 'NOT', fn: (a) => ~a },
];

// ---------- EQN: quadratic + linear systems ----------

export function solveQuadratic(a, b, c) {
  if (a === 0) throw new Error('a must not be 0 (use the linear solver)');
  const discriminant = b * b - 4 * a * c;
  const roots = [];
  if (discriminant >= 0) {
    const sqrtD = Math.sqrt(discriminant);
    roots.push((-b + sqrtD) / (2 * a), (-b - sqrtD) / (2 * a));
  } else {
    const sqrtD = Math.sqrt(-discriminant);
    roots.push({ re: -b / (2 * a), im: sqrtD / (2 * a) });
    roots.push({ re: -b / (2 * a), im: -sqrtD / (2 * a) });
  }
  const vertex = { x: -b / (2 * a), y: a * (-b / (2 * a)) ** 2 + b * (-b / (2 * a)) + c };
  return {
    discriminant,
    roots,
    vertex,
    nature: discriminant > 0 ? 'Two distinct real roots' : discriminant === 0 ? 'One repeated real root' : 'Two complex conjugate roots',
  };
}

export function solveLinear2(m) {
  // m = [[a1,b1,c1],[a2,b2,c2]] meaning a1*x + b1*y = c1
  const [[a1, b1, c1], [a2, b2, c2]] = m;
  const det = a1 * b2 - a2 * b1;
  if (det === 0) throw new Error('No unique solution (determinant is 0)');
  return { x: (c1 * b2 - c2 * b1) / det, y: (a1 * c2 - a2 * c1) / det };
}

export function solveLinear3(m) {
  // Gaussian elimination with partial pivoting.
  const a = m.map((row) => [...row]);
  const n = 3;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) throw new Error('No unique solution (singular system)');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const div = a[col][col];
    for (let j = col; j <= n; j++) a[col][j] /= div;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j++) a[row][j] -= factor * a[col][j];
    }
  }
  return { x: a[0][n], y: a[1][n], z: a[2][n] };
}

// ---------- MATRIX ----------

export function validateMatrix(entries, size) {
  const matrix = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let col = 0; col < size; col++) {
      const raw = entries[`${r},${col}`];
      const value = raw === undefined || raw === '' ? 0 : Number(raw);
      if (!Number.isFinite(value)) {
        throw new Error(`Cell R${r + 1}C${col + 1} is not a number`);
      }
      row.push(value);
    }
    matrix.push(row);
  }
  return matrix;
}

export function matAdd(a, b) { return a.map((row, i) => row.map((v, j) => v + b[i][j])); }
export function matSub(a, b) { return a.map((row, i) => row.map((v, j) => v - b[i][j])); }

export function matMul(a, b) {
  const n = a.length;
  const m = b[0].length;
  const k = b.length;
  const result = Array.from({ length: n }, () => Array(m).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      for (let p = 0; p < k; p++) result[i][j] += a[i][p] * b[p][j];
    }
  }
  return result;
}

export function matTranspose(a) {
  return a[0].map((_, j) => a.map((row) => row[j]));
}

export function matDet(a) {
  const n = a.length;
  if (n === 2) return a[0][0] * a[1][1] - a[0][1] * a[1][0];
  if (n === 3) {
    return (
      a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
      a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
      a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0])
    );
  }
  throw new Error('Unsupported matrix size');
}

export function matInv(a) {
  const n = a.length;
  const det = matDet(a);
  if (det === 0) throw new Error('Matrix is singular (det = 0)');
  if (n === 2) {
    return [
      [a[1][1] / det, -a[0][1] / det],
      [-a[1][0] / det, a[0][0] / det],
    ];
  }
  // 3x3 inverse via adjugate.
  const [r1, r2, r3] = a;
  const c00 = r2[1] * r3[2] - r2[2] * r3[1];
  const c01 = -(r2[0] * r3[2] - r2[2] * r3[0]);
  const c02 = r2[0] * r3[1] - r2[1] * r3[0];
  const c10 = -(r1[1] * r3[2] - r1[2] * r3[1]);
  const c11 = r1[0] * r3[2] - r1[2] * r3[0];
  const c12 = -(r1[0] * r3[1] - r1[1] * r3[0]);
  const c20 = r1[1] * r2[2] - r1[2] * r2[1];
  const c21 = -(r1[0] * r2[2] - r1[2] * r2[0]);
  const c22 = r1[0] * r2[1] - r1[1] * r2[0];
  return [
    [c00 / det, c10 / det, c20 / det],
    [c01 / det, c11 / det, c21 / det],
    [c02 / det, c12 / det, c22 / det],
  ];
}

export function formatMatrix(matrix) {
  return matrix
    .map((row) => `[ ${row.map((v) => formatNum(v)).join('  ')} ]`)
    .join('\n');
}

// ---------- TABLE ----------

export function generateTable(source, angleMode, start, end, step) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step)) {
    throw new Error('Start, end and step must be numbers');
  }
  if (step === 0) throw new Error('Step cannot be 0');
  if ((end - start) / step < 0) throw new Error('Step direction does not reach the end value');
  const compiled = compileExpression(source, angleMode);
  if (!compiled.variables.includes('x')) throw new Error('Expression must use the variable x');
  const rows = [];
  const direction = Math.sign(step);
  let x = start;
  let guard = 0;
  while (direction > 0 ? x <= end + 1e-12 : x >= end - 1e-12) {
    if (guard++ > 200) throw new Error('Too many rows (max 200)');
    const y = compiled.evaluate({ x });
    rows.push({ x, y });
    x += step;
  }
  if (rows.length === 0) throw new Error('No values in range');
  return rows;
}

// ---------- VECTOR ----------

export function vectorOps(u, v, dims) {
  const magU = Math.hypot(...u);
  const magV = Math.hypot(...v);
  const dot = u.reduce((acc, value, i) => acc + value * v[i], 0);
  const result = {
    magU,
    magV,
    dot,
    angleDeg: magU === 0 || magV === 0 ? NaN : (Math.acos(Math.min(1, Math.max(-1, dot / (magU * magV)))) * 180) / Math.PI,
  };
  if (dims === 3) {
    result.cross = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
  }
  return result;
}
