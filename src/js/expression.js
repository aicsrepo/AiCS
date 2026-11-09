// Parses typed math into a syntax tree and evaluates it. No eval(), no DOM, no AI.
import { CONSTANTS, applyScientificFunction } from './scientific.js';

const FUNCTION_NAMES = [
  'sin', 'cos', 'tan',
  'asin', 'acos', 'atan',
  'sinh', 'cosh', 'tanh',
  'ln', 'log', 'sqrt',
  'exp', 'cbrt', 'abs',
  'floor', 'ceil', 'round',
];
const OPERATOR_CHARS = '+-*/^!%()';
const NUMBER_PATTERN = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i;
const WORD_PATTERN = /^[a-z]+/i;
const VARIABLE_PATTERN = /^[a-z]$/;

const isOp = (token, value) => token?.type === 'op' && token.value === value;

function tokenize(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    const rest = source.slice(i);
    const number = rest.match(NUMBER_PATTERN);
    if (number) {
      tokens.push({ type: 'num', value: Number(number[0]) });
      i += number[0].length;
      continue;
    }

    const word = rest.match(WORD_PATTERN);
    if (word) {
      const name = word[0].toLowerCase();
      i += word[0].length;
      if (Object.hasOwn(CONSTANTS, name)) tokens.push({ type: 'num', value: CONSTANTS[name], constant: name });
      else if (FUNCTION_NAMES.includes(name)) tokens.push({ type: 'fn', name });
      else if (VARIABLE_PATTERN.test(name)) tokens.push({ type: 'var', name });
      else throw new Error(`Unknown name "${word[0]}"`);
      continue;
    }

    if (OPERATOR_CHARS.includes(char)) {
      tokens.push({ type: 'op', value: char });
      i += 1;
      continue;
    }

    throw new Error(`Unexpected character "${char}"`);
  }
  return tokens;
}

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];
  const isNext = (value) => isOp(peek(), value);

  function expect(value) {
    if (!isNext(value)) throw new Error(`Expected "${value}"`);
    pos += 1;
  }

  function parseSum() {
    let node = parseProduct();
    while (isNext('+') || isNext('-')) {
      const op = take().value;
      node = { type: 'binary', op, left: node, right: parseProduct() };
    }
    return node;
  }

  function parseProduct() {
    let node = parseUnary();
    for (;;) {
      const token = peek();
      if (isOp(token, '*') || isOp(token, '/')) {
        take();
        node = { type: 'binary', op: token.value, left: node, right: parseUnary() };
      } else if (token && (token.type === 'num' || token.type === 'fn' || token.type === 'var' || isOp(token, '('))) {
        node = { type: 'binary', op: '*', left: node, right: parseUnary() };
      } else {
        return node;
      }
    }
  }

  function parseUnary() {
    if (isNext('-')) {
      take();
      return { type: 'neg', arg: parseUnary() };
    }
    if (isNext('+')) {
      take();
      return parseUnary();
    }
    return parseExponent();
  }

  function parseExponent() {
    const base = parsePostfix();
    if (isNext('^')) {
      take();
      return { type: 'binary', op: '^', left: base, right: parseUnary() };
    }
    return base;
  }

  function parsePostfix() {
    let node = parsePrimary();
    for (;;) {
      if (isNext('!') || isNext('%')) {
        const op = take().value;
        node = { type: 'postfix', op, arg: node };
      } else {
        return node;
      }
    }
  }

  function parsePrimary() {
    const token = take();
    if (!token) throw new Error('Incomplete expression');
    if (token.type === 'num') return { type: 'num', value: token.value, constant: token.constant };
    if (token.type === 'var') return { type: 'var', name: token.name };
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

function normalizeDms(source) {
  return source.replace(
    /(\d+(?:\.\d+)?)\s*°(?:\s*(\d+(?:\.\d+)?)\s*['′](?:\s*(\d+(?:\.\d+)?)\s*["″])?)?/g,
    (_, degrees, minutes, seconds) =>
      `(${degrees}+${minutes ?? 0}/60+${seconds ?? 0}/3600)`,
  );
}

export function parseExpression(source) {
  const tokens = tokenize(normalizeDms(source));
  if (tokens.length === 0) throw new Error('Nothing to calculate');

  const openDepth = tokens.reduce(
    (depth, token) => depth + (isOp(token, '(') ? 1 : isOp(token, ')') ? -1 : 0),
    0,
  );
  for (let i = 0; i < openDepth; i++) tokens.push({ type: 'op', value: ')' });

  return parse(tokens);
}

function divide(a, b) {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}

function applyBinary(op, a, b) {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return divide(a, b);
    case '^':
      return a ** b;
    default:
      throw new Error('Unexpected input');
  }
}

function evaluateNode(node, scope, angleMode) {
  switch (node.type) {
    case 'num':
      return node.value;
    case 'var':
      if (!Object.hasOwn(scope, node.name)) throw new Error(`Unknown variable "${node.name}"`);
      return scope[node.name];
    case 'neg':
      return -evaluateNode(node.arg, scope, angleMode);
    case 'call':
      return applyScientificFunction(node.name, evaluateNode(node.arg, scope, angleMode), angleMode);
    case 'postfix': {
      const value = evaluateNode(node.arg, scope, angleMode);
      return node.op === '!' ? applyScientificFunction('factorial', value, angleMode) : value / 100;
    }
    case 'binary':
      return applyBinary(
        node.op,
        evaluateNode(node.left, scope, angleMode),
        evaluateNode(node.right, scope, angleMode),
      );
    default:
      throw new Error('Unexpected input');
  }
}

function collectVariables(node, names = new Set()) {
  if (node.type === 'var') names.add(node.name);
  for (const child of [node.left, node.right, node.arg]) {
    if (child) collectVariables(child, names);
  }
  return names;
}

export function compileExpression(source, angleMode) {
  const ast = parseExpression(source);
  return {
    variables: [...collectVariables(ast)],
    evaluate(scope = {}) {
      const value = evaluateNode(ast, scope, angleMode);
      if (Number.isNaN(value)) throw new Error('Undefined result');
      if (!Number.isFinite(value)) throw new Error('Result too large');
      return value;
    },
  };
}

export function evaluateExpression(source, angleMode) {
  return compileExpression(source, angleMode).evaluate();
}
