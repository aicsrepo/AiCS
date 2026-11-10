// Entry point: wires the calculator, graph workspace,
// calculation steps, themes and application interface.

import '../css/style.css';

import { createCalculator } from './calculator.js';

import { explainCalculation } from './calculation-steps.js';

import {
  loadHistory,
  saveHistory,
} from './history-store.js';

import {
  appShellHtml,
  historyHtml,
  prettyExpression,
  escapeHtml,
  formatTimestamp,
} from './ui/render.js';

import { ANGLE_MODE_LABELS } from './scientific.js';
import { mountGraphView } from './ui/graph-view.js';
import { createModeManager } from './mode-manager.js';
import { mountReferenceViews } from './ui/reference-view.js';
import { naturalHtml, latexOf } from './natural.js';
import { initTheme } from './theme.js';
import '../css/calculator.css';


// =========================================
// CONFIGURATION
// =========================================

const KEYBOARD_INSERT = /^[0-9+\-*/().%^!]$/;
const NOTES_STORAGE_KEY = 'aether-notes-v1';


// =========================================
// APPLICATION INITIALIZATION
// =========================================

const app = document.querySelector('#app');

app.innerHTML = appShellHtml();

const query = (selector) => app.querySelector(selector);

// IMPORTANT:
// Sidebar classes must be applied to the inner .app shell,
// not the outer #app element.

const shell = query('.app');


// =========================================
// THEME INITIALIZATION
// =========================================

const themeManager = initTheme(app);


// =========================================
// DOM REFERENCES
// =========================================

const el = {
  display: query('#display'),
  displayExpression: query('#display-expression'),
  displayResult: query('#display-result'),
  displayNatural: query('#display-natural'),
  indicatorShift: query('#ind-shift'),
  indicatorHyp: query('#ind-hyp'),
  indicatorAlpha: query('#ind-alpha'),
  indicatorSto: query('#ind-sto'),
  indicatorMemory: query('#ind-mem'),
  keyboardSoftkey: query('#softkey-keyboard'),

  history: query('#history-list'),
  clearHistory: query('#clear-history'),
  clearDialog: query('#clear-dialog'),
  clearDialogText: query('#clear-dialog-text'),

  solutionEmpty: query('#solution-empty'),
  solutionSteps: query('#solution-steps'),

  settingsDialog: query('#settings-dialog'),
  settingsForm: query('#settings-form'),
  settingsPrecision: query('#settings-precision'),

  calculatorView: query('#calculator-view'),

  // Sidebar elements.
  sidebar: query('#sidebar'),
  graphDrawer: query('#graph-drawer'),

  // Notes elements.
  notesSubject: query('#notes-subject'),
  notesTitle: query('#notes-title'),
  notesContent: query('#notes-content'),
  notesList: query('#notes-list'),
  notesCount: query('#notes-count'),
  notesForm: query('#notes-form'),
  notesError: query('#notes-error'),
  notesFilter: query('#notes-filter'),
  notesSearch: query('#notes-search'),

  // All application pages.
  pages: [...app.querySelectorAll('.page-view')],

  // Sidebar navigation.
  pageLinks: [
    ...app.querySelectorAll('[data-action="navigate-page"]'),
  ],
};


// =========================================
// GRAPH INITIALIZATION
// =========================================

// Keep the graph mounted even when its sidebar is collapsed.
// This preserves plotted functions and graph state.

mountGraphView(query('#graph-view'));

mountReferenceViews(app);


// =========================================
// APPLICATION STATE
// =========================================

let activePage = 'calculator';

let shiftActive = false;

let hypActive = false;

let alphaActive = false;

let keyboardEnabled = true;

// Read the initial sidebar states directly from the rendered HTML.
// This keeps JavaScript synchronized with render.js.

let sidebarOpen = !shell.classList.contains('sidebar-collapsed');
let graphOpen = shell.classList.contains('graph-open');
const narrowViewport = window.matchMedia('(max-width: 760px)');
const compactGraphViewport = window.matchMedia('(min-width: 761px) and (max-width: 1050px)');
let sidebarOpenBeforeGraph = null;

// Phone layout: start with the icon-rail sidebar and the graph closed,
// so the calculator gets the full screen width.
if (narrowViewport.matches) {
  shell.classList.add('sidebar-collapsed');
  shell.classList.remove('graph-open');
  sidebarOpen = false;
  graphOpen = false;
}

const initialHistory = loadHistory();

const calculator = createCalculator({
  history: initialHistory,
});

const modeManager = createModeManager({
  panelEl: query('#mode-panel'),
  dialogEl: query('#mode-dialog'),
  calculatorCard: query('#calculator-card'),
  calculator,
  getAngleMode: () => calculator.getState().angleMode,
});

let persistedHistory = initialHistory;

// =========================================
// NOTES STORAGE
// =========================================

function loadNotes() {
  try {
    const stored = localStorage.getItem(NOTES_STORAGE_KEY);

    if (!stored) return [];

    const parsed = JSON.parse(stored);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((note) =>
      note &&
      typeof note.id === 'string' &&
      typeof note.title === 'string' &&
      typeof note.content === 'string'
    ).map((note) => ({
      subject: 'General',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...note,
    }));

  } catch {
    return [];
  }
}


let notes = loadNotes();

let editingNoteId = null;


function createNoteId() {
  if (globalThis.crypto?.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // randomUUID is unavailable outside secure contexts.
    }
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}


function showNoteError(message) {
  el.notesError.textContent = message;
}


function persistNotes() {
  try {
    localStorage.setItem(
      NOTES_STORAGE_KEY,
      JSON.stringify(notes)
    );

  } catch (error) {
    console.error('Could not save notes:', error);
  }
}


function clearNoteEditor() {
  el.notesTitle.value = '';
  el.notesContent.value = '';
  el.notesSubject.value = 'Mathematics';

  editingNoteId = null;

  showNoteError('');

  const saveButton = query('[data-action="save-note"]');

  if (saveButton) {
    saveButton.textContent = 'Save note';
  }
}


function renderNotes() {
  if (!el.notesList || !el.notesCount) return;

  el.notesCount.textContent =
    `(${notes.length})`;

  if (notes.length === 0) {
    el.notesList.innerHTML = `
      <p class="empty-state">
        Your saved lessons and computations will appear here.
      </p>
    `;

    return;
  }

  const filter = el.notesFilter.value;
  const search = el.notesSearch.value.trim().toLowerCase();

  const visible = notes.filter((note) =>
    (filter === 'All' || note.subject === filter) &&
    (!search || `${note.title} ${note.content}`.toLowerCase().includes(search))
  );

  if (visible.length === 0) {
    el.notesList.innerHTML = '<p class="empty-state">No notes match your filter.</p>';
    return;
  }

  el.notesList.innerHTML = visible
    .map((note) => {
      const id = escapeHtml(note.id);
      const title = escapeHtml(note.title);
      const subject = escapeHtml(note.subject);
      const content = escapeHtml(note.content);

      return `
        <article class="note-card">

          <div class="note-card-header">

            <div>
              <span class="note-subject">${subject} · ${escapeHtml(formatTimestamp(note.updatedAt))}</span>
              <h3>${title}</h3>
            </div>

            <div class="note-actions">

              <button
                type="button"
                class="text-button"
                data-action="edit-note"
                data-id="${id}"
              >Edit</button>

              <button
                type="button"
                class="text-button"
                data-action="delete-note"
                data-id="${id}"
              >Delete</button>

            </div>

          </div>

          <p class="note-content">${content}</p>

        </article>
      `;
    })
    .join('');
}


function saveNote() {
  const title = el.notesTitle.value.trim();
  const content = el.notesContent.value.trim();
  const subject = el.notesSubject.value;

  if (!title || !content) {
    showNoteError('Please enter a note title and content.');
    (title ? el.notesContent : el.notesTitle).focus();
    return;
  }

  if (editingNoteId) {
    notes = notes.map((note) =>
      note.id === editingNoteId
        ? {
            ...note,
            title,
            content,
            subject,
            updatedAt: Date.now(),
          }
        : note
    );

  } else {
    notes.unshift({
      id: createNoteId(),
      title,
      content,
      subject,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  persistNotes();
  renderNotes();
  clearNoteEditor();
}


function editNote(id) {
  const note = notes.find((item) => item.id === id);

  if (!note) return;

  editingNoteId = id;

  el.notesTitle.value = note.title;
  el.notesContent.value = note.content;
  el.notesSubject.value = note.subject;

  const saveButton = query('[data-action="save-note"]');

  if (saveButton) {
    saveButton.textContent = 'Update note';
  }

  el.notesTitle.focus();
}


function insertResultIntoNote() {
  const { latest } = calculator.getState();

  if (!latest) {
    showNoteError('No calculation yet. Use the calculator first.');
    return;
  }

  const line = `${prettyExpression(latest.expression)} = ${latest.display}`;
  const { value, selectionStart, selectionEnd } = el.notesContent;
  const prefix = value && !value.endsWith('\n') && selectionStart === value.length ? '\n' : '';

  el.notesContent.setRangeText(prefix + line, selectionStart, selectionEnd, 'end');
  el.notesContent.focus();
  showNoteError('');
}


function deleteNote(id) {
  if (!confirm('Delete this note?')) return;

  notes = notes.filter((note) => note.id !== id);

  if (editingNoteId === id) {
    clearNoteEditor();
  }

  persistNotes();
  renderNotes();
}


// =========================================
// SIDEBAR MANAGEMENT
// =========================================

function updateSidebarButtons() {
  // Left navigation toggle.

  const leftToggle = query(
    '[data-action="toggle-sidebar"]'
  );

  if (leftToggle) {
    leftToggle.setAttribute(
      'aria-expanded',
      String(sidebarOpen)
    );
  }

  // Right graph toggle.

  const graphToggles = app.querySelectorAll(
    '[data-action="toggle-graph"]'
  );

  graphToggles.forEach((button) => {
    button.setAttribute(
      'aria-expanded',
      String(graphOpen)
    );
  });

  // Graph drawer accessibility state.

  if (el.graphDrawer) {
    el.graphDrawer.setAttribute(
      'aria-hidden',
      String(!graphOpen)
    );
  }
}


// LEFT NAVIGATION SIDEBAR

function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  sidebarOpenBeforeGraph = null;

  shell.classList.toggle(
    'sidebar-collapsed',
    !sidebarOpen
  );

  updateSidebarButtons();
}


// RIGHT GRAPH SIDEBAR

function syncGraphSidebarLayout() {
  if (!graphOpen) return;

  if (compactGraphViewport.matches && sidebarOpen) {
    sidebarOpenBeforeGraph = sidebarOpen;
    sidebarOpen = false;
    shell.classList.add('sidebar-collapsed');
  } else if (!compactGraphViewport.matches && !narrowViewport.matches && sidebarOpenBeforeGraph !== null) {
    sidebarOpen = sidebarOpenBeforeGraph;
    sidebarOpenBeforeGraph = null;
    shell.classList.toggle('sidebar-collapsed', !sidebarOpen);
  }

  updateSidebarButtons();
}


function openGraphSidebar() {
  if (graphOpen) return;

  graphOpen = true;

  shell.classList.add('graph-open');

  syncGraphSidebarLayout();

  // Redraw after the graph sidebar starts opening.
  // ResizeObserver in graph-view.js handles canvas dimensions.

  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
  });
}


function closeGraphSidebar() {
  if (!graphOpen) return;

  graphOpen = false;

  shell.classList.remove('graph-open');

  if (sidebarOpenBeforeGraph !== null) {
    sidebarOpen = sidebarOpenBeforeGraph;
    sidebarOpenBeforeGraph = null;
    shell.classList.toggle('sidebar-collapsed', !sidebarOpen);
  }

  updateSidebarButtons();
}


function toggleGraphSidebar() {
  if (graphOpen) {
    closeGraphSidebar();

  } else {
    openGraphSidebar();
  }
}

narrowViewport.addEventListener('change', ({ matches }) => {
  if (!matches) return;

  sidebarOpen = false;
  graphOpen = false;
  sidebarOpenBeforeGraph = null;
  shell.classList.add('sidebar-collapsed');
  shell.classList.remove('graph-open');
  updateSidebarButtons();

  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
  });
});

compactGraphViewport.addEventListener('change', syncGraphSidebarLayout);
syncGraphSidebarLayout();


// =========================================
// MAIN RENDER
// =========================================

function render() {
  const state = calculator.getState();

  // Persist calculation history.

  if (state.history !== persistedHistory) {
    saveHistory(state.history);
    persistedHistory = state.history;
  }

  // Calculator display.

  el.displayExpression.textContent =
    state.expression ? prettyExpression(state.expression) : '0';

  const natural = naturalHtml(state.expression);

  el.displayNatural.classList.toggle('is-placeholder', !natural);

  el.displayNatural.innerHTML = natural
    ?? (state.expression
      ? escapeHtml(prettyExpression(state.expression))
      : 'Math preview…');

  el.displayNatural.scrollLeft = el.displayNatural.scrollWidth;

  el.displayExpression.scrollLeft =
    el.displayExpression.scrollWidth;

  el.displayResult.textContent = state.display;

  el.display.classList.toggle(
    'display--error',
    state.isError
  );

  el.display.classList.toggle(
    'display--long',
    state.display.length > 12
  );

  // Angle mode.

  const angleBtn = query('[data-action="toggle-angle"]');
  if (angleBtn) {
    angleBtn.textContent = ANGLE_MODE_LABELS[state.angleMode] ?? 'D';
  }

  query('[data-action="toggle-shift"]')?.setAttribute('aria-pressed', String(shiftActive));

  query('[data-action="toggle-hyp"]')?.classList.toggle('is-active', hypActive);

  query('[data-action="toggle-alpha"]')?.setAttribute('aria-pressed', String(alphaActive));

  query('[data-action="toggle-eng"]')?.classList.toggle('is-active', state.engMode);

  el.indicatorShift.classList.toggle('is-on', shiftActive);
  el.indicatorHyp.classList.toggle('is-on', hypActive);
  el.indicatorAlpha.classList.toggle('is-on', alphaActive);
  el.indicatorSto.classList.toggle('is-on', state.fractionMode);
  el.indicatorMemory.classList.toggle('is-on', state.memory !== 0);

  el.keyboardSoftkey.setAttribute('aria-pressed', String(keyboardEnabled));
    
  // History.

  el.history.innerHTML = historyHtml(state.history);

  el.clearHistory.disabled =
    state.history.length === 0;

  const steps = state.latest
    ? explainCalculation(state.latest, {
      angleMode: state.angleMode,
      precision: state.precision,
    })
    : '';
  el.solutionEmpty.hidden = Boolean(steps);
  el.solutionSteps.hidden = !steps;
  el.solutionSteps.textContent = steps;
}


// =========================================
// CLIPBOARD
// =========================================

function flashButton(button, text) {
  const original = button.dataset.originalHtml ?? button.innerHTML;

  button.dataset.originalHtml = original;
  button.textContent = text;
  button.classList.add('is-flash');

  clearTimeout(Number(button.dataset.flashTimer));

  button.dataset.flashTimer = String(setTimeout(() => {
    button.innerHTML = original;
    button.classList.remove('is-flash');
    delete button.dataset.originalHtml;
  }, 1100));
}

async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    flashButton(button, 'Copied');
  } catch {
    const helper = document.createElement('textarea');
    helper.value = text;
    document.body.append(helper);
    helper.select();
    const ok = document.execCommand('copy');
    helper.remove();
    flashButton(button, ok ? 'Copied' : 'Failed');
  }
}

function copyLatex(button) {
  const state = calculator.getState();
  const source = state.expression || state.latest?.expression || '';
  const latex = latexOf(source);

  if (!latex) {
    flashButton(button, 'Empty');
    return;
  }

  const result = state.isError ? '' : ` = ${state.display}`;
  copyToClipboard(`${latex}${result}`, button);
}


// =========================================
// PAGE NAVIGATION
// =========================================

function navigatePage(page) {
  const validPages = [
    'calculator',
    'history',
    'notes',
    'formulas',
    'symbols',
    'definitions',
    'appearance',
  ];

  if (!validPages.includes(page)) return;

  activePage = page;

  shell.dataset.page = page;

  // Display selected page.

  for (const section of el.pages) {
    section.hidden =
      section.id !== `${page}-view`;
  }

  // Update active navigation link.

  for (const link of el.pageLinks) {
    const isActive =
      link.dataset.page === page;

    link.classList.toggle(
      'is-active',
      isActive
    );

    if (isActive) {
      link.setAttribute('aria-current', 'page');

    } else {
      link.removeAttribute('aria-current');
    }
  }

  if (page === 'notes') {
    renderNotes();
  }
}


// =========================================
// SETTINGS
// =========================================

function showSettingsTab(tab) {
  for (const button of app.querySelectorAll('.settings-tab')) {
    const selected = button.dataset.tab === tab;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', String(selected));
  }

  for (const panel of app.querySelectorAll('.settings-panel')) {
    panel.hidden = panel.dataset.panel !== tab;
  }
}


function openSettings() {
  showSettingsTab('appearance');

  el.settingsPrecision.value = String(
    calculator.getState().precision
  );

  el.settingsDialog.showModal();
}


// =========================================
// CLEAR HISTORY
// =========================================

function openClearHistoryDialog() {
  const count =
    calculator.getState().history.length;

  const noun = count === 1
    ? 'calculation'
    : 'calculations';

  el.clearDialogText.textContent =
    `This will permanently delete ${count} saved ${noun}. This cannot be undone.`;

  el.clearDialog.showModal();
}


// =========================================
// CLICK EVENTS
// =========================================

app.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');

  if (!target) return;

  const shiftPressed = shiftActive;
  if (target.dataset.action !== 'toggle-shift') shiftActive = false;

  const alphaPressed = alphaActive;
  if (target.dataset.action !== 'toggle-alpha') alphaActive = false;

  switch (target.dataset.action) {

    // CALCULATOR

    case 'insert': {
      const { value, shiftValue, hypValue, alphaValue } = target.dataset;

      if (shiftPressed && shiftValue !== undefined) {
        calculator.insert(shiftValue);
      } else if (alphaPressed && alphaValue !== undefined) {
        calculator.insert(alphaValue);
      } else if (hypActive && hypValue !== undefined) {
        calculator.insert(hypValue);
      } else {
        calculator.insert(value);
      }

      if (hypValue !== undefined) hypActive = false;
      break;
    }

    case 'toggle-hyp':
      hypActive = !hypActive;
      break;

    case 'insert-dms':
      calculator.insertDms();
      break;
      
    case 'insert-ans':
      calculator.insertAns();
      break;

    case 'memory-add':
      calculator.memoryAdd(shiftPressed ? -1 : 1);
      break;

    case 'memory-recall':
      if (shiftPressed) calculator.memoryStore();
      else calculator.memoryRecall();
      break;

    case 'memory-store':
      calculator.memoryStore();
      break;

    case 'toggle-fraction':
      calculator.toggleFraction();
      break;

    case 'toggle-eng':
      calculator.toggleEng();
      break;

    case 'integral':
      calculator.integral();
      break;

    case 'derivative':
      calculator.derivative();
      break;

    case 'toggle-alpha':
      alphaActive = !alphaActive;
      break;

    case 'replay':
      calculator.replay(Number(target.dataset.direction));
      break;

    case 'toggle-keyboard':
      keyboardEnabled = !keyboardEnabled;
      break;

    case 'copy-result':
      copyToClipboard(calculator.getState().display, target);
      return;

    case 'copy-latex':
      copyLatex(target);
      return;

    case 'toggle-shift':
      shiftActive = !shiftActive;
      break;

    case 'clear':
      calculator.clear();
      break;

    case 'backspace':
      calculator.backspace();
      break;

    case 'equals':
      calculator.equals();
      break;

    case 'toggle-angle':
      calculator.toggleAngleMode();
      break;

    case 'recall':
      calculator.recall(target.dataset.id);
      break;


    // HISTORY

    case 'delete-history':
      calculator.removeHistoryItem(
        target.dataset.id
      );
      break;

    case 'confirm-clear-history':
      openClearHistoryDialog();
      return;

    case 'cancel-clear':
      el.clearDialog.close();
      return;

    case 'confirm-clear':
      calculator.clearHistory();
      el.clearDialog.close();
      break;


    // LEFT SIDEBAR

    case 'toggle-sidebar':
      toggleSidebar();
      return;


    // RIGHT GRAPH SIDEBAR

    case 'toggle-graph':
      toggleGraphSidebar();
      return;

    case 'close-graph':
      closeGraphSidebar();
      return;


    // NOTES

    case 'save-note':
      event.preventDefault();
      saveNote();
      return;

    case 'insert-result-note':
      insertResultIntoNote();
      return;

    case 'clear-note':
      clearNoteEditor();
      return;

    case 'edit-note':
      editNote(target.dataset.id);
      return;

    case 'delete-note':
      deleteNote(target.dataset.id);
      return;


    // PAGE NAVIGATION

    case 'navigate-page':
      navigatePage(target.dataset.page);
      return;


    // SETTINGS

    case 'open-settings':
      openSettings();
      return;

    case 'close-settings':
      el.settingsDialog.close();
      return;

    case 'settings-tab':
      showSettingsTab(target.dataset.tab);
      return;


    // APPEARANCE

    case 'reset-theme':
      themeManager.reset();
      return;


    default:
      return;
  }

  render();
});


// =========================================
// KEYBOARD INPUT
// =========================================

document.addEventListener('keydown', (event) => {
  if (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  ) {
    return;
  }

  if (
    !keyboardEnabled ||
    activePage !== 'calculator' ||
    modeManager.getMode() !== 'comp' ||
    document.querySelector('dialog[open]')
  ) {
    return;
  }

  if (
    event.target instanceof Element &&
    event.target.closest('input, textarea, select')
  ) {
    return;
  }

  const { key } = event;

  if (KEYBOARD_INSERT.test(key)) {
    event.preventDefault();
    calculator.insert(key);

  } else if (key === 'Enter' || key === '=') {
    event.preventDefault();
    calculator.equals();

  } else if (key === 'Backspace') {
    event.preventDefault();
    calculator.backspace();

  } else if (key === 'Escape') {
    calculator.clear();

  } else {
    return;
  }

  render();
});


// =========================================
// NOTES FORM
// =========================================

el.notesForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveNote();
});

el.notesFilter.addEventListener('change', renderNotes);
el.notesSearch.addEventListener('input', renderNotes);

el.notesTitle.addEventListener('input', () => showNoteError(''));
el.notesContent.addEventListener('input', () => showNoteError(''));


// =========================================
// SETTINGS FORM
// =========================================

el.settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();

  calculator.setPrecision(
    Number(el.settingsPrecision.value)
  );

  el.settingsDialog.close();
});


// =========================================
// INITIALIZATION
// =========================================

// Keep the sidebar states synchronized with render.js.
// Do not forcibly close the graph sidebar here.

sidebarOpen = !shell.classList.contains('sidebar-collapsed');
graphOpen = shell.classList.contains('graph-open');

updateSidebarButtons();


// Start on calculator page.

navigatePage('calculator');

// Render saved notes.

renderNotes();

// Scrollbars only show while an element is being scrolled (or hovered).

const scrollHideTimers = new WeakMap();

document.addEventListener('scroll', (event) => {
  const target = event.target === document
    ? document.documentElement
    : event.target;

  if (!(target instanceof Element)) return;

  target.classList.add('is-scrolling');
  clearTimeout(scrollHideTimers.get(target));
  scrollHideTimers.set(
    target,
    setTimeout(() => target.classList.remove('is-scrolling'), 900)
  );
}, { capture: true, passive: true });


// Initial render.

render();
