// Converts typed expressions into textbook-style ("natural") HTML and LaTeX.
import { parseExpression } from './expression.js';

const PRECEDENCE = { sum: 1, product: 2, neg: 3, power: 4, postfix: 5, atom: 6 };

const INVERSE_TRIG = { asin: 'sin', acos: 'cos', atan: 'tan' };

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ESCAPES[char]);

function precedenceOf(node) {
  switch (node.type) {
    case 'binary':
      if (node.op === '+' || node.op === '-') return PRECEDENCE.sum;
      if (node.op === '^') return PRECEDENCE.power;
      if (node.op === '/') return PRECEDENCE.atom;
      return PRECEDENCE.product;
    case 'neg':
      return PRECEDENCE.neg;
    case 'postfix':
      return PRECEDENCE.postfix;
    case 'num':
      return node.value < 0 ? PRECEDENCE.neg : PRECEDENCE.atom;
    default:
      return PRECEDENCE.atom;
  }
}

function formatNumber(value) {
  return Number.isInteger(value) || Math.abs(value) >= 1e-6 ? String(Number(value.toPrecision(12))) : value.toExponential();
}

const HTML = {
  wrap: (inner) => `(${inner})`,
  num(node) {
    if (node.constant === 'pi') return '<i>π</i>';
    if (node.constant === 'e') return '<i>e</i>';
    return escapeHtml(formatNumber(node.value));
  },
  variable: (name) => `<i>${escapeHtml(name)}</i>`,
  neg: (arg) => `−${arg}`,
  sum: (left, op, right) => `${left} ${op === '-' ? '−' : '+'} ${right}`,
  product: (left, right) => `${left}×${right}`,
  fraction: (top, bottom) => `<span class="nat-frac"><span class="nat-num">${top}</span><span class="nat-den">${bottom}</span></span>`,
  power: (base, exponent) => `${base}<sup>${exponent}</sup>`,
  postfix: (arg, op) => `${arg}${op}`,
  call(name, arg) {
    switch (name) {
      case 'sqrt':
        return `<span class="nat-root">√<span class="nat-radicand">${arg}</span></span>`;
      case 'cbrt':
        return `<span class="nat-root">∛<span class="nat-radicand">${arg}</span></span>`;
      case 'abs':
        return `|${arg}|`;
      case 'exp':
        return `<i>e</i><sup>${arg}</sup>`;
      default:
        if (INVERSE_TRIG[name]) return `${INVERSE_TRIG[name]}<sup>−1</sup>(${arg})`;
        return `${name}(${arg})`;
    }
  },
};

const LATEX = {
  wrap: (inner) => `\\left(${inner}\\right)`,
  num(node) {
    if (node.constant === 'pi') return '\\pi';
    if (node.constant === 'e') return 'e';
    return formatNumber(node.value).replace(/e([+-]?\d+)$/i, '\\times 10^{$1}');
  },
  variable: (name) => name,
  neg: (arg) => `-${arg}`,
  sum: (left, op, right) => `${left} ${op} ${right}`,
  product: (left, right) => `${left} \\times ${right}`,
  fraction: (top, bottom) => `\\frac{${top}}{${bottom}}`,
  power: (base, exponent) => `{${base}}^{${exponent}}`,
  postfix: (arg, op) => `${arg}${op === '%' ? '\\%' : '!'}`,
  call(name, arg) {
    switch (name) {
      case 'sqrt':
        return `\\sqrt{${arg}}`;
      case 'cbrt':
        return `\\sqrt[3]{${arg}}`;
      case 'abs':
        return `\\left|${arg}\\right|`;
      case 'exp':
        return `e^{${arg}}`;
      case 'log':
        return `\\log_{10}\\left(${arg}\\right)`;
      default:
        if (INVERSE_TRIG[name]) return `\\${INVERSE_TRIG[name]}^{-1}\\left(${arg}\\right)`;
        if (['sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'ln'].includes(name)) return `\\${name}\\left(${arg}\\right)`;
        return `\\operatorname{${name}}\\left(${arg}\\right)`;
    }
  },
};

function build(node, fmt) {
  const child = (sub, minPrecedence) => {
    const text = build(sub, fmt);
    return precedenceOf(sub) < minPrecedence ? fmt.wrap(text) : text;
  };

  switch (node.type) {
    case 'num':
      return fmt.num(node);
    case 'var':
      return fmt.variable(node.name);
    case 'neg':
      return fmt.neg(child(node.arg, PRECEDENCE.neg));
    case 'call':
      return fmt.call(node.name, build(node.arg, fmt));
    case 'postfix':
      return fmt.postfix(child(node.arg, PRECEDENCE.atom), node.op);
    case 'binary':
      switch (node.op) {
        case '+':
        case '-':
          return fmt.sum(child(node.left, PRECEDENCE.sum), node.op, child(node.right, PRECEDENCE.product));
        case '*':
          return fmt.product(child(node.left, PRECEDENCE.product), child(node.right, PRECEDENCE.neg));
        case '/':
          return fmt.fraction(build(node.left, fmt), build(node.right, fmt));
        case '^':
          return fmt.power(child(node.left, PRECEDENCE.postfix), build(node.right, fmt));
        default:
          return '';
      }
    default:
      return '';
  }
}

function tryParse(source) {
  try {
    return parseExpression(source);
  } catch {
    return null;
  }
}

// Returns null when the expression is empty or cannot be parsed yet (e.g. "2+").
export function naturalHtml(source) {
  const ast = source ? tryParse(source) : null;
  return ast ? build(ast, HTML) : null;
}

export function latexOf(source) {
  const ast = source ? tryParse(source) : null;
  return ast ? build(ast, LATEX) : null;
}
