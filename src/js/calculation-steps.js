import { parseExpression } from './expression.js';
import { applyScientificFunction, ANGLE_MODES } from './scientific.js';
import { formatResult } from './calculator.js';

const ANGLE_NAMES = { deg: 'degrees', rad: 'radians', grad: 'gradians' };
const OP_SYMBOLS = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };

function formatStepValue(value, precision) {
  if (Object.is(value, -0)) return '0';
  return formatResult(value, precision);
}

function explainNode(node, angleMode, steps, precision) {
  switch (node.type) {
    case 'num':
      return node.value;
    case 'var':
      throw new Error('Variables are not supported');
    case 'neg':
      return -explainNode(node.arg, angleMode, steps, precision);
    case 'call': {
      const arg = explainNode(node.arg, angleMode, steps, precision);
      const value = applyScientificFunction(node.name, arg, angleMode);
      steps.push(`${node.name}(${formatStepValue(arg, precision)}) = ${formatStepValue(value, precision)}`);
      return value;
    }
    case 'postfix': {
      const arg = explainNode(node.arg, angleMode, steps, precision);
      const value = node.op === '!'
        ? applyScientificFunction('factorial', arg, angleMode)
        : arg / 100;
      const operation = node.op === '!' ? '!' : '%';
      steps.push(`${formatStepValue(arg, precision)}${operation} = ${formatStepValue(value, precision)}`);
      return value;
    }
    case 'binary': {
      const left = explainNode(node.left, angleMode, steps, precision);
      const right = explainNode(node.right, angleMode, steps, precision);
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
      steps.push(`${formatStepValue(left, precision)} ${OP_SYMBOLS[node.op]} ${formatStepValue(right, precision)} = ${formatStepValue(value, precision)}`);
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
    const value = explainNode(ast, angleMode, steps, Math.min(precision, 10));
    const angleLabel = ANGLE_NAMES[angleMode] || String(angleMode);
    const lines = steps.slice(0, 14).map((step, index) => `${index + 1}. ${step}`);
    if (steps.length > 14) lines.push(`… ${steps.length - 14} more operations`);
    lines.push(`Result: ${display ?? formatStepValue(value, Math.min(precision, 12))}`);
    return `Working out ${expression} step by step (angles in ${angleLabel}):\n${lines.join('\n')}`;
  } catch (error) {
    if (error?.message === 'Division by zero') return `Can't divide by zero — ${expression} is undefined.`;
    return `Couldn't break "${expression}" into steps. The calculator result is ${display || 'shown on the display'}.`;
  }
}
