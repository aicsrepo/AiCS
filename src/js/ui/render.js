// Markup for the app shell and dynamic lists.
// Pure string builders; all user-visible text is escaped.

import { calculatorCardHtml } from './calculator-markup.js';
import { referenceToolbarHtml } from './reference-view.js';
import { THEME_PRESETS, CUSTOM_COLOR_FIELDS } from '../theme.js';


const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

export function prettyExpression(text) {
  return String(text)
    .replace(/sqrt\(/g, '√(')
    .replace(/cbrt\(/g, '∛(')
    .replace(/pi/g, 'π')
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/-/g, '−');
}


const timeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatTimestamp(ms) {
  return timeFormatter.format(new Date(ms));
}

export function historyHtml(history) {
  if (history.length === 0) {
    return '<li class="empty-state">No calculations yet.</li>';
  }

  return history.map((item) => {
    const expression = escapeHtml(prettyExpression(item.expression));
    const id = escapeHtml(item.id);

    return `
      <li class="history-row">
        <button
          type="button"
          class="history-item"
          data-action="recall"
          data-id="${id}"
        >
          <span class="history-expression">${expression}</span>
          <span class="history-result">= ${escapeHtml(item.display)}</span>
          <time
            class="history-time"
            datetime="${new Date(item.timestamp).toISOString()}"
          >${formatTimestamp(item.timestamp)}</time>
        </button>

        <button
          type="button"
          class="history-delete"
          data-action="delete-history"
          data-id="${id}"
          aria-label="Delete calculation ${expression}"
        >×</button>
      </li>
    `;
  }).join('');
}

export function graphWorkspaceHtml() {
  return `
      <section class="graph-workspace">
      <div class="graph-card">

        <div class="graph-toolbar">
          <div>
            <h2>Graphing Calculator</h2>
            <p class="graph-hint">
              Drag to pan. Scroll or use the controls to zoom.
            </p>
          </div>

          <div class="graph-controls">
            <button
              type="button"
              class="icon-button"
              data-action="zoom-in"
              aria-label="Zoom in"
            >+</button>

            <button
              type="button"
              class="icon-button"
              data-action="zoom-out"
              aria-label="Zoom out"
            >−</button>

            <button
              type="button"
              class="icon-button"
              data-action="reset-view"
            >Reset</button>
          </div>
        </div>

        <div class="graph-stage" id="graph-stage">
          <canvas
            id="graph-canvas"
            role="img"
              aria-label="Graph of plotted functions"
          ></canvas>
        </div>

      </div>

      <aside class="card function-panel" aria-labelledby="functions-title">

        <h2 id="functions-title">Functions</h2>

        <form class="function-form" id="function-form">
          <input
            id="function-input"
            type="text"
            autocomplete="off"
            placeholder="y = sin(x)"
              aria-label="Function of x"
          />

          <button type="submit" class="button button--primary">
            Plot
          </button>
        </form>

        <p class="form-error" id="function-error" role="alert"></p>

        <ul class="function-list" id="function-list"></ul>

      </aside>

    </section>
  `;
}

export function appShellHtml() {
  return `
    <div class="app graph-open" data-page="calculator">

      <!-- TOP NAVIGATION HEADER -->

      <header class="app-header">

        <div class="header-brand">
          <svg
            class="header-logo"
            viewBox="0 0 40 40"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient id="header-logo-gradient" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                <stop stop-color="#82b5ff" />
                <stop offset="1" stop-color="#7054d8" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#header-logo-gradient)" />
            <circle cx="20" cy="20" r="13" fill="none" stroke="white" stroke-opacity=".22" />
            <path d="M8.5 22c3.8 0 3.8-9 7.6-9s3.8 14 7.6 14 3.8-9 7.8-9" fill="none" stroke="white" stroke-linecap="round" stroke-width="2.2" />
            <circle cx="31" cy="9" r="1.5" fill="white" />
          </svg>
          <h1 class="app-title">AiCS</h1>
        </div>

      </header>

      <!-- APPLICATION LAYOUT -->

      <div class="app-layout">

        <!-- LEFT SIDEBAR -->

        <aside class="sidebar" id="sidebar">

          <div class="sidebar-header">
            <button
              type="button"
              class="icon-button sidebar-toggle"
              data-action="toggle-sidebar"
              aria-label="Toggle navigation sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
            </button>
          </div>

          <div class="sidebar-section">
            <p class="sidebar-heading">Workspace</p>
            <button
              type="button"
              class="sidebar-link is-active"
              data-action="navigate-page"
              data-page="calculator"
              aria-label="Calculator"
              title="Calculator"
            >
              <span class="sidebar-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg></span>
              <span class="sidebar-label">Calculator</span>
            </button>
            <button
              type="button"
              class="sidebar-link"
              data-action="navigate-page"
              data-page="notes"
              aria-label="Notes"
              title="Notes"
            >
              <span class="sidebar-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg></span>
              <span class="sidebar-label">Notes</span>
            </button>
          </div>

          <div class="sidebar-section">
            <p class="sidebar-heading">Reference Library</p>
            <button
              type="button"
              class="sidebar-link"
              data-action="navigate-page"
              data-page="formulas"
              aria-label="Formula Book"
              title="Formula Book"
            >
              <span class="sidebar-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 7V4H6l6 8-6 8h12v-3"/></svg></span>
              <span class="sidebar-label">Formula Book</span>
            </button>
            <button
              type="button"
              class="sidebar-link"
              data-action="navigate-page"
              data-page="symbols"
              aria-label="Symbols"
              title="Symbols"
            >
              <span class="sidebar-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="9" x2="9" y1="4" y2="20"/><path d="M4 7c0-1.7 1.3-3 3-3h13"/><path d="M18 20c-1.7 0-3-1.3-3-3V4"/></svg></span>
              <span class="sidebar-label">Symbols</span>
            </button>
            <button
              type="button"
              class="sidebar-link"
              data-action="navigate-page"
              data-page="definitions"
              aria-label="Definitions"
              title="Definitions"
            >
              <span class="sidebar-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></span>
              <span class="sidebar-label">Definitions</span>
            </button>
          </div>

          <div class="sidebar-section">
            <p class="sidebar-heading">Settings</p>
            <button
              type="button"
              class="sidebar-link"
              data-action="open-settings"
              aria-label="Settings"
              title="Settings"
            >
              <span class="sidebar-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg></span>
              <span class="sidebar-label">Settings</span>
            </button>
          </div>

          <!-- History Section Built-in Under Left Sidebar -->
          <div class="sidebar-section sidebar-history">
            <p class="sidebar-heading">History</p>
            <div class="sidebar-history-scroll">
              <ol class="history-list" id="history-list" style="padding: 0; list-style: none;"></ol>
            </div>
          </div>

        </aside>

        <!-- MAIN CONTENT -->

        <main class="main-content">

          <!-- CALCULATOR PAGE -->

          <section
            class="page-view"
            id="calculator-view"
          >

            <div class="calculator-workspace">

              ${calculatorCardHtml()}

              <aside class="solution-panel card" aria-labelledby="solution-title">
                <header class="solution-header">
                  <p class="eyebrow">Calculation steps</p>
                  <h2 id="solution-title">How it’s solved</h2>
                </header>
                <p class="solution-empty" id="solution-empty">Complete a calculation to see clear, step-by-step working here.</p>
                <pre class="solution-steps" id="solution-steps" aria-live="polite" hidden></pre>
              </aside>

              <div id="mode-panel" hidden></div>

            </div>

          </section>

          <!-- HISTORY PAGE -->

          <section
            class="page-view"
            id="history-view"
            hidden
          >

            <div class="reference-card">
              <div class="card-header">
                <div>
                  <h2>Calculation History</h2>
                </div>
                <button
                  type="button"
                  class="text-button"
                  id="clear-history"
                  data-action="confirm-clear-history"
                >Clear all</button>
              </div>
            </div>

          </section>

          <!-- NOTES PAGE -->

          <section
            class="page-view"
            id="notes-view"
            hidden
          >
            <div class="reference-card">
              <header class="page-heading">
                <p class="eyebrow">Workspace</p>
                <h2>Notes</h2>
                <p>Write lessons, formulas and worked solutions. Notes are saved in this browser.</p>
              </header>

              <form class="notes-editor" id="notes-form" novalidate>
                <div class="notes-toolbar">
                  <label class="form-field">
                    <span>Subject</span>
                    <select id="notes-subject">
                      <option>Mathematics</option>
                      <option>Physics</option>
                      <option>Chemistry</option>
                      <option>General</option>
                    </select>
                  </label>
                  <label class="form-field">
                    <span>Title</span>
                    <input id="notes-title" type="text" maxlength="120" placeholder="e.g. Kinematics equations" autocomplete="off" />
                  </label>
                </div>

                <label class="notes-editor-label">
                  <span>Content</span>
                  <textarea id="notes-content" placeholder="Write your note here…"></textarea>
                </label>

                <p class="form-error" id="notes-error" role="alert"></p>

                <div class="notes-actions">
                  <button type="submit" class="button button--primary">Save note</button>
                  <button type="button" class="button" data-action="insert-result-note">Insert last calculation</button>
                  <button type="button" class="button" data-action="clear-note">Clear</button>
                </div>
              </form>

              <div class="notes-library">
                <div class="notes-library-header">
                  <h3>Saved notes <span class="notes-count" id="notes-count"></span></h3>
                  <div class="notes-filters">
                    <select id="notes-filter" aria-label="Filter notes by subject">
                      <option value="All">All subjects</option>
                      <option>Mathematics</option>
                      <option>Physics</option>
                      <option>Chemistry</option>
                      <option>General</option>
                    </select>
                    <input id="notes-search" type="search" placeholder="Search notes" aria-label="Search notes" />
                  </div>
                </div>
                <div id="notes-list"></div>
              </div>
            </div>
          </section>

          <!-- FORMULA BOOK -->

          <section
            class="page-view"
            id="formulas-view"
            hidden
          >
            <div class="reference-card">
              <header class="page-heading">
                <p class="eyebrow">Reference Library</p>
                <h2>Formula Book</h2>
                <p>Key formulas for mathematics, physics and chemistry with variable meanings, SI units and worked examples.</p>
              </header>
              ${referenceToolbarHtml('formulas', 'Search formulas, e.g. "energy" or "pH"')}
            </div>
          </section>

          <!-- SYMBOLS -->

          <section
            class="page-view"
            id="symbols-view"
            hidden
          >
            <div class="reference-card">
              <header class="page-heading">
                <p class="eyebrow">Reference Library</p>
                <h2>Scientific Symbols</h2>
                <p>What each symbol means, its unit or value, and how it is used.</p>
              </header>
              ${referenceToolbarHtml('symbols', 'Search symbols, e.g. "λ" or "current"')}
            </div>
          </section>

          <!-- DEFINITIONS -->

          <section
            class="page-view"
            id="definitions-view"
            hidden
          >
            <div class="reference-card">
              <header class="page-heading">
                <p class="eyebrow">Reference Library</p>
                <h2>Scientific Definitions</h2>
                <p>Clear definitions of essential terms with details and examples.</p>
              </header>
              ${referenceToolbarHtml('definitions', 'Search definitions, e.g. "mole" or "inertia"')}
            </div>
          </section>

          <!-- APPEARANCE -->

          <section
            class="page-view"
            id="appearance-view"
            hidden
          ></section>

        </main>

        <!-- RIGHT GRAPH SIDEBAR -->

        <button
          type="button"
          class="graph-tab"
          data-action="toggle-graph"
          aria-label="Open graph sidebar"
          title="Open graph"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 16c.5-2 1.5-7 4-7 2 0 2 3 4 3 2.5 0 4.5-5 5-7"/></svg>
        </button>
        <aside
          class="graph-drawer"
          id="graph-drawer"
          aria-label="Graphing sidebar"
          aria-hidden="false"
        >

          <div class="graph-drawer-header">

            <button
              type="button"
              class="icon-button sidebar-toggle"
              data-action="toggle-graph"
              aria-label="Toggle graph sidebar"
            >
              <!-- Gemini-style Panel Toggle Icon for Right Sidebar -->
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
                <line x1="15" y1="3" x2="15" y2="21"></line>
              </svg>
            </button>

          </div>

          <div id="graph-view">
            ${graphWorkspaceHtml()}
          </div>

        </aside>

      </div>

      <!-- SETTINGS DIALOG -->

      <dialog
        class="settings-dialog"
        id="settings-dialog"
        aria-labelledby="settings-title"
      >

        <form class="settings-form" id="settings-form">

          <div class="settings-header">
            <h2 class="dialog-title" id="settings-title">Settings</h2>
            <button type="button" class="icon-button" data-action="close-settings" aria-label="Close settings">×</button>
          </div>

          <div class="settings-tabs" role="tablist">
            <button type="button" class="settings-tab is-active" role="tab" aria-selected="true" data-action="settings-tab" data-tab="appearance">Appearance</button>
            <button type="button" class="settings-tab" role="tab" aria-selected="false" data-action="settings-tab" data-tab="general">General</button>
          </div>

          <div class="settings-panel" data-panel="appearance">

            <p class="settings-section-title">Theme</p>
            <div class="theme-presets">
              ${THEME_PRESETS.map(({ id, label, colors }) => `
                <button type="button" class="theme-preset" data-theme="${id}" aria-pressed="false">
                  <span class="theme-swatch" style="background:${colors.bg}">
                    <span style="background:${colors.surface}"></span>
                    <span style="background:${colors.accent}"></span>
                  </span>
                  <span class="theme-name">${label}</span>
                </button>`).join('')}
            </div>

            <p class="settings-section-title">Custom colors</p>
            <div class="theme-colors">
              ${CUSTOM_COLOR_FIELDS.map(({ key, label }) => `
                <label class="color-field">
                  <input type="color" id="theme-${key}" />
                  <span>${label}</span>
                </label>`).join('')}
            </div>

            <p class="settings-section-title">Calculator display</p>
            <div class="segmented" role="radiogroup" aria-label="Calculator display color">
              <button type="button" class="segment" data-lcd="green">Green</button>
              <button type="button" class="segment" data-lcd="blue">Blue</button>
              <button type="button" class="segment" data-lcd="amber">Amber</button>
              <button type="button" class="segment" data-lcd="mono">Mono</button>
            </div>

            <p class="settings-section-title">Text size</p>
            <div class="segmented" role="radiogroup" aria-label="Text size">
              <button type="button" class="segment" data-font-scale="small">Small</button>
              <button type="button" class="segment" data-font-scale="normal">Normal</button>
              <button type="button" class="segment" data-font-scale="large">Large</button>
            </div>

            <label class="toggle-field">
              <input type="checkbox" id="appearance-motion" />
              <span>Reduce animations</span>
            </label>

            <button type="button" class="text-button" data-action="reset-theme">Reset appearance to default</button>
          </div>

          <div class="settings-panel" data-panel="general" hidden>

            <label class="form-field">
              <span>Significant digits in results</span>
              <select id="settings-precision">
                <option value="6">6</option>
                <option value="9">9</option>
                <option value="12">12</option>
                <option value="15">15</option>
              </select>
            </label>

            <p class="settings-note">
              Calculation steps are generated locally from the expression. No AI service or internet connection is needed.
            </p>

          </div>

          <div class="dialog-actions">
            <button type="button" class="button" data-action="close-settings">Close</button>
            <button type="submit" class="button button--primary">Save</button>
          </div>

        </form>

      </dialog>

      <!-- CLEAR HISTORY DIALOG -->

      <dialog
        class="confirm-dialog"
        id="clear-dialog"
        aria-labelledby="clear-dialog-title"
      >

        <h2 class="dialog-title" id="clear-dialog-title">
          Clear all history?
        </h2>

        <p class="dialog-text" id="clear-dialog-text"></p>

        <div class="dialog-actions">

          <button
            type="button"
            class="button"
            data-action="cancel-clear"
          >Cancel</button>

          <button
            type="button"
            class="button button--danger"
            data-action="confirm-clear"
          >Clear all</button>

        </div>

      </dialog>

      <!-- CALCULATION MODE DIALOG -->

      <dialog
        class="mode-dialog"
        id="mode-dialog"
        aria-labelledby="mode-dialog-title"
      >

        <div class="mode-dialog-head">
          <div>
            <h2 class="dialog-title" id="mode-dialog-title">Calculation Mode</h2>
            <p class="mode-dialog-sub">Casio fx-991ES PLUS / WideMath modes. Select a mode or press 1–8.</p>
          </div>
          <button
            type="button"
            class="icon-button"
            data-mode-action="close-mode-dialog"
            aria-label="Close calculation modes"
          >×</button>
        </div>

        <div class="mode-dialog-grid" id="mode-dialog-grid"></div>

      </dialog>

    </div>
  `;
}
