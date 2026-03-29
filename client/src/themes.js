// Each theme defines the full set of CSS variables
// Users can also override individual colors via the editor

const THEMES = {
  // === DARK THEMES ===
  dark: {
    label: 'Default Dark',
    group: 'Dark',
    vars: {
      '--accent': '#06b6d4',
      '--bg-primary': '#0f172a',
      '--bg-secondary': '#1e293b',
      '--bg-card': '#1e293b',
      '--border': '#334155',
      '--text-primary': '#f1f5f9',
      '--text-secondary': '#94a3b8',
    }
  },
  nord: {
    label: 'Nord',
    group: 'Dark',
    vars: {
      '--accent': '#88c0d0',
      '--bg-primary': '#2e3440',
      '--bg-secondary': '#3b4252',
      '--bg-card': '#3b4252',
      '--border': '#4c566a',
      '--text-primary': '#eceff4',
      '--text-secondary': '#d8dee9',
    }
  },
  dracula: {
    label: 'Dracula',
    group: 'Dark',
    vars: {
      '--accent': '#bd93f9',
      '--bg-primary': '#282a36',
      '--bg-secondary': '#343746',
      '--bg-card': '#343746',
      '--border': '#44475a',
      '--text-primary': '#f8f8f2',
      '--text-secondary': '#6272a4',
    }
  },
  tokyoNight: {
    label: 'Tokyo Night',
    group: 'Dark',
    vars: {
      '--accent': '#7aa2f7',
      '--bg-primary': '#1a1b26',
      '--bg-secondary': '#24283b',
      '--bg-card': '#24283b',
      '--border': '#3b4261',
      '--text-primary': '#c0caf5',
      '--text-secondary': '#565f89',
    }
  },
  catppuccin: {
    label: 'Catppuccin Mocha',
    group: 'Dark',
    vars: {
      '--accent': '#cba6f7',
      '--bg-primary': '#1e1e2e',
      '--bg-secondary': '#313244',
      '--bg-card': '#313244',
      '--border': '#45475a',
      '--text-primary': '#cdd6f4',
      '--text-secondary': '#a6adc8',
    }
  },
  gruvbox: {
    label: 'Gruvbox Dark',
    group: 'Dark',
    vars: {
      '--accent': '#fabd2f',
      '--bg-primary': '#282828',
      '--bg-secondary': '#3c3836',
      '--bg-card': '#3c3836',
      '--border': '#504945',
      '--text-primary': '#ebdbb2',
      '--text-secondary': '#a89984',
    }
  },
  synthwave: {
    label: 'Synthwave',
    group: 'Dark',
    vars: {
      '--accent': '#ff7edb',
      '--bg-primary': '#2b213a',
      '--bg-secondary': '#382c4a',
      '--bg-card': '#382c4a',
      '--border': '#4a3d5c',
      '--text-primary': '#f0e6ff',
      '--text-secondary': '#9d8bba',
    }
  },
  midnight: {
    label: 'Midnight',
    group: 'Dark',
    vars: {
      '--accent': '#60a5fa',
      '--bg-primary': '#0a0a0f',
      '--bg-secondary': '#12121a',
      '--bg-card': '#12121a',
      '--border': '#1e1e2a',
      '--text-primary': '#e2e8f0',
      '--text-secondary': '#64748b',
    }
  },

  // === LIGHT THEMES ===
  light: {
    label: 'Default Light',
    group: 'Light',
    vars: {
      '--accent': '#0891b2',
      '--bg-primary': '#f8fafc',
      '--bg-secondary': '#ffffff',
      '--bg-card': '#ffffff',
      '--border': '#e2e8f0',
      '--text-primary': '#0f172a',
      '--text-secondary': '#64748b',
    }
  },
  paper: {
    label: 'Paper',
    group: 'Light',
    vars: {
      '--accent': '#d97706',
      '--bg-primary': '#faf9f6',
      '--bg-secondary': '#ffffff',
      '--bg-card': '#ffffff',
      '--border': '#e7e5e4',
      '--text-primary': '#292524',
      '--text-secondary': '#78716c',
    }
  },
  github: {
    label: 'GitHub Light',
    group: 'Light',
    vars: {
      '--accent': '#0969da',
      '--bg-primary': '#f6f8fa',
      '--bg-secondary': '#ffffff',
      '--bg-card': '#ffffff',
      '--border': '#d0d7de',
      '--text-primary': '#1f2328',
      '--text-secondary': '#656d76',
    }
  },
  solarizedLight: {
    label: 'Solarized Light',
    group: 'Light',
    vars: {
      '--accent': '#268bd2',
      '--bg-primary': '#fdf6e3',
      '--bg-secondary': '#eee8d5',
      '--bg-card': '#eee8d5',
      '--border': '#d6cdb7',
      '--text-primary': '#073642',
      '--text-secondary': '#586e75',
    }
  },

  // === SPECIAL ===
  retro: {
    label: 'Retro Terminal',
    group: 'Special',
    vars: {
      '--accent': '#33ff33',
      '--bg-primary': '#0a0a0a',
      '--bg-secondary': '#141414',
      '--bg-card': '#141414',
      '--border': '#2a2a2a',
      '--text-primary': '#33ff33',
      '--text-secondary': '#1a991a',
    }
  },
  highContrast: {
    label: 'High Contrast',
    group: 'Special',
    vars: {
      '--accent': '#ffff00',
      '--bg-primary': '#000000',
      '--bg-secondary': '#0a0a0a',
      '--bg-card': '#0a0a0a',
      '--border': '#333333',
      '--text-primary': '#ffffff',
      '--text-secondary': '#cccccc',
    }
  },
};

// Apply a theme to the document
function applyTheme(themeId, customOverrides = {}) {
  const theme = THEMES[themeId];
  if (!theme) return;

  const root = document.documentElement;

  // Apply all CSS variables from theme (inline styles override stylesheet)
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }

  // Apply custom overrides on top
  for (const [key, value] of Object.entries(customOverrides)) {
    if (value) root.style.setProperty(key, value);
  }
}

// Get list of theme groups for rendering
function getThemeGroups() {
  const groups = {};
  for (const [id, theme] of Object.entries(THEMES)) {
    if (!groups[theme.group]) groups[theme.group] = [];
    groups[theme.group].push({ id, ...theme });
  }
  return groups;
}

export { THEMES, applyTheme, getThemeGroups };
