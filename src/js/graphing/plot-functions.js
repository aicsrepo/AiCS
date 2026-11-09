// Manages the list of plotted functions. Each function is compiled once and only ever receives x. No DOM.
import { compileExpression } from '../expression.js';
import { ANGLE_MODES } from '../scientific.js';

export const PLOT_COLORS = ['#60a5fa', '#c4b5fd', '#34d399', '#fbbf24', '#f472b6', '#f87171'];
const MAX_FUNCTIONS = 8;
const LEADING_LABEL = /^\s*(?:y|f\(x\))\s*=/i;

export function compilePlotFunction(text) {
  const body = text.replace(LEADING_LABEL, '').trim();
  if (!body) throw new Error('Enter a function of x, such as sin(x)');

  const compiled = compileExpression(body, ANGLE_MODES.RAD);
  const unknown = compiled.variables.find((name) => name !== 'x');
  if (unknown) throw new Error(`Graphs only use x. Remove "${unknown}" from the function.`);

  return {
    body,
    evaluate: (x) => {
      try {
        return compiled.evaluate({ x });
      } catch {
        return NaN;
      }
    },
  };
}

export function createFunctionList() {
  let items = [];
  let nextId = 1;
  let colorIndex = 0;

  return {
    add(text) {
      if (items.length >= MAX_FUNCTIONS) {
        throw new Error(`You can plot up to ${MAX_FUNCTIONS} functions at once.`);
      }
      const plot = compilePlotFunction(text);
      const item = {
        id: String(nextId++),
        label: `y = ${plot.body}`,
        color: PLOT_COLORS[colorIndex++ % PLOT_COLORS.length],
        visible: true,
        evaluate: plot.evaluate,
      };
      items = [...items, item];
      return item;
    },
    remove(id) {
      items = items.filter((item) => item.id !== id);
    },
    toggle(id) {
      items = items.map((item) => (item.id === id ? { ...item, visible: !item.visible } : item));
    },
    list() {
      return items;
    },
  };
}
