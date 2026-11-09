// Persists calculation history in localStorage. Stored data is untrusted: anything malformed is dropped.
export const HISTORY_LIMIT = 50;

const STORAGE_KEY = 'ai-scientific-calculator.history';
const MAX_EXPRESSION_LENGTH = 2000;
const MAX_DISPLAY_LENGTH = 200;
const MAX_TIMESTAMP_MS = 8.64e15;

function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isValidEntry(entry) {
  return (
    entry !== null &&
    typeof entry === 'object' &&
    typeof entry.id === 'string' &&
    entry.id.length > 0 &&
    typeof entry.expression === 'string' &&
    entry.expression.length > 0 &&
    entry.expression.length <= MAX_EXPRESSION_LENGTH &&
    typeof entry.display === 'string' &&
    entry.display.length > 0 &&
    entry.display.length <= MAX_DISPLAY_LENGTH &&
    Number.isFinite(entry.timestamp) &&
    Math.abs(entry.timestamp) <= MAX_TIMESTAMP_MS
  );
}

export function createHistoryEntry({ expression, display }) {
  const timestamp = Date.now();
  return {
    id: `${timestamp}-${Math.random().toString(36).slice(2, 10)}`,
    expression,
    display,
    timestamp,
  };
}

export function loadHistory() {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidEntry)
      .slice(0, HISTORY_LIMIT)
      .map(({ id, expression, display, timestamp }) => ({ id, expression, display, timestamp }));
  } catch {
    return [];
  }
}

export function saveHistory(history) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Storage is full or blocked; the calculator keeps working with in-memory history.
  }
}
