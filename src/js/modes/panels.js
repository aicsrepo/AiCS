// HTML panels and pure result computation for each calculation mode.
// Panels render into #mode-panel; results are computed from collected input values.
import { escapeHtml } from '../ui/render.js';
import { formatComplex, parseComplex, snapComplex } from './complex.js';
import {
  BASES,
  BITWISE_OPS,
  computeStats,
  formatMatrix,
  formatNum,
  generateTable,
  matAdd,
  matDet,
  matInv,
  matMul,
  matSub,
  matTranspose,
  parseBaseNumber,
  parseDataList,
  solveLinear2,
  solveLinear3,
  solveQuadratic,
  toBaseString,
  validateMatrix,
  vectorOps,
} from './logic.js';

export const MODES = [
  { id: 'comp', name: 'COMP', tag: 'General', desc: 'Arithmetic & scientific calculations' },
  { id: 'cmplx', name: 'CMPLX', tag: 'a+bi', desc: 'Complex numbers, arg, conj & polar form' },
  { id: 'stat', name: 'STAT', tag: '1-VAR', desc: 'Statistics, regression analysis & distribution' },
  { id: 'basen', name: 'BASE-N', tag: 'HEX/BIN', desc: 'Binary, octal, decimal & hexadecimal logic' },
  { id: 'eqn', name: 'EQN', tag: 'ax²+bx+c', desc: 'Linear, quadratic & cubic equations' },
  { id: 'matrix', name: 'MATRIX', tag: 'MatA·B', desc: 'Matrix operations, det, inverse & transpose' },
  { id: 'table', name: 'TABLE', tag: 'f(x)', desc: 'Generate numerical value tables from expression' },
  { id: 'vector', name: 'VECTOR', tag: 'u × v', desc: '2D/3D vectors, dot product, cross product' },
];

export const MODE_IDS = MODES.map((mode) => mode.id);

// ---------- Shared markup helpers ----------

function head(mode) {
  return `
    <div class="mode-head">
      <span class="mode-badge">${MODES.findIndex((m) => m.id === mode.id) + 1}</span>
      <div class="mode-head-text">
        <h3 class="mode-title">${mode.name} <span class="mode-tag">${mode.tag}</span></h3>
        <p class="mode-desc">${mode.desc}</p>
      </div>
      <button type="button" class="mode-exit" data-mode-action="open-mode-dialog" title="Change calculation mode">MODE</button>
      <button type="button" class="mode-exit" data-mode-action="exit-mode" title="Back to COMP">COMP</button>
    </div>`;
}

function field({ label, name, value = '', placeholder = '', type = 'text', wide = false }) {
  return `
    <label class="mode-field${wide ? ' mode-field--wide' : ''}">
      <span class="mode-field-label">${label}</span>
      <input
        class="mode-input"
        type="${type}"
        name="${name}"
        value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}"
        autocomplete="off"
        spellcheck="false"
      />
    </label>`;
}

function textareaField({ label, name, value = '', placeholder = '' }) {
  return `
    <label class="mode-field mode-field--wide">
      <span class="mode-field-label">${label}</span>
      <textarea class="mode-input mode-textarea" name="${name}" rows="3" placeholder="${escapeHtml(placeholder)}" spellcheck="false">${escapeHtml(value)}</textarea>
    </label>`;
}

function actionButton(action, label, { primary = false, extra = '' } = {}) {
  return `<button type="button" class="mode-btn${primary ? ' mode-btn--primary' : ''}" data-mode-action="${action}" ${extra}>${label}</button>`;
}

function resultsBox(content) {
  return `<div class="mode-results">${content}</div>`;
}

function errorHtml(message) {
  return resultsBox(`<p class="mode-error">${escapeHtml(message)}</p>`);
}

function kvRows(rows) {
  return `<dl class="mode-kv">${rows
    .map(([k, v]) => `<div class="mode-kv-row"><dt>${escapeHtml(k)}</dt><dd>${v}</dd></div>`)
    .join('')}</dl>`;
}

function num(value) {
  return escapeHtml(formatNum(value));
}

// ---------- Panel HTML ----------

function cmplxPanel(inputs) {
  const mode = MODES.find((m) => m.id === 'cmplx');
  return `
    <section class="mode-panel" data-mode="cmplx">
      ${head(mode)}
      <div class="mode-body">
        <div class="mode-keys">
          ${['i', '+', '-', '*', '/', '^', '(', ')', 'abs(', 'sqrt(', 'arg(', 'conj(']
            .map((k) => `<button type="button" class="mode-key" data-mode-action="cmplx-key" data-key="${k}">${k}</button>`)
            .join('')}
        </div>
        ${field({ label: 'Expression', name: 'expr', value: inputs.expr, placeholder: '(3+4i)*(1-i)  or  sqrt(-4)', wide: true })}
        <div class="mode-actions">
          ${actionButton('compute', '=', { primary: true })}
          ${actionButton('cmplx-clear', 'Clear')}
        </div>
        <div data-mode-results>${inputs.__results ?? ''}</div>
      </div>
    </section>`;
}

function statPanel(inputs) {
  const mode = MODES.find((m) => m.id === 'stat');
  return `
    <section class="mode-panel" data-mode="stat">
      ${head(mode)}
      <div class="mode-body">
        ${textareaField({ label: 'Data (comma or space separated)', name: 'data', value: inputs.data, placeholder: '1, 2, 3, 4, 5, 6, 7, 8, 9, 10' })}
        <div class="mode-actions">
          ${actionButton('compute', 'Calculate', { primary: true })}
        </div>
        <div data-mode-results>${inputs.__results ?? ''}</div>
      </div>
    </section>`;
}

function basenPanel(inputs, ui) {
  const mode = MODES.find((m) => m.id === 'basen');
  const activeBase = ui.base ?? 'dec';
  const base = BASES.find((b) => b.id === activeBase);
  return `
    <section class="mode-panel" data-mode="basen">
      ${head(mode)}
      <div class="mode-body">
        <div class="mode-segmented" role="group" aria-label="Base">
          ${BASES.map((b) => `
            <button type="button" class="mode-seg${b.id === activeBase ? ' is-active' : ''}" data-mode-action="basen-base" data-base="${b.id}">${b.label}</button>
          `).join('')}
        </div>
        <p class="mode-hint">Valid digits for ${base.label}: ${base.digits}</p>
        ${field({ label: `Value A (${base.label})`, name: 'valueA', value: inputs.valueA, placeholder: activeBase === 'dec' ? '255' : activeBase === 'hex' ? 'FF' : activeBase === 'oct' ? '377' : '11111111' })}
        ${field({ label: `Value B (${base.label})`, name: 'valueB', value: inputs.valueB, placeholder: 'for bitwise ops' })}
        <div class="mode-actions">
          ${actionButton('compute', 'Convert', { primary: true })}
          ${BITWISE_OPS.map((op) => actionButton(`basen-bitwise`, op.label, { extra: `data-op="${op.id}"` })).join('')}
        </div>
        <div data-mode-results>${inputs.__results ?? ''}</div>
      </div>
    </section>`;
}

function eqnPanel(inputs, ui) {
  const mode = MODES.find((m) => m.id === 'eqn');
  const tab = ui.tab ?? 'quadratic';
  let body = '';
  if (tab === 'quadratic') {
    body = `
      <p class="mode-hint">Solve ax² + bx + c = 0</p>
      <div class="mode-grid3">
        ${field({ label: 'a', name: 'qa', value: inputs.qa, placeholder: '1' })}
        ${field({ label: 'b', name: 'qb', value: inputs.qb, placeholder: '-5' })}
        ${field({ label: 'c', name: 'qc', value: inputs.qc, placeholder: '6' })}
      </div>`;
  } else if (tab === 'linear2') {
    body = `
      <p class="mode-hint">a₁x + b₁y = c₁ &nbsp;·&nbsp; a₂x + b₂y = c₂</p>
      <div class="mode-grid3">
        ${field({ label: 'a₁', name: 'l2a1', value: inputs.l2a1 })}${field({ label: 'b₁', name: 'l2b1', value: inputs.l2b1 })}${field({ label: 'c₁', name: 'l2c1', value: inputs.l2c1 })}
        ${field({ label: 'a₂', name: 'l2a2', value: inputs.l2a2 })}${field({ label: 'b₂', name: 'l2b2', value: inputs.l2b2 })}${field({ label: 'c₂', name: 'l2c2', value: inputs.l2c2 })}
      </div>`;
  } else {
    body = `
      <p class="mode-hint">Three equations, three unknowns (x, y, z)</p>
      <div class="mode-grid3">
        ${['a1', 'b1', 'c1', 'd1', 'a2', 'b2', 'c2', 'd2', 'a3', 'b3', 'c3', 'd3']
          .map((name) => field({ label: name, name: `l3${name}`, value: inputs[`l3${name}`] }))
          .join('')}
      </div>`;
  }
  return `
    <section class="mode-panel" data-mode="eqn">
      ${head(mode)}
      <div class="mode-body">
        <div class="mode-tabs" role="tablist">
          ${[['quadratic', 'Quadratic'], ['linear2', 'Linear 2×2'], ['linear3', 'Linear 3×3']]
            .map(([id, label]) => `<button type="button" class="mode-tab${tab === id ? ' is-active' : ''}" data-mode-action="eqn-tab" data-tab="${id}">${label}</button>`)
            .join('')}
        </div>
        ${body}
        <div class="mode-actions">
          ${actionButton('compute', 'Solve', { primary: true })}
        </div>
        <div data-mode-results>${inputs.__results ?? ''}</div>
      </div>
    </section>`;
}

function matrixPanel(inputs, ui) {
  const mode = MODES.find((m) => m.id === 'matrix');
  const size = ui.size ?? 2;
  const grid = (prefix) => `
    <div class="matrix-grid" style="--size:${size}">
      ${Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, col) =>
          field({ label: `${prefix}${r + 1}${col + 1}`, name: `${prefix}${r},${col}`, value: inputs[`${prefix}${r},${col}`] ?? (r === col ? '1' : '0'), placeholder: '0' })
        ).join('')
      ).join('')}
    </div>`;
  return `
    <section class="mode-panel mode-panel--wide" data-mode="matrix">
      ${head(mode)}
      <div class="mode-body">
        <div class="mode-segmented" role="group" aria-label="Matrix size">
          <button type="button" class="mode-seg${size === 2 ? ' is-active' : ''}" data-mode-action="matrix-size" data-size="2">2 × 2</button>
          <button type="button" class="mode-seg${size === 3 ? ' is-active' : ''}" data-mode-action="matrix-size" data-size="3">3 × 3</button>
        </div>
        <p class="mode-field-label">Matrix A</p>
        ${grid('a')}
        <p class="mode-field-label">Matrix B</p>
        ${grid('b')}
        <div class="mode-actions mode-actions--wrap">
          ${actionButton('matrix-add', 'A + B')}
          ${actionButton('matrix-sub', 'A − B')}
          ${actionButton('matrix-mul', 'A × B')}
          ${actionButton('matrix-det', 'det(A)')}
          ${actionButton('matrix-inv', 'inv(A)')}
          ${actionButton('matrix-transpose', 'Aᵀ')}
        </div>
        <div data-mode-results>${inputs.__results ?? ''}</div>
      </div>
    </section>`;
}

function tablePanel(inputs) {
  const mode = MODES.find((m) => m.id === 'table');
  return `
    <section class="mode-panel" data-mode="table">
      ${head(mode)}
      <div class="mode-body">
        ${field({ label: 'f(x)', name: 'expr', value: inputs.expr, placeholder: 'x^2 + 2*x', wide: true })}
        <div class="mode-grid3">
          ${field({ label: 'Start', name: 'start', value: inputs.start, placeholder: '0' })}
          ${field({ label: 'End', name: 'end', value: inputs.end, placeholder: '10' })}
          ${field({ label: 'Step', name: 'step', value: inputs.step, placeholder: '1' })}
        </div>
        <div class="mode-actions">
          ${actionButton('compute', 'Generate', { primary: true })}
        </div>
        <div data-mode-results>${inputs.__results ?? ''}</div>
      </div>
    </section>`;
}

function vectorPanel(inputs, ui) {
  const mode = MODES.find((m) => m.id === 'vector');
  const dims = ui.dims ?? 2;
  const comp = (prefix, label) => `
    <div class="mode-vector">
      <p class="mode-field-label">${label}</p>
      <div class="mode-grid3">
        ${Array.from({ length: dims }, (_, k) => k + 1)
          .map((i) => field({ label: `${prefix}${i}`, name: `${prefix}${i}`, value: inputs[`${prefix}${i}`], placeholder: '0' }))
          .join('')}
      </div>
    </div>`;
  return `
    <section class="mode-panel" data-mode="vector">
      ${head(mode)}
      <div class="mode-body">
        <div class="mode-segmented" role="group" aria-label="Dimensions">
          <button type="button" class="mode-seg${dims === 2 ? ' is-active' : ''}" data-mode-action="vector-dims" data-dims="2">2D</button>
          <button type="button" class="mode-seg${dims === 3 ? ' is-active' : ''}" data-mode-action="vector-dims" data-dims="3">3D</button>
        </div>
        ${comp('u', 'Vector u')}
        ${comp('v', 'Vector v')}
        <div class="mode-actions">
          ${actionButton('compute', 'Calculate', { primary: true })}
        </div>
        <div data-mode-results>${inputs.__results ?? ''}</div>
      </div>
    </section>`;
}

export function panelHtml(modeId, inputs = {}, ui = {}) {
  switch (modeId) {
    case 'cmplx': return cmplxPanel(inputs);
    case 'stat': return statPanel(inputs);
    case 'basen': return basenPanel(inputs, ui);
    case 'eqn': return eqnPanel(inputs, ui);
    case 'matrix': return matrixPanel(inputs, ui);
    case 'table': return tablePanel(inputs);
    case 'vector': return vectorPanel(inputs, ui);
    default: return '';
  }
}

// ---------- Result computation ----------

function computeCmplx(inputs, { angleMode }) {
  const parsed = parseComplex(inputs.expr ?? '');
  const value = snapComplex(parsed);
  const rectangular = formatComplex(value);
  const magnitude = Math.hypot(value.re, value.im);
  let angle = Math.hypot(value.re, value.im) === 0 ? 0 : Math.atan2(value.im, value.re);
  if (angleMode === 'deg') angle = (angle * 180) / Math.PI;
  else if (angleMode === 'grad') angle = (angle * 200) / Math.PI;
  const angleLabel = angleMode === 'deg' ? '°' : angleMode === 'grad' ? 'gon' : 'rad';
  return {
    html: resultsBox(kvRows([
      ['Result', `<strong>${escapeHtml(rectangular)}</strong>`],
      ['Real part', num(value.re)],
      ['Imaginary part', num(value.im)],
      ['Magnitude |z|', num(magnitude)],
      [`Argument ∠z (${angleLabel})`, num(angle)],
    ])),
  };
}

function computeStat(inputs) {
  const values = parseDataList(inputs.data ?? '');
  const s = computeStats(values);
  const row = (label, value) => [label, num(value)];
  return {
    html: resultsBox(`
      <p class="mode-count">${s.n} values</p>
      ${kvRows([
        row('Sum Σx', s.sum),
        row('Mean x̄', s.mean),
        row('Sum of squares Σx²', s.sumSq),
        row('Minimum', s.min),
        row('Maximum', s.max),
        row('Range', s.range),
        row('Median', s.median),
        row('Population variance σ²', s.variancePop),
        row('Population std dev σ', s.stdDevPop),
        row('Sample variance s²', s.varianceSample),
        row('Sample std dev s', s.stdDevSample),
      ])}`),
  };
}

function computeBasen(inputs, ui, action) {
  const baseId = ui.base ?? 'dec';
  const base = BASES.find((b) => b.id === baseId);
  const a = parseBaseNumber(inputs.valueA ?? '', base.base);

  if (action?.op) {
    const op = BITWISE_OPS.find((o) => o.id === action.op);
    if (!op) throw new Error('Unknown operation');
    const b = op.id === 'not' ? null : parseBaseNumber(inputs.valueB ?? '', base.base);
    const result = op.id === 'not' ? op.fn(a) : op.fn(a, b);
    // Negative results (NOT on small values) only have a signed decimal form.
    return {
      html: resultsBox(kvRows(BASES.map((target) => [
        `${target.label} (${target.base})`,
        result < 0n && target.base !== 10
          ? '—'
          : `<strong>${escapeHtml(toBaseString(result < 0n ? -result : result, target.base))}${result < 0n ? ' (negative)' : ''}</strong>`,
      ]))),
      insertValue: result >= 0n && result <= 9007199254740991n ? result.toString() : null,
    };
  }

  return {
    html: resultsBox(kvRows(BASES.map((target) => [
      `${target.label} (${target.base})`,
      `<strong>${escapeHtml(toBaseString(a, target.base))}</strong>`,
    ]))),
    insertValue: a >= 0n && a <= 9007199254740991n ? a.toString() : null,
  };
}

function computeEqn(inputs, ui) {
  const tab = ui.tab ?? 'quadratic';
  const numField = (name) => {
    const value = Number(inputs[name]);
    if (inputs[name] === undefined || inputs[name] === '' || !Number.isFinite(value)) {
      throw new Error(`Field ${name} is not a number`);
    }
    return value;
  };

  if (tab === 'quadratic') {
    const a = numField('qa');
    const b = numField('qb');
    const c = numField('qc');
    const result = solveQuadratic(a, b, c);
    const rootText = result.roots
      .map((root) => (typeof root === 'number' ? num(root) : escapeHtml(formatComplex({ re: root.re, im: root.im }))))
      .join(', ');
    return {
      html: resultsBox(kvRows([
        ['Nature', escapeHtml(result.nature)],
        ['Discriminant Δ', num(result.discriminant)],
        ['Roots', `<strong>${rootText}</strong>`],
        ['Vertex (h, k)', `${num(result.vertex.x)}, ${num(result.vertex.y)}`],
      ])),
    };
  }

  if (tab === 'linear2') {
    const solution = solveLinear2([
      [numField('l2a1'), numField('l2b1'), numField('l2c1')],
      [numField('l2a2'), numField('l2b2'), numField('l2c2')],
    ]);
    return {
      html: resultsBox(kvRows([
        ['x', `<strong>${num(solution.x)}</strong>`],
        ['y', `<strong>${num(solution.y)}</strong>`],
      ])),
      insertValue: Number.isFinite(solution.x) ? String(solution.x) : null,
    };
  }

  const solution = solveLinear3([
    [numField('l3a1'), numField('l3b1'), numField('l3c1'), numField('l3d1')],
    [numField('l3a2'), numField('l3b2'), numField('l3c2'), numField('l3d2')],
    [numField('l3a3'), numField('l3b3'), numField('l3c3'), numField('l3d3')],
  ]);
  return {
    html: resultsBox(kvRows([
      ['x', `<strong>${num(solution.x)}</strong>`],
      ['y', `<strong>${num(solution.y)}</strong>`],
      ['z', `<strong>${num(solution.z)}</strong>`],
    ])),
    insertValue: Number.isFinite(solution.x) ? String(solution.x) : null,
  };
}

function computeMatrix(inputs, ui, op) {
  const size = ui.size ?? 2;
  const readMatrix = (prefix) => validateMatrix(
    Object.fromEntries(
      Object.entries(inputs)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => [key.slice(prefix.length), value]),
    ),
    size,
  );
  const a = readMatrix('a');
  const needsB = ['add', 'sub', 'mul'].includes(op);
  const b = needsB ? readMatrix('b') : null;

  let result;
  let insertValue = null;
  switch (op) {
    case 'add': result = matAdd(a, b); break;
    case 'sub': result = matSub(a, b); break;
    case 'mul': result = matMul(a, b); break;
    case 'det': {
      const det = matDet(a);
      insertValue = String(det);
      return { html: resultsBox(`<p class="mode-big">det(A) = <strong>${num(det)}</strong></p>`), insertValue };
    }
    case 'inv': result = matInv(a); break;
    case 'transpose': result = matTranspose(a); break;
    default: throw new Error('Unknown matrix operation');
  }
  return {
    html: resultsBox(`<pre class="mode-matrix">${escapeHtml(formatMatrix(result))}</pre>`),
    insertValue,
  };
}

function computeTable(inputs, { angleMode }) {
  const start = Number(inputs.start);
  const end = Number(inputs.end);
  const step = Number(inputs.step);
  const rows = generateTable(inputs.expr ?? '', angleMode, start, end, step);
  const body = rows
    .map((row) => `<tr><td>${num(row.x)}</td><td>${num(row.y)}</td></tr>`)
    .join('');
  return {
    html: resultsBox(`
      <p class="mode-count">${rows.length} rows</p>
      <div class="mode-table-wrap">
        <table class="mode-table">
          <thead><tr><th>x</th><th>f(x)</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`),
  };
}

function computeVector(inputs, ui) {
  const dims = ui.dims ?? 2;
  const read = (prefix) => {
    const values = [];
    for (let i = 1; i <= dims; i++) {
      const value = Number(inputs[`${prefix}${i}`]);
      if (inputs[`${prefix}${i}`] === undefined || inputs[`${prefix}${i}`] === '' || !Number.isFinite(value)) {
        throw new Error(`Vector ${prefix} component ${i} is not a number`);
      }
      values.push(value);
    }
    return values;
  };
  const u = read('u');
  const v = read('v');
  const result = vectorOps(u, v, dims);
  const rows = [
    ['|u|', num(result.magU)],
    ['|v|', num(result.magV)],
    ['u · v', num(result.dot)],
  ];
  if (dims === 3) rows.push(['u × v', `[ ${result.cross.map(num).join(', ')} ]`]);
  if (Number.isFinite(result.angleDeg)) rows.push(['Angle between', `${num(result.angleDeg)}°`]);
  return {
    html: resultsBox(kvRows(rows)),
    insertValue: Number.isFinite(result.dot) ? String(result.dot) : null,
  };
}

export function computePanel(modeId, inputs, ui, ctx = {}, action = null) {
  try {
    switch (modeId) {
      case 'cmplx': return computeCmplx(inputs, ctx);
      case 'stat': return computeStat(inputs);
      case 'basen': return computeBasen(inputs, ui, action);
      case 'eqn': return computeEqn(inputs, ui);
      case 'matrix': return computeMatrix(inputs, ui, action?.op ?? 'det');
      case 'table': return computeTable(inputs, ctx);
      case 'vector': return computeVector(inputs, ui);
      default: return { html: '' };
    }
  } catch (error) {
    return { html: errorHtml(error.message || 'Calculation failed'), error: true };
  }
}
