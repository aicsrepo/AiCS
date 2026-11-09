// AiCS theme manager.
// Handles preset themes, custom colors, persistence,
// and restoration when the application is reopened.

const STORAGE_KEY = 'aether-theme-v1';

const DEFAULT_THEME = 'midnight';

const COLOR_VARIABLES = {
  bg: '--bg',
  surface: '--surface',
  raised: '--surface-raised',
  display: '--display-bg',
  text: '--text',
  accent: '--blue-400',
  border: '--border',
};

const THEMES = {
  midnight: {
    bg: '#16181d',
    surface: '#1f2229',
    raised: '#272b34',
    display: '#121419',
    text: '#e7e9ee',
    accent: '#60a5fa',
    border: '#323743',
    muted: '#9aa3b2',
    accentSoft: '#93c5fd',
    scheme: 'dark',
  },

  light: {
    bg: '#f2f4f8',
    surface: '#ffffff',
    raised: '#e9edf3',
    display: '#f8fafc',
    text: '#202938',
    accent: '#2563eb',
    border: '#d8dee8',
    muted: '#687386',
    accentSoft: '#60a5fa',
    scheme: 'light',
  },

  ocean: {
    bg: '#101c29',
    surface: '#172838',
    raised: '#20394d',
    display: '#0c1722',
    text: '#e1f1fa',
    accent: '#38bdf8',
    border: '#2b465b',
    muted: '#91aebe',
    accentSoft: '#7dd3fc',
    scheme: 'dark',
  },

  forest: {
    bg: '#151e19',
    surface: '#202d25',
    raised: '#2b3b30',
    display: '#101813',
    text: '#e5eee7',
    accent: '#4ade80',
    border: '#35483b',
    muted: '#a0b2a5',
    accentSoft: '#86efac',
    scheme: 'dark',
  },

  violet: {
    bg: '#1c1827',
    surface: '#282236',
    raised: '#352c47',
    display: '#15111f',
    text: '#eee8fa',
    accent: '#a78bfa',
    border: '#443956',
    muted: '#b0a5c4',
    accentSoft: '#c4b5fd',
    scheme: 'dark',
  },

  amber: {
    bg: '#211c16',
    surface: '#30271d',
    raised: '#403326',
    display: '#19140f',
    text: '#f4eadb',
    accent: '#f59e0b',
    border: '#51402d',
    muted: '#b9a68d',
    accentSoft: '#fcd34d',
    scheme: 'dark',
  },
};


const PRESET_LABELS = {
  midnight: 'Midnight',
  light: 'Light',
  ocean: 'Ocean',
  forest: 'Forest',
  violet: 'Violet',
  amber: 'Amber',
};

export const THEME_PRESETS = Object.entries(THEMES).map(([id, colors]) => ({
  id,
  label: PRESET_LABELS[id] ?? id,
  colors,
}));

export const CUSTOM_COLOR_FIELDS = [
  { key: 'bg', label: 'Background' },
  { key: 'surface', label: 'Panels' },
  { key: 'raised', label: 'Raised' },
  { key: 'display', label: 'Inputs' },
  { key: 'text', label: 'Text' },
  { key: 'accent', label: 'Accent' },
  { key: 'border', label: 'Borders' },
];

const PREFS_KEY = 'aether-appearance-v1';

const DEFAULT_PREFS = { lcd: 'green', fontScale: 'normal', reduceMotion: false };

const LCD_VALUES = ['green', 'blue', 'amber', 'mono'];
const FONT_SCALES = { small: '15px', normal: '16px', large: '18px' };

function readPrefs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    return {
      lcd: LCD_VALUES.includes(parsed.lcd) ? parsed.lcd : DEFAULT_PREFS.lcd,
      fontScale: Object.hasOwn(FONT_SCALES, parsed.fontScale) ? parsed.fontScale : DEFAULT_PREFS.fontScale,
      reduceMotion: parsed.reduceMotion === true,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function isLightColor(hex) {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

function isValidColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value);
}


function normalizeCustomColors(colors) {
  const normalized = {};

  for (const [key, variable] of Object.entries(COLOR_VARIABLES)) {
    const value = colors?.[key];

    if (!isValidColor(value)) {
      return null;
    }

    normalized[key] = value;
  }

  return normalized;
}


function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) return null;

    const parsed = JSON.parse(stored);

    if (
      parsed?.mode === 'preset' &&
      THEMES[parsed.theme]
    ) {
      return parsed;
    }

    if (parsed?.mode === 'custom') {
      const colors = normalizeCustomColors(parsed.colors);

      if (colors) {
        return {
          mode: 'custom',
          colors,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}


function saveTheme(theme) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(theme)
    );
  } catch (error) {
    console.error('Could not save theme:', error);
  }
}


export function initTheme(root) {
  let currentTheme = readStoredTheme() ?? {
    mode: 'preset',
    theme: DEFAULT_THEME,
  };


  // ---------------------------------------
  // APPLY COLORS
  // ---------------------------------------

  function applyColors(colors, scheme = 'dark') {
    const rootElement = document.documentElement;

    rootElement.style.colorScheme = scheme;
    rootElement.dataset.scheme = scheme;

    rootElement.dataset.theme =
      currentTheme.mode === 'preset'
        ? currentTheme.theme
        : 'custom';

    for (const [key, variable] of Object.entries(COLOR_VARIABLES)) {
      rootElement.style.setProperty(
        variable,
        colors[key]
      );
    }

    rootElement.style.setProperty(
      '--text-muted',
      colors.muted ?? '#9aa3b2'
    );

    rootElement.style.setProperty(
      '--blue-300',
      colors.accentSoft ?? colors.accent
    );

    rootElement.style.setProperty(
      '--blue-400',
      colors.accent
    );

    rootElement.style.setProperty(
      '--accent',
      colors.accent
    );

    rootElement.style.setProperty(
      '--accent-soft',
      colors.accentSoft ?? colors.accent
    );

    rootElement.style.setProperty(
      '--accent-rgb',
      hexToRgb(colors.accent)
    );

    updatePresetButtons();
    updateColorInputs(colors);
  }


  function hexToRgb(hex) {
    const value = hex.replace('#', '');

    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);

    return `${red}, ${green}, ${blue}`;
  }


  // ---------------------------------------
  // PRESET BUTTON STATES
  // ---------------------------------------

  function updatePresetButtons() {
    const buttons = root.querySelectorAll(
      '.theme-preset[data-theme]'
    );

    buttons.forEach((button) => {
      const selected =
        currentTheme.mode === 'preset' &&
        button.dataset.theme === currentTheme.theme;

      button.classList.toggle(
        'is-active',
        selected
      );

      button.setAttribute(
        'aria-pressed',
        String(selected)
      );
    });
  }


  // ---------------------------------------
  // COLOR INPUTS
  // ---------------------------------------

  function updateColorInputs(colors) {
    for (const [key, inputKey] of Object.entries(COLOR_VARIABLES)) {
      const input = root.querySelector(`#theme-${key}`);

      if (input) {
        input.value = colors[key];
      }
    }
  }


  // ---------------------------------------
  // PRESET SELECTION
  // ---------------------------------------

  function setPreset(name) {
    const colors = THEMES[name];

    if (!colors) return;

    currentTheme = {
      mode: 'preset',
      theme: name,
    };

    applyColors(colors, colors.scheme);

    saveTheme(currentTheme);
  }


  // ---------------------------------------
  // CUSTOM COLOR EDITING
  // ---------------------------------------

  function setCustomColor(key, value) {
    if (!COLOR_VARIABLES[key] || !isValidColor(value)) {
      return;
    }

    const currentColors =
      currentTheme.mode === 'custom'
        ? { ...currentTheme.colors }
        : { ...THEMES[currentTheme.theme] };

    currentColors[key] = value;

    currentTheme = {
      mode: 'custom',
      colors: normalizeCustomColors(currentColors),
    };

    const scheme = isLightColor(currentTheme.colors.bg) ? 'light' : 'dark';

    applyColors(
      {
        ...currentColors,
        muted: currentColors.muted ?? '#9aa3b2',
        accentSoft: currentColors.accent,
      },
      scheme
    );

    saveTheme(currentTheme);
  }


  // ---------------------------------------
  // RESET
  // ---------------------------------------

  // ---------------------------------------
  // EXTRA APPEARANCE PREFERENCES
  // ---------------------------------------

  let prefs = readPrefs();

  function applyPrefs() {
    const rootElement = document.documentElement;

    rootElement.dataset.lcd = prefs.lcd;
    rootElement.dataset.reduceMotion = String(prefs.reduceMotion);
    rootElement.style.fontSize = FONT_SCALES[prefs.fontScale];

    root.querySelectorAll('[data-lcd]').forEach((button) => {
      const selected = button.dataset.lcd === prefs.lcd;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });

    root.querySelectorAll('[data-font-scale]').forEach((button) => {
      const selected = button.dataset.fontScale === prefs.fontScale;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });

    const motion = root.querySelector('#appearance-motion');
    if (motion) motion.checked = prefs.reduceMotion;
  }

  function setPrefs(patch) {
    prefs = { ...prefs, ...patch };
    applyPrefs();
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (error) {
      console.error('Could not save appearance:', error);
    }
  }

  function reset() {
    setPreset(DEFAULT_THEME);
    setPrefs({ ...DEFAULT_PREFS });
  }


  // ---------------------------------------
  // EVENT LISTENERS
  // ---------------------------------------

  root.addEventListener('click', (event) => {
    const button = event.target.closest(
      '.theme-preset[data-theme]'
    );

    if (!button || !root.contains(button)) return;

    setPreset(button.dataset.theme);
  });

  root.addEventListener('click', (event) => {
    const lcd = event.target.closest('[data-lcd]');
    if (lcd && LCD_VALUES.includes(lcd.dataset.lcd)) setPrefs({ lcd: lcd.dataset.lcd });

    const scale = event.target.closest('[data-font-scale]');
    if (scale && Object.hasOwn(FONT_SCALES, scale.dataset.fontScale)) setPrefs({ fontScale: scale.dataset.fontScale });
  });

  root.addEventListener('change', (event) => {
    if (event.target.id === 'appearance-motion') setPrefs({ reduceMotion: event.target.checked });
  });


  root.addEventListener('input', (event) => {
    const input = event.target;

    if (!(input instanceof HTMLInputElement)) return;

    if (input.type !== 'color') return;

    const key = Object.keys(COLOR_VARIABLES).find(
      (name) => input.id === `theme-${name}`
    );

    if (!key) return;

    setCustomColor(key, input.value);
  });


  // ---------------------------------------
  // RESTORE SAVED THEME
  // ---------------------------------------

  if (currentTheme.mode === 'preset') {
    const colors = THEMES[currentTheme.theme];

    applyColors(colors, colors.scheme);
  } else {
    applyColors(
      {
        ...currentTheme.colors,
        muted: '#9aa3b2',
        accentSoft: currentTheme.colors.accent,
      },
      isLightColor(currentTheme.colors.bg) ? 'light' : 'dark'
    );
  }

  applyPrefs();


  return {
    reset,
    setPreset,
  };
}