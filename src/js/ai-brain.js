// Built-in offline AI: answers calculator questions without any server.
// Understands arithmetic, evaluates expressions with the app's own safe parser,
// explains the last calculation step by step, and answers from the reference library.

import { parseExpression, evaluateExpression } from './expression.js';
import { applyScientificFunction, ANGLE_MODES } from './scientific.js';
import { formatResult, toFraction } from './calculator.js';
import { FORMULAS } from './reference/formulas.js';
import { SYMBOLS } from './reference/symbols.js';
import { DEFINITIONS } from './reference/definitions.js';

const ANGLE_NAMES = { deg: 'degrees', rad: 'radians', grad: 'gradians' };
const TRIG_NAMES = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh']);

const HELP_TEXT = [
  'I work offline — no server needed. Try:',
  '• Math: "2+2", "sqrt(16)", "sin(30)", "2^10", "10!"',
  '• Explain: "explain" after a calculation, or "explain 1/3+1/6"',
  '• Reference: "quadratic formula", "ohm\'s law", "what is a vector", "pi"',
  '• Chat: "hi", "help"',
].join('\n');

const STOP_WORDS = new Set([
  'what', 'is', 'the', 'a', 'an', 'of', 'define', 'definition', 'meaning', 'explain',
  'tell', 'about', 'formula', 'formulas', 'symbol', 'symbols', 'does', 'stand',
  'for', 'me', 'please', 'give', 'show', 'whats', 'who', 'which', 'how', 'many', 'much',
  'are', 'was', 'were', 'be', 'been', 'this', 'that', 'these', 'those', 'it', 'its',
  'and', 'or', 'in', 'on', 'to', 'by', 'with', 'from', 'as', 'at', 'can', 'you',
]);

// ---------------------------------------------------------------------------
// Normalising typed questions into calculator syntax
// ---------------------------------------------------------------------------

function toCalculatorSyntax(text) {
  return text
    .replace(/factorial\s+of\s+(\d+(?:\.\d+)?)/gi, '$1!')
    .replace(/(\d+(?:\.\d+)?)\s+factorial\b/gi, '$1!')
    .replace(/(\d+(?:\.\d+)?)\s*%\s+of\s+/gi, '$1%*')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, 'pi')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/√\s*(\([^()]*\)|\d+(?:\.\d+)?)/g, 'sqrt($1)')
    .replace(/(\d)\s*,\s*(\d)/g, '$1$2');
}

const QUESTION_PREFIX = /^(?:please\s+)?(?:what(?:'s| is| are)?|whats|calculate|compute|evaluate|solve|find|how much is|the value of|value of|convert|do you know)\s+/i;

function stripQuestionPrefix(text) {
  let rest = text;
  for (let i = 0; i < 3; i += 1) {
    const next = rest.replace(QUESTION_PREFIX, '');
    if (next === rest) break;
    rest = next;
  }
  return rest;
}

function extractCandidates(raw) {
  const cleaned = toCalculatorSyntax(raw);
  const candidates = [];

  let rest = stripQuestionPrefix(cleaned).replace(/[?.,;:]+$/, '').trim();
  rest = rest.replace(/\s*=\s*\?*$/, '').trim();
  if (rest) candidates.push(rest);

  const segments = cleaned.match(/[0-9][0-9a-zA-Z+\-*/^!%().\s]*[0-9a-zA-Z)]/g) || [];
  for (const segment of segments) {
    const s = segment.trim().replace(/[?.,;:]+$/, '');
    if (s) candidates.push(s);
  }

  const expanded = [];
  for (const candidate of candidates) {
    expanded.push(candidate);
    for (const part of candidate.split(/\s+(?:and|plus|minus)\s+/i)) {
      const p = part.trim();
      if (p) expanded.push(p);
    }
  }

  const seen = new Set();
  return expanded
    .filter((candidate) => {
      const key = candidate.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return /[0-9]/.test(candidate) || /\b(sin|cos|tan|sqrt|ln|log|exp|pi|e|factorial)\s*\(/.test(candidate);
    })
    .sort((a, b) => b.length - a.length)
    .slice(0, 6);
}

// ---------------------------------------------------------------------------
// Arithmetic answers
// ---------------------------------------------------------------------------

function angleLabel(angleMode) {
  return ANGLE_NAMES[angleMode] || String(angleMode);
}

function formatMathAnswer(expression, value, context) {
  const precision = Math.min(context.precision || 12, 10);
  const result = formatResult(value, precision);
  const fraction = toFraction(value);
  const parts = [`${expression} = ${result}`];
  if (fraction) parts.push(`( ${fraction} )`);
  if (/\b(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh)\s*\(/.test(expression)) {
    parts.push(`— angles in ${angleLabel(context.angleMode)}`);
  }
  return parts.join(' ');
}

function tryMath(raw, context) {
  const angleMode = context.angleMode || ANGLE_MODES.DEG;
  for (const candidate of extractCandidates(raw)) {
    try {
      const value = evaluateExpression(candidate, angleMode);
      return formatMathAnswer(candidate, value, { ...context, angleMode });
    } catch {
      // try the next candidate
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Step-by-step explanation of an expression
// ---------------------------------------------------------------------------

const OP_SYMBOLS = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };

function fmt(value, precision) {
  if (Object.is(value, -0)) return '0';
  return formatResult(value, precision);
}

function explainNode(node, angleMode, steps, state, precision) {
  switch (node.type) {
    case 'num':
      return node.value;
    case 'var':
      throw new Error('Variables are not supported');
    case 'neg':
      return -explainNode(node.arg, angleMode, steps, state, precision);
    case 'call': {
      const arg = explainNode(node.arg, angleMode, steps, state, precision);
      const value = applyScientificFunction(node.name, arg, angleMode);
      if (TRIG_NAMES.has(node.name)) state.usedTrig = true;
      steps.push(`${node.name}(${fmt(arg, precision)}) = ${fmt(value, precision)}`);
      return value;
    }
    case 'postfix': {
      const arg = explainNode(node.arg, angleMode, steps, state, precision);
      let value;
      let text;
      if (node.op === '!') {
        value = applyScientificFunction('factorial', arg, angleMode);
        text = `${fmt(arg, precision)}! = ${fmt(value, precision)}`;
      } else {
        value = arg / 100;
        text = `${fmt(arg, precision)}% = ${fmt(value, precision)}`;
      }
      steps.push(text);
      return value;
    }
    case 'binary': {
      const left = explainNode(node.left, angleMode, steps, state, precision);
      const right = explainNode(node.right, angleMode, steps, state, precision);
      let value;
      switch (node.op) {
        case '+': value = left + right; break;
        case '-': value = left - right; break;
        case '*': value = left * right; break;
        case '/':
          if (right === 0) throw new Error('Division by zero');
          value = left / right;
          break;
        case '^': value = left ** right; break;
        default: throw new Error(`Unsupported operator ${node.op}`);
      }
      steps.push(`${fmt(left, precision)} ${OP_SYMBOLS[node.op]} ${fmt(right, precision)} = ${fmt(value, precision)}`);
      return value;
    }
    default:
      throw new Error('Unsupported expression');
  }
}

function explainExpression(expression, angleMode, precision, display) {
  const ast = parseExpression(expression);
  const steps = [];
  const state = { usedTrig: false };
  const value = explainNode(ast, angleMode, steps, state, Math.min(precision, 10));

  const header = `Working out ${expression} step by step (angles in ${angleLabel(angleMode)}):`;
  const lines = steps.slice(0, 14).map((step, index) => `${index + 1}. ${step}`);
  if (steps.length > 14) lines.push(`… ${steps.length - 14} more operations`);
  const resultLine = `Result: ${display ?? fmt(value, Math.min(precision, 12))}`;
  return [header, ...lines, resultLine].join('\n');
}

export function explainCalculation(latest, context = {}) {
  const angleMode = context.angleMode || ANGLE_MODES.DEG;
  const precision = context.precision || 12;
  const expression = latest?.expression ?? latest?.display ?? '';
  const display = latest?.display ?? null;
  if (!expression) return 'There is no calculation to explain yet — do a calculation first.';

  try {
    return explainExpression(expression, angleMode, precision, display);
  } catch (error) {
    if (error?.message === 'Division by zero') return `Can't divide by zero — ${expression} is undefined.`;
    return `I can't break "${expression}" down further, but the result is ${display || 'shown on the display'}. It follows the usual order: brackets first, then powers, then × and ÷, then + and −.`;
  }
}

// ---------------------------------------------------------------------------
// Reference library lookup
// ---------------------------------------------------------------------------

function normalizeQuery(text) {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function queryTerms(raw) {
  const words = normalizeQuery(raw).split(' ').filter(Boolean);
  const meaningful = words.filter((word) => word.length > 1 && !STOP_WORDS.has(word));
  if (meaningful.length) return meaningful;
  // Fall back to short tokens (e.g. "e", "i") when nothing else remains.
  return words.filter((word) => !STOP_WORDS.has(word));
}

function entryText(entry, kind) {
  if (kind === 'formula') {
    return [entry.name, entry.formula, entry.description, entry.subject, entry.topic,
      ...(entry.variables || []).flat().join(' ')].join(' ');
  }
  if (kind === 'symbol') {
    return [entry.symbol, entry.name, entry.meaning, entry.subject, entry.topic].join(' ');
  }
  return [entry.term, entry.definition, entry.details || '', entry.example || '', entry.subject, entry.topic].join(' ');
}

function termVariants(term) {
  const variants = [term];
  if (term.length > 3 && term.endsWith('s')) variants.push(term.slice(0, -1));
  return variants;
}

function scoreEntry(entry, terms, kind) {
  const name = normalizeQuery(entry.name || entry.term || entry.symbol || '');
  const key = normalizeQuery(kind === 'symbol' ? (entry.symbol || '') : (entry.name || entry.term || ''));
  const nameWords = name.split(' ').filter(Boolean);
  const blob = normalizeQuery(entryText(entry, kind));
  let score = 0;

  const allNameMatched = terms.every((term) =>
    termVariants(term).some((variant) => nameWords.includes(variant)));

  for (const term of terms) {
    const variants = termVariants(term);
    if (key && variants.includes(key)) score += 8;
    if (variants.some((variant) => nameWords.includes(variant))) score += 3;
    else if (variants.some((variant) => name.includes(variant))) score += 2;
    else if (variants.some((variant) => blob.includes(variant))) score += 1;
  }
  if (terms.length && allNameMatched) score += 4;
  if (terms.length === 1 && termVariants(terms[0]).includes(name)) score += 6;
  return score;
}

function searchReference(raw) {
  const terms = queryTerms(raw);
  if (!terms.length) return null;

  const pools = [
    { kind: 'formula', entries: FORMULAS },
    { kind: 'symbol', entries: SYMBOLS },
    { kind: 'definition', entries: DEFINITIONS },
  ];

  let best = null;
  let bestScore = 0;
  for (const pool of pools) {
    for (const entry of pool.entries) {
      const score = scoreEntry(entry, terms, pool.kind);
      if (score > bestScore) {
        bestScore = score;
        best = { kind: pool.kind, entry };
      }
    }
  }
  if (!best || bestScore < 3) return null;
  return describeEntry(best.entry, best.kind);
}

function describeEntry(entry, kind) {
  if (kind === 'formula') {
    const variables = (entry.variables || [])
      .map(([symbol, meaning]) => `${symbol}: ${meaning}`)
      .join('; ');
    return [
      `${entry.name} (${entry.subject} · ${entry.topic})`,
      `Formula: ${entry.formula}`,
      entry.description,
      variables ? `Variables — ${variables}` : '',
      entry.example ? `Example: ${entry.example}` : '',
    ].filter(Boolean).join('\n');
  }
  if (kind === 'symbol') {
    return [
      `${entry.symbol} — ${entry.name} (${entry.subject} · ${entry.topic})`,
      entry.meaning,
      entry.unit ? `Value: ${entry.unit}` : '',
      entry.example ? `Example: ${entry.example}` : '',
    ].filter(Boolean).join('\n');
  }
  return [
    `${entry.term} (${entry.subject} · ${entry.topic})`,
    entry.definition,
    entry.details ? `More: ${entry.details}` : '',
    entry.example ? `Example: ${entry.example}` : '',
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

function looksLikeMath(text) {
  return /[0-9]/.test(text) || /\b(sin|cos|tan|sqrt|ln|log|exp|pi|e|factorial)\b/i.test(text);
}

function evaluateSafely(expression, angleMode) {
  try {
    return evaluateExpression(expression, angleMode || ANGLE_MODES.DEG);
  } catch {
    return null;
  }
}

export function answerQuestion(rawText, context = {}) {
  const text = (rawText || '').trim();
  if (!text) return 'Ask me a math question, or type "help".';

  const lower = text.toLowerCase();
  const hasMath = looksLikeMath(text);

  if (/^(hi|hello|hey|yo|good morning|good afternoon|good evening)\b/.test(lower) && !hasMath) {
    return 'Hi! I can do arithmetic, evaluate expressions, explain calculations step by step, and answer questions about formulas, symbols and definitions. Type "help" to see examples.';
  }

  if (/\b(help|what can you do|abilities|commands)\b/.test(lower) && !hasMath) {
    return HELP_TEXT;
  }

  if (/\bexplain\b/.test(lower)) {
    const angleMode = context.angleMode || ANGLE_MODES.DEG;
    const precision = context.precision || 12;
    for (const candidate of extractCandidates(text)) {
      const value = evaluateSafely(candidate, angleMode);
      if (value !== null) {
        const display = formatResult(value, Math.min(precision, 10));
        return explainExpression(candidate, angleMode, precision, display);
      }
    }
    if (context.latest) {
      return explainCalculation(context.latest, context);
    }
    return 'Tell me what to explain — type an expression like "explain 2*(3+4)", or calculate something first and then say "explain".';
  }

  const math = hasMath ? tryMath(text, context) : null;
  if (math) return math;

  const reference = searchReference(text);
  if (reference) return reference;

  return 'I can do arithmetic and evaluate expressions (e.g. "2+2", "sqrt(16)", "sin(30)"), explain the last calculation step by step, and answer questions about formulas, symbols and definitions. Type "help" for examples.';
}
