// Renders the Formula Book, Symbols and Definitions pages with subject filters and search.
import { FORMULAS } from '../reference/formulas.js';
import { SYMBOLS } from '../reference/symbols.js';
import { DEFINITIONS } from '../reference/definitions.js';
import { escapeHtml } from './render.js';

const SUBJECTS = ['All', 'Mathematics', 'Physics', 'Chemistry'];

const SUBJECT_CLASS = {
  Mathematics: 'math',
  Physics: 'physics',
  Chemistry: 'chemistry',
};

function variablesHtml(variables = []) {
  if (variables.length === 0) return '';
  return `
    <dl class="ref-variables">
      ${variables.map(([symbol, meaning, unit]) => `
        <div class="ref-variable">
          <dt>${escapeHtml(symbol)}</dt>
          <dd>${escapeHtml(meaning)}${unit ? ` <span class="ref-unit">[${escapeHtml(unit)}]</span>` : ''}</dd>
        </div>`).join('')}
    </dl>`;
}

const exampleHtml = (example) => (example
  ? `<p class="ref-example"><span>Example</span>${escapeHtml(example)}</p>`
  : '');

const badgeHtml = (item) => `
  <div class="ref-badges">
    <span class="ref-badge ref-badge--${SUBJECT_CLASS[item.subject]}">${escapeHtml(item.subject)}</span>
    <span class="ref-topic">${escapeHtml(item.topic)}</span>
  </div>`;

const RENDERERS = {
  formulas: {
    items: FORMULAS,
    searchText: (item) => [item.name, item.formula, item.description, item.topic, ...(item.variables ?? []).flat()].join(' '),
    card: (item) => `
      <article class="ref-card ref-card--${SUBJECT_CLASS[item.subject]}">
        ${badgeHtml(item)}
        <h3>${escapeHtml(item.name)}</h3>
        <p class="ref-formula">${escapeHtml(item.formula)}</p>
        <p class="ref-description">${escapeHtml(item.description)}</p>
        ${variablesHtml(item.variables)}
        ${exampleHtml(item.example)}
      </article>`,
  },
  symbols: {
    items: SYMBOLS,
    searchText: (item) => [item.symbol, item.name, item.meaning, item.unit, item.topic].join(' '),
    card: (item) => `
      <article class="ref-card ref-card--symbol ref-card--${SUBJECT_CLASS[item.subject]}">
        <div class="ref-symbol" aria-hidden="true">${escapeHtml(item.symbol)}</div>
        <div class="ref-symbol-body">
          ${badgeHtml(item)}
          <h3>${escapeHtml(item.name)} <span class="sr-only">(${escapeHtml(item.symbol)})</span></h3>
          <p class="ref-description">${escapeHtml(item.meaning)}</p>
          ${item.unit ? `<p class="ref-meta"><span>Unit / value</span>${escapeHtml(item.unit)}</p>` : ''}
          ${exampleHtml(item.example)}
        </div>
      </article>`,
  },
  definitions: {
    items: DEFINITIONS,
    searchText: (item) => [item.term, item.definition, item.details, item.example, item.topic].join(' '),
    card: (item) => `
      <article class="ref-card ref-card--${SUBJECT_CLASS[item.subject]}">
        ${badgeHtml(item)}
        <h3>${escapeHtml(item.term)}</h3>
        <p class="ref-definition">${escapeHtml(item.definition)}</p>
        ${item.details ? `<p class="ref-description">${escapeHtml(item.details)}</p>` : ''}
        ${exampleHtml(item.example)}
      </article>`,
  },
};

export function referenceToolbarHtml(kind, placeholder) {
  return `
    <div class="ref-toolbar">
      <div class="ref-filters" role="group" aria-label="Filter by subject">
        ${SUBJECTS.map((subject) => `
          <button
            type="button"
            class="ref-filter${subject === 'All' ? ' is-active' : ''}"
            data-ref-kind="${kind}"
            data-ref-subject="${subject}"
            aria-pressed="${subject === 'All'}"
          >${subject}</button>`).join('')}
      </div>
      <input
        type="search"
        class="ref-search"
        data-ref-kind="${kind}"
        placeholder="${escapeHtml(placeholder)}"
        aria-label="${escapeHtml(placeholder)}"
      />
    </div>
    <p class="ref-count" id="${kind}-count"></p>
    <div class="ref-results" id="${kind}-results"></div>`;
}

export function mountReferenceViews(root) {
  const state = {
    formulas: { subject: 'All', query: '' },
    symbols: { subject: 'All', query: '' },
    definitions: { subject: 'All', query: '' },
  };

  function render(kind) {
    const { items, searchText, card } = RENDERERS[kind];
    const { subject, query } = state[kind];
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

    const matches = items.filter((item) => {
      if (subject !== 'All' && item.subject !== subject) return false;
      if (terms.length === 0) return true;
      const text = searchText(item).toLowerCase();
      return terms.every((term) => text.includes(term));
    });

    const groups = new Map();
    for (const item of matches) {
      const key = subject === 'All' ? `${item.subject} · ${item.topic}` : item.topic;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }

    root.querySelector(`#${kind}-count`).textContent =
      `${matches.length} ${matches.length === 1 ? 'entry' : 'entries'}`;

    root.querySelector(`#${kind}-results`).innerHTML = matches.length === 0
      ? '<p class="empty-state">No matches. Try another search term or subject.</p>'
      : [...groups].map(([title, groupItems]) => `
          <section class="ref-group">
            <h3 class="ref-group-title">${escapeHtml(title)}</h3>
            <div class="ref-grid">${groupItems.map(card).join('')}</div>
          </section>`).join('');
  }

  root.addEventListener('click', (event) => {
    const button = event.target.closest('.ref-filter');
    if (!button) return;
    const kind = button.dataset.refKind;
    state[kind].subject = button.dataset.refSubject;
    for (const sibling of root.querySelectorAll(`.ref-filter[data-ref-kind="${kind}"]`)) {
      const active = sibling === button;
      sibling.classList.toggle('is-active', active);
      sibling.setAttribute('aria-pressed', String(active));
    }
    render(kind);
  });

  root.addEventListener('input', (event) => {
    const input = event.target.closest('.ref-search');
    if (!input) return;
    state[input.dataset.refKind].query = input.value.trim();
    render(input.dataset.refKind);
  });

  Object.keys(RENDERERS).forEach(render);
}
