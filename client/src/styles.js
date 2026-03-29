// Visual styles -- stackable layers independent from color themes
// Users can enable multiple: e.g. Glass + Wide + Compact
// Each style only sets the CSS it needs, so they compose cleanly

const STYLES = {
  glass: {
    label: 'Glass',
    description: 'Frosted translucent cards with depth',
    group: 'Card Style',
    css: `
      .react-grid-item > div > div:first-child {
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
        background-color: color-mix(in srgb, var(--bg-card) 55%, transparent) !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05) !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
      }
      nav {
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        background-color: color-mix(in srgb, var(--bg-secondary) 60%, transparent) !important;
        border-bottom: 1px solid rgba(255,255,255,0.06) !important;
      }
      .react-grid-item > div > div:first-child > div {
        background-color: transparent !important;
      }
      .react-grid-item > div > div:first-child .widget-drag-handle {
        background-color: transparent !important;
        border-color: rgba(255,255,255,0.06) !important;
      }
      .react-grid-item > div > div:first-child input,
      .react-grid-item > div > div:first-child textarea,
      .react-grid-item > div > div:first-child select {
        background-color: color-mix(in srgb, var(--bg-primary) 40%, transparent) !important;
        backdrop-filter: blur(8px) !important;
        -webkit-backdrop-filter: blur(8px) !important;
      }
    `
  },
  minimal: {
    label: 'Minimal',
    description: 'Borderless cards, clean and quiet',
    group: 'Card Style',
    css: `
      .react-grid-item > div > div:first-child {
        border: none !important;
        box-shadow: none !important;
      }
      nav { border-bottom: none !important; box-shadow: 0 1px 0 var(--border) !important; }
    `
  },
  brutalist: {
    label: 'Brutalist',
    description: 'Thick borders, hard shadows, raw blocks',
    group: 'Card Style',
    css: `
      * { border-radius: 0 !important; }
      body { font-family: 'Arial Black', 'Helvetica Neue', Arial, sans-serif !important; }
      .react-grid-item > div > div:first-child {
        border-width: 2px !important;
        box-shadow: 4px 4px 0 var(--border) !important;
      }
      button, a { text-transform: uppercase; letter-spacing: 0.5px; }
      input, textarea, select, button { font-family: inherit !important; }
    `
  },
  rounded: {
    label: 'Rounded',
    description: 'Extra-round corners, soft and bubbly',
    group: 'Card Style',
    css: `
      .react-grid-item > div > div:first-child {
        border-radius: 1.25rem !important;
      }
      input, textarea, select, button { border-radius: 0.75rem !important; }
      nav { border-radius: 0 !important; }
    `
  },
  retro: {
    label: 'Retro CRT',
    description: 'Scanlines, monospace, phosphor glow',
    group: 'Effects',
    css: `
      body { font-family: 'Courier New', 'Lucida Console', monospace !important; }
      body::after {
        content: '';
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 9999;
        background: repeating-linear-gradient(
          0deg,
          rgba(0,0,0,0.12) 0px,
          rgba(0,0,0,0.12) 1px,
          transparent 1px,
          transparent 3px
        );
      }
      .react-grid-item > div > div:first-child {
        box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 20%, transparent) !important;
      }
      input, textarea, select, button { font-family: 'Courier New', monospace !important; }
    `
  },
  glow: {
    label: 'Neon Glow',
    description: 'Accent-colored glow on cards and borders',
    group: 'Effects',
    css: `
      .react-grid-item > div > div:first-child {
        box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 25%, transparent),
                    0 0 4px color-mix(in srgb, var(--accent) 10%, transparent) !important;
        border-color: color-mix(in srgb, var(--accent) 40%, transparent) !important;
      }
      nav {
        box-shadow: 0 2px 12px color-mix(in srgb, var(--accent) 15%, transparent) !important;
      }
    `
  },
  compact: {
    label: 'Compact',
    description: 'Dense layout, smaller text, tighter spacing',
    group: 'Density',
    css: `
      body { font-size: 13px !important; }
      .widget-drag-handle { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
      .react-grid-item > div > div:last-child { padding: 0.375rem !important; }
      nav .h-14 { height: 2.75rem !important; }
    `
  },
  cozy: {
    label: 'Cozy',
    description: 'Extra padding and breathing room',
    group: 'Density',
    css: `
      .react-grid-item > div > div:last-child { padding: 1rem !important; }
      .widget-drag-handle { padding-top: 0.625rem !important; padding-bottom: 0.625rem !important; }
    `
  },
  wide: {
    label: 'Wide',
    description: 'Full-width edge-to-edge layout',
    group: 'Layout',
    css: `
      .max-w-7xl { max-width: 100% !important; }
      .max-w-3xl { max-width: 100% !important; }
      .max-w-2xl { max-width: 100% !important; }
    `
  },
  narrow: {
    label: 'Narrow',
    description: 'Centered, generous margins',
    group: 'Layout',
    css: `
      .max-w-7xl { max-width: 56rem !important; }
    `
  },
};

// Apply multiple styles (array of style IDs)
function applyStyle(styleIds) {
  // Remove all previous style elements
  document.querySelectorAll('[data-rigboard-style]').forEach(el => el.remove());

  const ids = Array.isArray(styleIds) ? styleIds : [styleIds];
  for (const id of ids) {
    const style = STYLES[id];
    if (!style) continue;
    const el = document.createElement('style');
    el.setAttribute('data-rigboard-style', id);
    el.textContent = style.css;
    document.head.appendChild(el);
  }
}

function getStyleGroups() {
  const groups = {};
  for (const [id, style] of Object.entries(STYLES)) {
    if (!groups[style.group]) groups[style.group] = [];
    groups[style.group].push({ id, ...style });
  }
  return groups;
}

export { STYLES, applyStyle, getStyleGroups };
