// Markup for the scientific calculator card: display, function keys and number pad.
// Key values are fixed constants, so they are written into the markup without escaping.

const FUNCTION_KEYS = [
  { label: 'Abs', value: 'abs(' },
  { label: 'x³', value: '^3', shiftLabel: '∛', shiftValue: 'cbrt(' },
  { label: 'x⁻¹', value: '^(-1)', shiftLabel: 'x!', shiftValue: '!' },
  { label: 'log▫', value: 'log(' },
  { label: '∫', action: 'integral' },
  { label: 'd/dx', action: 'derivative' },

  { label: '■/▫', value: '/', shiftLabel: 'a b/c' },
  { label: '√▫', value: 'sqrt(', shiftLabel: '∛', shiftValue: 'cbrt(' },
  { label: 'x²', value: '^2' },
  { label: 'x^▫', value: '^', shiftLabel: 'x√▫', shiftValue: '^(1/' },
  { label: 'log', value: 'log(', shiftLabel: '10^▫', shiftValue: '10^' },
  { label: 'ln', value: 'ln(', shiftLabel: 'e^▫', shiftValue: 'exp(' },

  { label: '(−)', value: '(-', alphaLabel: 'A' },
  { label: '° ′ ″', action: 'insert-dms', alphaLabel: 'B' },
  { label: 'hyp', action: 'toggle-hyp', alphaLabel: 'C' },
  { label: 'sin', value: 'sin(', shiftLabel: 'sin⁻¹', shiftValue: 'asin(', hypValue: 'sinh(', alphaLabel: 'D' },
  { label: 'cos', value: 'cos(', shiftLabel: 'cos⁻¹', shiftValue: 'acos(', hypValue: 'cosh(', alphaLabel: 'E' },
  { label: 'tan', value: 'tan(', shiftLabel: 'tan⁻¹', shiftValue: 'atan(', hypValue: 'tanh(', alphaLabel: 'F' },

  { label: 'RCL', action: 'memory-recall', shiftLabel: 'STO' },
  { label: 'ENG', action: 'toggle-eng' },
  { label: '(', value: '(', shiftLabel: '%', shiftValue: '%' },
  { label: ')', value: ')', shiftLabel: ',', alphaLabel: 'X' },
  { label: 'S⇔D', action: 'toggle-fraction', alphaLabel: 'Y' },
  { label: 'M+', action: 'memory-add', shiftLabel: 'M−', alphaLabel: 'M' },
];

const NUMBER_KEYS = [
  { label: '7', value: '7', shiftLabel: 'CONST' },
  { label: '8', value: '8', shiftLabel: 'CONV' },
  { label: '9', value: '9', shiftLabel: 'CLR' },
  { label: 'DEL', action: 'backspace', variant: 'accent', shiftLabel: 'INS' },
  { label: 'AC', action: 'clear', variant: 'accent', shiftLabel: 'OFF' },

  { label: '4', value: '4', shiftLabel: 'MATRIX' },
  { label: '5', value: '5', shiftLabel: 'VECTOR' },
  { label: '6', value: '6' },
  { label: '×', value: '*', shiftLabel: 'nPr' },
  { label: '÷', value: '/', shiftLabel: 'nCr' },

  { label: '1', value: '1', shiftLabel: 'STAT' },
  { label: '2', value: '2', shiftLabel: 'CMPLX' },
  { label: '3', value: '3', shiftLabel: 'BASE' },
  { label: '+', value: '+', shiftLabel: 'Pol' },
  { label: '−', value: '-', shiftLabel: 'Rec' },

  { label: '0', value: '0', shiftLabel: 'Rnd' },
  { label: '.', value: '.', shiftLabel: 'Ran#' },
  { label: '×10ˣ', value: '*10^', shiftLabel: 'π', shiftValue: 'pi', alphaLabel: 'e' },
  { label: 'Ans', action: 'insert-ans', shiftLabel: 'DRG▶' },
  { label: '=', action: 'equals', variant: 'equals' },
];

const KEYBOARD_ICON = '<svg class="softkey-icon" viewBox="0 0 22 16" aria-hidden="true"><rect x="1" y="1" width="20" height="14" rx="3" fill="currentColor" opacity=".25" stroke="currentColor" stroke-width="1.5"/><path d="M7 2v12M11 2v12M15 2v12" stroke="currentColor" stroke-width="1.5"/></svg>';

function keyHtml(key) {
  const {
    label,
    value,
    shiftLabel = '',
    shiftValue,
    hypValue,
    alphaLabel = '',
    variant,
    action,
    disabled = false,
  } = key;

  const resolvedAction = disabled ? undefined : (action ?? 'insert');
  const actionAttr = resolvedAction ? ` data-action="${resolvedAction}"` : '';
  const valueAttr = resolvedAction === 'insert' ? ` data-value="${value ?? label}"` : '';
  const shiftAttr = shiftValue !== undefined ? ` data-shift-value="${shiftValue}"` : '';
  const hypAttr = hypValue !== undefined ? ` data-hyp-value="${hypValue}"` : '';
  const alphaAttr = alphaLabel ? ` data-alpha-value="${alphaLabel}"` : '';
  const variantClass = variant ? ` key--${variant}` : '';

  return `
    <div class="key-cell">
      <div class="key-labels">
        <span class="key-label key-label--shift">${shiftLabel}</span>
        <span class="key-label key-label--alpha">${alphaLabel}</span>
      </div>
      <button type="button" class="key${variantClass}"${actionAttr}${valueAttr}${shiftAttr}${hypAttr}${alphaAttr}${disabled ? ' disabled' : ''}>${label}</button>
    </div>`;
}

function keysHtml(keys) {
  return keys.map(keyHtml).join('');
}

export function calculatorCardHtml() {
  return `
    <section class="calculator-card" id="calculator-card" aria-label="Scientific calculator">

      <header class="calc-header">
        <h2 class="calc-title">Scientific Calculator</h2>
        <span class="calc-solar" aria-hidden="true"></span>
      </header>

      <div class="calc-scroll">

      <div class="lcd">
        <div class="lcd-status">
          <span class="lcd-indicator lcd-indicator--shift" id="ind-shift">S</span>
          <span class="lcd-indicator lcd-indicator--alpha" id="ind-alpha">A</span>
          <span class="lcd-indicator lcd-indicator--hyp" id="ind-hyp">HYP</span>
          <span class="lcd-indicator lcd-indicator--sto" id="ind-sto">STO</span>
          <span class="lcd-indicator lcd-indicator--mem" id="ind-mem">M</span>
          <span class="lcd-status-spacer"></span>
          <button
            type="button"
            class="angle-toggle"
            data-action="toggle-angle"
            aria-label="Switch between degrees and radians"
            title="Degrees / Radians"
          >D</button>
          <span class="lcd-indicator lcd-indicator--comp">COMP</span>
          <span class="lcd-indicator lcd-indicator--norm">NORM1</span>
          <span class="lcd-indicator lcd-indicator--math">Math ▴▾</span>
        </div>

        <div class="display" id="display">
          <p class="display-expression" id="display-expression">0</p>
          <p class="display-natural" id="display-natural"></p>
          <p class="display-result" id="display-result" aria-live="polite">0</p>
        </div>

        <div class="lcd-softkeys">
          <button type="button" class="softkey" data-action="toggle-fraction" title="Toggle fraction / decimal">S⇔D</button>
          <button type="button" class="softkey" data-action="memory-store" title="Store result in memory (M)">STO▶</button>
          <span class="softkey-gap"></span>
          <button type="button" class="softkey" data-action="toggle-keyboard" id="softkey-keyboard" aria-pressed="true" title="Enable or disable keyboard input">${KEYBOARD_ICON} Keybd</button>
          <button type="button" class="softkey" data-action="copy-latex" title="Copy as LaTeX">LaTeX</button>
          <button type="button" class="softkey" data-action="copy-result" title="Copy result">Copy</button>
          <button type="button" class="softkey softkey--danger" data-action="clear">AC</button>
        </div>
      </div>

      </div>

      <div class="calc-controls">
        <div class="control-stack">
          <div class="control">
            <span class="control-label control-label--shift">SHIFT</span>
            <button type="button" class="control-button control-button--shift" data-action="toggle-shift" aria-pressed="false">S</button>
          </div>
          <div class="control">
            <span class="control-label control-label--alpha">ALPHA</span>
            <button type="button" class="control-button control-button--alpha" data-action="toggle-alpha" aria-pressed="false">A</button>
          </div>
        </div>

        <div class="replay-pad">
          <button type="button" class="replay-arrow replay-arrow--up" data-action="replay" data-direction="1" aria-label="Previous calculation">▲</button>
          <button type="button" class="replay-arrow replay-arrow--left" data-action="backspace" aria-label="Delete last character">◀</button>
          <span class="replay-center">REPLAY</span>
          <button type="button" class="replay-arrow replay-arrow--right" data-action="equals" aria-label="Evaluate">▶</button>
          <button type="button" class="replay-arrow replay-arrow--down" data-action="replay" data-direction="-1" aria-label="Next calculation">▼</button>
        </div>

        <div class="control-stack control-stack--right">
          <div class="control">
            <span class="control-label control-label--shift">SETUP</span>
            <button type="button" class="control-button" data-mode-action="open-mode-dialog">MODE</button>
          </div>
          <div class="control">
            <button type="button" class="control-button" data-action="clear">ON</button>
          </div>
        </div>
      </div>

      <div class="calc-deck">
        <div class="fn-pad">${keysHtml(FUNCTION_KEYS)}</div>

        <div class="calc-divider" aria-hidden="true"></div>

        <div class="num-pad">${keysHtml(NUMBER_KEYS)}</div>
      </div>


    </section>`;
}
