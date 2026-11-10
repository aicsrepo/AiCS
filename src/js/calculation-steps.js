import { parseExpression } from './expression.js';
import { applyScientificFunction, ANGLE_MODES } from './scientific.js';
import { formatResult } from './calculator.js';

const ANGLE_NAMES = { deg: 'degrees', rad: 'radians', grad: 'gradians' };
const OP_SYMBOLS = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };
const OPERATION_NAMES = {
  '+': 'Add',
  '-': 'Subtract',
  '*': 'Multiply',
  '/': 'Divide',
  '^': 'Raise to a power',
};
const FUNCTION_NAMES = {
  sin: 'Sine',
  cos: 'Cosine',
  tan: 'Tangent',
  asin: 'Inverse sine',
  acos: 'Inverse cosine',
  atan: 'Inverse tangent',
  sinh: 'Hyperbolic sine',
  cosh: 'Hyperbolic cosine',
  tanh: 'Hyperbolic tangent',
  ln: 'Natural logarithm',
  log: 'Common logarithm',
  sqrt: 'Square root',
  cbrt: 'Cube root',
  exp: 'Exponential',
  abs: 'Absolute value',
  floor: 'Round down',
  ceil: 'Round up',
  round: 'Round to nearest integer',
};
const CIRCULAR_TRIG_FUNCTIONS = new Set(['sin', 'cos', 'tan']);
const INVERSE_TRIG_FUNCTIONS = new Set(['asin', 'acos', 'atan']);
const ANGLE_SUFFIXES = { deg: '°', rad: ' rad', grad: ' grad' };

function formatStepValue(value, precision) {
  if (Object.is(value, -0)) return '0';
  return formatResult(value, precision);
}

function explainNode(node, angleMode, steps, precision, state) {
  switch (node.type) {
    case 'num':
      return node.value;
    case 'var':
      throw new Error('Variables are not supported');
    case 'neg': {
      const arg = explainNode(node.arg, angleMode, steps, precision, state);
      const value = -arg;
      steps.push(`Negate: ${formatStepValue(arg, precision)} → ${formatStepValue(value, precision)}`);
      return value;
    }
    case 'call': {
      const arg = explainNode(node.arg, angleMode, steps, precision, state);
      const value = applyScientificFunction(node.name, arg, angleMode);
      if (CIRCULAR_TRIG_FUNCTIONS.has(node.name) || INVERSE_TRIG_FUNCTIONS.has(node.name)) {
        state.usedAngleFunctions = true;
      }
      const angleSuffix = ANGLE_SUFFIXES[angleMode] || '';
      const argument = formatStepValue(arg, precision);
      const displayedArgument = CIRCULAR_TRIG_FUNCTIONS.has(node.name)
        ? `${argument}${angleSuffix}`
        : argument;
      const displayedValue = INVERSE_TRIG_FUNCTIONS.has(node.name)
        ? `${formatStepValue(value, precision)}${angleSuffix}`
        : formatStepValue(value, precision);
      const functionName = FUNCTION_NAMES[node.name] || node.name;
      steps.push(`${functionName}: ${node.name}(${displayedArgument}) = ${displayedValue}`);
      return value;
    }
    case 'postfix': {
      const arg = explainNode(node.arg, angleMode, steps, precision, state);
      const value = node.op === '!'
        ? applyScientificFunction('factorial', arg, angleMode)
        : arg / 100;
      if (node.op === '!') {
        steps.push(`Factorial: ${formatStepValue(arg, precision)}! = ${formatStepValue(value, precision)}`);
      } else {
        steps.push(`Percent as a decimal: ${formatStepValue(arg, precision)}% = ${formatStepValue(value, precision)}`);
      }
      return value;
    }
    case 'binary': {
      const left = explainNode(node.left, angleMode, steps, precision, state);
      const right = explainNode(node.right, angleMode, steps, precision, state);
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
      steps.push(`${OPERATION_NAMES[node.op]}: ${formatStepValue(left, precision)} ${OP_SYMBOLS[node.op]} ${formatStepValue(right, precision)} = ${formatStepValue(value, precision)}`);
      return value;
    }
    default:
      throw new Error('Unsupported expression');
  }
}

export function explainCalculation(latest, context = {}) {
  const angleMode = context.angleMode || ANGLE_MODES.DEG;
  const precision = context.precision || 12;
  const expression = latest?.expression ?? latest?.display ?? '';
  const display = latest?.display ?? null;
  if (!expression) return '';

  try {
    const ast = parseExpression(expression);
    const steps = [];
    const state = { usedAngleFunctions: false };
    const value = explainNode(ast, angleMode, steps, Math.min(precision, 10), state);
    const lines = steps.slice(0, 14).map((step, index) => `${index + 1}. ${step}`);
    if (steps.length > 14) lines.push(`… ${steps.length - 14} more operations`);
    lines.push(`Result: ${display ?? formatStepValue(value, Math.min(precision, 12))}`);
    if (state.usedAngleFunctions) {
      const angleLabel = ANGLE_NAMES[angleMode] || String(angleMode);
      const angleExplanation = angleMode === ANGLE_MODES.DEG
        ? 'Degree mode means trig inputs are measured in degrees; for example, sin(30) uses a 30° angle.'
        : `Angle mode is ${angleLabel}; trig inputs and inverse-trig results use ${angleLabel}.`;
      lines.push('', angleExplanation);
    }
    return `Working out ${expression}:\n${lines.join('\n')}`;
  } catch (error) {
    if (error?.message === 'Division by zero') return `Can't divide by zero — ${expression} is undefined.`;
    return `Couldn't break "${expression}" into steps. The calculator result is ${display || 'shown on the display'}.`;
  }
}
