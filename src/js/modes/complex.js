// Complex numbers { re, im } with a small expression parser (i, + - * / ^, parentheses, abs, sqrt, arg).
// No DOM, no AI.

export function c(re, im = 0) {
  // `+ 0` normalizes -0 so branch cuts (atan2) behave.
  return { re: re + 0, im: im + 0 };
}

export const ZERO = c(0, 0);
export const I = c(0, 1);

export function cAdd(a, b) { return c(a.re + b.re, a.im + b.im); }
export function cSub(a, b) { return c(a.re - b.re, a.im - b.im); }
export function cNeg(a) { return c(-a.re, -a.im); }

export function cMul(a, b) {
  return c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
}

export function cDiv(a, b) {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) throw new Error('Division by zero');
  return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
}

export function cAbs(a) {
  return Math.hypot(a.re, a.im);
}

export function cConj(a) {
  return c(a.re, -a.im);
}

export function cArg(a) {
  if (a.re === 0 && a.im === 0) throw new Error('Argument of zero');
  return Math.atan2(a.im, a.re);
}

export function cExp(a) {
  const k = Math.exp(a.re);
  return c(k * Math.cos(a.im), k * Math.sin(a.im));
}

export function cLn(a) {
  if (a.re === 0 && a.im === 0) throw new Error('Logarithm of zero');
  return c(Math.log(cAbs(a)), cArg(a));
}

export function cPow(a, b) {
  // Principal branch: a^b = exp(b * ln(a)).
  if (b.im === 0 && b.re === 0) return c(1, 0);
  if (a.re === 0 && a.im === 0) {
    if (b.re > 0 && b.im === 0) return c(0, 0);
    throw new Error('Zero to a non-positive power');
  }
  return cExp(cMul(b, cLn(a)));
}

export function cSqrt(a) {
  return cPow(a, c(0.5, 0));
}

const NUMBER_PATTERN = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i;
const FUNCTION_NAMES = ['abs', 'sqrt', 'arg', 'conj'];

function tokenize(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (/\s/.test(char)) { i += 1; continue; }

    const rest = source.slice(i);
    const number = rest.match(NUMBER_PATTERN);
    if (number) {
      tokens.push({ type: 'num', value: Number(number[0]) });
      i += number[0].length;
      continue;
    }

    if (char === 'i' || char === 'I') {
      tokens.push({ type: 'imag' });
      i += 1;
      continue;
    }

    const word = rest.match(/^[a-z]+/i);
    if (word) {
      const name = word[0].toLowerCase();
      i += word[0].length;
      if (FUNCTION_NAMES.includes(name)) tokens.push({ type: 'fn', name });
      else throw new Error(`Unknown name "${word[0]}"`);
      continue;
    }

    if ('+-*/^(),'.includes(char)) {
      tokens.push({ type: 'op', value: char });
      i += 1;
      continue;
    }

    throw new Error(`Unexpected character "${char}"`);
  }
  return tokens;
}

function parse(source) {
  const tokens = tokenize(source);
  if (tokens.length === 0) throw new Error('Nothing to calculate');
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];
  const isOp = (token, value) => token?.type === 'op' && token.value === value;

  function expect(value) {
    if (!isOp(peek(), value)) throw new Error(`Expected "${value}"`);
    pos += 1;
  }

  function parseSum() {
    let node = parseProduct();
    while (isOp(peek(), '+') || isOp(peek(), '-')) {
      const op = take().value;
      node = { type: 'binary', op, left: node, right: parseProduct() };
    }
    return node;
  }

  function startsPrimary(token) {
    return token && (token.type === 'num' || token.type === 'imag' || token.type === 'fn' || isOp(token, '('));
  }

  function parseProduct() {
    let node = parseUnary();
    for (;;) {
      const token = peek();
      if (isOp(token, '*') || isOp(token, '/')) {
        take();
        node = { type: 'binary', op: token.value, left: node, right: parseUnary() };
      } else if (startsPrimary(token)) {
        // Implicit multiplication: 2i, 3(1+i), i(2-i).
        node = { type: 'binary', op: '*', left: node, right: parseUnary() };
      } else {
        return node;
      }
    }
  }

  function parseUnary() {
    if (isOp(peek(), '-')) { take(); return { type: 'neg', arg: parseUnary() }; }
    if (isOp(peek(), '+')) { take(); return parseUnary(); }
    return parsePower();
  }

  function parsePower() {
    const base = parsePrimary();
    if (isOp(peek(), '^')) {
      take();
      return { type: 'binary', op: '^', left: base, right: parseUnary() };
    }
    return base;
  }

  function parsePrimary() {
    const token = take();
    if (!token) throw new Error('Incomplete expression');
    if (token.type === 'num') return { type: 'num', value: token.value };
    if (token.type === 'imag') return { type: 'imag' };
    if (token.type === 'fn') {
      expect('(');
      const arg = parseSum();
      expect(')');
      return { type: 'call', name: token.name, arg };
    }
    if (isOp(token, '(')) {
      const node = parseSum();
      expect(')');
      return node;
    }
    throw new Error('Unexpected input');
  }

  const ast = parseSum();
  if (pos < tokens.length) throw new Error('Unexpected input');
  return ast;
}

function evalNode(node) {
  switch (node.type) {
    case 'num':
      return c(node.value, 0);
    case 'imag':
      return I;
    case 'neg':
      return cNeg(evalNode(node.arg));
    case 'call': {
      const arg = evalNode(node.arg);
      switch (node.name) {
        case 'abs':
          return c(cAbs(arg), 0);
        case 'sqrt':
          return cSqrt(arg);
        case 'arg':
          return c(cArg(arg), 0);
        case 'conj':
          return cConj(arg);
        default:
          throw new Error('Unexpected input');
      }
    }
    case 'binary': {
      const left = evalNode(node.left);
      const right = evalNode(node.right);
      switch (node.op) {
        case '+': return cAdd(left, right);
        case '-': return cSub(left, right);
        case '*': return cMul(left, right);
        case '/': return cDiv(left, right);
        case '^': return cPow(left, right);
        default: throw new Error('Unexpected input');
      }
    }
    default:
      throw new Error('Unexpected input');
  }
}

export function parseComplex(source) {
  const ast = parse(source);
  return evalNode(ast);
}

function formatPart(value, precision) {
  if (Object.is(value, -0)) value = 0;
  if (!Number.isFinite(value)) return String(value);
  const rounded = Number(value.toPrecision(precision));
  const magnitude = Math.abs(rounded);
  if (magnitude !== 0 && (magnitude >= 1e15 || magnitude < 1e-7)) return rounded.toExponential();
  return String(rounded);
}

export function snapComplex(value) {
  const scale = Math.max(1, Math.abs(value.re), Math.abs(value.im));
  return {
    re: Math.abs(value.re) < 1e-12 * scale ? 0 : value.re,
    im: Math.abs(value.im) < 1e-12 * scale ? 0 : value.im,
  };
}

export function formatComplex(value, precision = 10) {
  const { re: cleanRe, im: cleanIm } = snapComplex(value);
  if (cleanIm === 0) return formatPart(cleanRe, precision);
  const imAbs = formatPart(Math.abs(cleanIm), precision);
  if (cleanRe === 0) return `${cleanIm < 0 ? '-' : ''}${imAbs}i`;
  return `${formatPart(cleanRe, precision)}${cleanIm < 0 ? '-' : '+'}${imAbs}i`;
}
