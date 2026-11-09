// Calculation-mode manager: the MODE dialog, per-mode panels, input persistence and results.
import { MODES, MODE_IDS, panelHtml, computePanel } from './modes/panels.js';

const STORAGE_KEY = 'aics-mode-v1';

function loadMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return MODE_IDS.includes(stored) ? stored : 'comp';
  } catch {
    return 'comp';
  }
}

export function createModeManager({ panelEl, dialogEl, calculatorCard, calculator, getAngleMode }) {
  let mode = loadMode();
  const inputs = {};
  const ui = {};
  let pendingInsert = null;

  const modeInputs = () => (inputs[mode] ??= {});
  const modeUi = () => (ui[mode] ??= {});

  function saveMode() {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage unavailable (private mode); mode still works for this session.
    }
  }

  function renderDialog() {
    dialogEl.querySelector('#mode-dialog-grid').innerHTML = MODES.map((item, index) => {
      const active = item.id === mode;
      return `
        <button type="button" class="mode-choice${active ? ' is-active' : ''}" data-mode-action="select-mode" data-mode="${item.id}">
          <span class="mode-choice-num">${index + 1}</span>
          <span class="mode-choice-body">
            <span class="mode-choice-title">${item.name} <span class="mode-tag">${item.tag}</span></span>
            <span class="mode-choice-desc">${item.desc}</span>
          </span>
          ${active ? '<span class="mode-choice-active">Active</span>' : ''}
        </button>`;
    }).join('');
  }

  function renderPanel() {
    if (mode === 'comp' || !panelEl) {
      if (panelEl) {
        panelEl.hidden = true;
        panelEl.innerHTML = '';
      }
      if (calculatorCard) calculatorCard.hidden = false;
      return;
    }

    panelEl.innerHTML = panelHtml(mode, modeInputs(), modeUi());
    panelEl.hidden = false;
    if (calculatorCard) calculatorCard.hidden = true;
  }

  function collectInputs() {
    if (!panelEl) return;
    for (const field of panelEl.querySelectorAll('input[name], textarea[name]')) {
      modeInputs()[field.name] = field.value;
    }
  }

  function renderResults(result) {
    const box = panelEl?.querySelector('[data-mode-results]');
    if (box) box.innerHTML = result.html;
    modeInputs().__results = result.html;
    pendingInsert = result.insertValue ?? null;

    if (pendingInsert !== null && box && !box.querySelector('.mode-insert')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mode-btn mode-btn--primary mode-insert';
      button.dataset.modeAction = 'insert-result';
      button.textContent = 'Insert result into calculator';
      box.appendChild(button);
    }
  }

  function runCompute(action = null) {
    collectInputs();
    const result = computePanel(mode, modeInputs(), modeUi(), { angleMode: getAngleMode() }, action);
    renderResults(result);
  }

  function setMode(next) {
    if (!MODE_IDS.includes(next)) return;
    mode = next;
    saveMode();
    renderPanel();
    if (next !== 'comp') {
      dialogEl.close();
    }
  }

  function openDialog() {
    renderDialog();
    if (!dialogEl.open) dialogEl.showModal();
  }

  function handleAction(target) {
    const action = target.dataset.modeAction;
    if (!action) return;

    switch (action) {
      case 'open-mode-dialog':
        openDialog();
        return;

      case 'close-mode-dialog':
        dialogEl.close();
        return;

      case 'select-mode':
        setMode(target.dataset.mode);
        return;

      case 'exit-mode':
        setMode('comp');
        return;

      case 'compute':
        runCompute();
        return;

      case 'insert-result':
        if (pendingInsert !== null) {
          calculator.clear();
          calculator.insert(pendingInsert);
          setMode('comp');
        }
        return;

      case 'cmplx-key': {
        const input = panelEl.querySelector('input[name="expr"]');
        if (!input) return;
        collectInputs();
        input.value = (input.value ?? '') + target.dataset.key;
        input.focus();
        return;
      }

      case 'cmplx-clear': {
        const input = panelEl.querySelector('input[name="expr"]');
        if (input) input.value = '';
        modeInputs().expr = '';
        delete modeInputs().__results;
        panelEl.querySelector('[data-mode-results]').innerHTML = '';
        pendingInsert = null;
        return;
      }

      case 'basen-base':
        modeUi().base = target.dataset.base;
        collectInputs();
        renderPanel();
        return;

      case 'basen-bitwise':
        runCompute({ op: target.dataset.op });
        return;

      case 'matrix-add':
      case 'matrix-sub':
      case 'matrix-mul':
      case 'matrix-det':
      case 'matrix-inv':
      case 'matrix-transpose':
        runCompute({ op: action.replace('matrix-', '') });
        return;

      case 'eqn-tab':
        modeUi().tab = target.dataset.tab;
        collectInputs();
        renderPanel();
        return;

      case 'matrix-size':
        modeUi().size = Number(target.dataset.size);
        collectInputs();
        renderPanel();
        return;

      case 'vector-dims':
        modeUi().dims = Number(target.dataset.dims);
        collectInputs();
        renderPanel();
        return;

      default:
        return;
    }
  }

  // Click delegation: mode controls live in the calculator card (MODE button),
  // the mode panel and the dialog, so listen at document level.
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-mode-action]');
    if (target) handleAction(target);
  });

  // Live input persistence (no re-render while typing).
  panelEl?.addEventListener('input', (event) => {
    const field = event.target.closest('[name]');
    if (field && field.name !== '__results') modeInputs()[field.name] = field.value;
  });

  // Enter runs the primary action inside the panel.
  panelEl?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type === 'textarea') return;
    event.preventDefault();
    panelEl.querySelector('[data-mode-action="compute"]')?.click()
      ?? panelEl.querySelector('[data-mode-action="matrix-det"]')?.click();
  });

  // Number keys 1-8 pick a mode while the dialog is open.
  document.addEventListener('keydown', (event) => {
    if (!dialogEl?.open) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const index = Number(event.key) - 1;
    if (index >= 0 && index < MODES.length) {
      event.preventDefault();
      setMode(MODES[index].id);
    }
  });

  // Restore the persisted mode on startup.
  renderPanel();

  return {
    openDialog,
    getMode: () => mode,
    setMode,
  };
}
