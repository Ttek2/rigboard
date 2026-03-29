import { useState, useEffect, useCallback, useRef } from 'react';
import { getWidgetLayout, saveWidgetLayout } from '../api';

const BASE = '/api/v1';

// rowHeight=40px. Heights in grid units (1 unit = 40px)
// Small widget ~160px (4), Medium ~280px (7), Tall ~400px (10), XL ~520px (13)
const WIDGET_DEFAULTS = {
  feeds: { grid_w: 2, grid_h: 10, minW: 1, minH: 5 },
  rigs: { grid_w: 1, grid_h: 7, minW: 1, minH: 4 },
  bookmarks: { grid_w: 1, grid_h: 7, minW: 1, minH: 3 },
  notes: { grid_w: 2, grid_h: 7, minW: 1, minH: 4 },
  maintenance: { grid_w: 2, grid_h: 7, minW: 1, minH: 4 },
  services: { grid_w: 4, grid_h: 4, minW: 1, minH: 2 },
  weather: { grid_w: 1, grid_h: 4, minW: 1, minH: 3 },
  calendar: { grid_w: 1, grid_h: 4, minW: 1, minH: 3 },
  docker: { grid_w: 1, grid_h: 7, minW: 1, minH: 3 },
  system: { grid_w: 1, grid_h: 7, minW: 1, minH: 4 },
  embed: { grid_w: 2, grid_h: 7, minW: 1, minH: 3 },
  homeassistant: { grid_w: 1, grid_h: 7, minW: 1, minH: 3 },
  jellyseerr: { grid_w: 1, grid_h: 7, minW: 1, minH: 3 },
  media: { grid_w: 2, grid_h: 7, minW: 1, minH: 4 },
  starr: { grid_w: 1, grid_h: 7, minW: 1, minH: 3 },
  pihole: { grid_w: 1, grid_h: 5, minW: 1, minH: 3 },
  downloads: { grid_w: 2, grid_h: 7, minW: 1, minH: 3 },
  network: { grid_w: 1, grid_h: 7, minW: 1, minH: 3 },
  releases: { grid_w: 1, grid_h: 7, minW: 1, minH: 3 },
  pulse: { grid_w: 2, grid_h: 10, minW: 1, minH: 5 },
  websearch: { grid_w: 2, grid_h: 3, minW: 1, minH: 2 },
  ai: { grid_w: 2, grid_h: 8, minW: 1, minH: 4 },
  community: { grid_w: 2, grid_h: 8, minW: 1, minH: 4 },
};

async function fetchLayout(tabId) {
  const url = tabId ? `${BASE}/widgets/layout?tab_id=${tabId}` : `${BASE}/widgets/layout`;
  const res = await fetch(url);
  return res.json();
}

// 2D cell grid for precise gap detection
function createGrid(maxRows, cols) {
  return Array.from({ length: maxRows }, () => new Array(cols).fill(false));
}

function canPlace(grid, x, y, w, h) {
  for (let row = y; row < y + h; row++) {
    if (row >= grid.length) return true; // beyond current grid = empty
    for (let col = x; col < x + w; col++) {
      if (col >= grid[0].length || grid[row][col]) return false;
    }
  }
  return true;
}

function placeOnGrid(grid, x, y, w, h) {
  // Extend grid if needed
  while (grid.length < y + h) grid.push(new Array(grid[0]?.length || 4).fill(false));
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      grid[row][col] = true;
    }
  }
}

// Find the tightest position for a widget using 2D cell scanning
function findBestPosition(grid, w, h, cols) {
  const maxY = grid.length + h;
  for (let y = 0; y < maxY; y++) {
    for (let x = 0; x <= cols - w; x++) {
      if (canPlace(grid, x, y, w, h)) {
        return { x, y };
      }
    }
  }
  return { x: 0, y: grid.length };
}

// Full 2D masonry repack — scans cell-by-cell for tightest fit, no gaps
function masonryPack(widgets, cols, stretch = false) {
  // Sort: wider/taller widgets first for better packing, then by original position
  const sorted = [...widgets].sort((a, b) => {
    const areaA = a.grid_w * a.grid_h;
    const areaB = b.grid_w * b.grid_h;
    if (areaB !== areaA) return areaB - areaA;
    return a.grid_y - b.grid_y || a.grid_x - b.grid_x;
  });

  const grid = createGrid(1, cols);
  const packed = sorted.map(widget => {
    const w = Math.min(widget.grid_w, cols);
    const h = widget.grid_h;
    const pos = findBestPosition(grid, w, h, cols);
    placeOnGrid(grid, pos.x, pos.y, w, h);
    return { ...widget, grid_x: pos.x, grid_y: pos.y, grid_w: w };
  });

  if (!stretch) return packed;

  // Stretch pass: expand widgets to fill all remaining gaps
  return stretchToFill(packed, cols);
}

// Stretch widgets to fill every empty cell in the grid
function stretchToFill(widgets, cols) {
  const maxRow = Math.max(...widgets.map(w => w.grid_y + w.grid_h), 0);
  if (maxRow === 0) return widgets;

  // Build a map: grid cell -> widget index
  const cellOwner = Array.from({ length: maxRow }, () => new Array(cols).fill(-1));
  widgets.forEach((w, idx) => {
    for (let r = w.grid_y; r < w.grid_y + w.grid_h; r++) {
      for (let c = w.grid_x; c < w.grid_x + w.grid_w; c++) {
        if (r < maxRow && c < cols) cellOwner[r][c] = idx;
      }
    }
  });

  const result = widgets.map(w => ({ ...w }));

  // Pass 1: Stretch widgets DOWN to fill vertical gaps below them
  for (let i = 0; i < result.length; i++) {
    const w = result[i];
    let extraRows = 0;
    outer:
    for (let r = w.grid_y + w.grid_h; r < maxRow; r++) {
      for (let c = w.grid_x; c < w.grid_x + w.grid_w; c++) {
        if (cellOwner[r][c] !== -1) break outer;
      }
      extraRows++;
    }
    if (extraRows > 0) {
      result[i] = { ...w, grid_h: w.grid_h + extraRows };
      for (let r = w.grid_y + w.grid_h; r < w.grid_y + w.grid_h + extraRows; r++) {
        for (let c = w.grid_x; c < w.grid_x + w.grid_w; c++) {
          if (r < maxRow) cellOwner[r][c] = i;
        }
      }
    }
  }

  // Pass 2: Stretch widgets RIGHT to fill horizontal gaps beside them
  const maxRow2 = Math.max(...result.map(w => w.grid_y + w.grid_h), 0);
  const cellOwner2 = Array.from({ length: maxRow2 }, () => new Array(cols).fill(-1));
  result.forEach((w, idx) => {
    for (let r = w.grid_y; r < w.grid_y + w.grid_h; r++) {
      for (let c = w.grid_x; c < w.grid_x + w.grid_w; c++) {
        if (r < maxRow2 && c < cols) cellOwner2[r][c] = idx;
      }
    }
  });

  for (let i = 0; i < result.length; i++) {
    const w = result[i];
    let extraCols = 0;
    outer2:
    for (let c = w.grid_x + w.grid_w; c < cols; c++) {
      for (let r = w.grid_y; r < w.grid_y + w.grid_h; r++) {
        if (r < maxRow2 && cellOwner2[r][c] !== -1) break outer2;
      }
      extraCols++;
    }
    if (extraCols > 0) {
      result[i] = { ...w, grid_w: w.grid_w + extraCols };
      for (let r = w.grid_y; r < w.grid_y + w.grid_h; r++) {
        for (let c = w.grid_x + w.grid_w; c < w.grid_x + w.grid_w + extraCols; c++) {
          if (r < maxRow2 && c < cols) cellOwner2[r][c] = i;
        }
      }
    }
  }

  return result;
}

// Find position for a single new widget among existing ones
function findBestPositionForNew(existingWidgets, w, h, cols) {
  const grid = createGrid(1, cols);
  for (const widget of existingWidgets) {
    placeOnGrid(grid, widget.grid_x, widget.grid_y, widget.grid_w, widget.grid_h);
  }
  return findBestPosition(grid, w, h, cols);
}

export { WIDGET_DEFAULTS, masonryPack };

export default function useWidgetLayout(tabId, version = 0) {
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cols, setCols] = useState(4);
  const initialRenderRef = useRef(true);

  useEffect(() => {
    setLoading(true);
    initialRenderRef.current = true;
    fetchLayout(tabId).then(w => {
      setWidgets(w.map(widget => ({ ...widget, widget_config: typeof widget.widget_config === 'string' ? JSON.parse(widget.widget_config) : widget.widget_config })));
      setLoading(false);
      // Skip the first 2 onLayoutChange calls (react-grid-layout fires on mount + after first paint)
      setTimeout(() => { initialRenderRef.current = false; }, 1000);
    }).catch(() => setLoading(false));
  }, [tabId, version]);

  const layout = widgets.filter(w => w.is_visible).map((w, i) => ({
    i: String(w.id || i),
    x: w.grid_x,
    y: w.grid_y,
    w: w.grid_w,
    h: w.grid_h,
    minW: WIDGET_DEFAULTS[w.widget_type]?.minW || 1,
    minH: WIDGET_DEFAULTS[w.widget_type]?.minH || 1,
  }));

  const onLayoutChange = useCallback((newLayout) => {
    // Skip saves during initial render — react-grid-layout fires onLayoutChange
    // on mount which would overwrite stored positions with recomputed ones
    if (initialRenderRef.current) return;

    const updated = widgets.map((widget, i) => {
      const layoutItem = newLayout.find(l => l.i === String(widget.id || i));
      if (!layoutItem) return widget;
      return {
        ...widget,
        grid_x: layoutItem.x,
        grid_y: layoutItem.y,
        grid_w: layoutItem.w,
        grid_h: layoutItem.h,
      };
    });
    setWidgets(updated);
    saveWidgetLayout(updated.map(w => ({ ...w, tab_id: tabId || w.tab_id }))).catch(console.error);
  }, [widgets, tabId]);

  // Smart add: scans 2D grid for the tightest gap
  const addWidget = useCallback(async (type, config = {}) => {
    const defaults = WIDGET_DEFAULTS[type] || { grid_w: 2, grid_h: 7 };
    const w = Math.min(defaults.grid_w, cols);
    const pos = findBestPositionForNew(widgets, w, defaults.grid_h, cols);

    const newWidgets = [...widgets, {
      widget_type: type,
      widget_config: config,
      grid_x: pos.x,
      grid_y: pos.y,
      grid_w: w,
      grid_h: defaults.grid_h,
      is_visible: 1,
      tab_id: tabId || null,
    }];
    const saved = await saveWidgetLayout(newWidgets.map(w => ({ ...w, tab_id: tabId || w.tab_id })));
    setWidgets(saved.map(w => ({ ...w, widget_config: typeof w.widget_config === 'string' ? JSON.parse(w.widget_config) : w.widget_config })));
  }, [widgets, tabId, cols]);

  // Remove + auto-repack with stretch to fill
  const removeWidget = useCallback(async (index) => {
    const remaining = widgets.filter((_, i) => i !== index);
    const repacked = masonryPack(remaining, cols, true);
    const saved = await saveWidgetLayout(repacked.map(w => ({ ...w, tab_id: tabId || w.tab_id })));
    setWidgets(saved.map(w => ({ ...w, widget_config: typeof w.widget_config === 'string' ? JSON.parse(w.widget_config) : w.widget_config })));
  }, [widgets, tabId, cols]);

  // Full repack + stretch to fill every gap
  const autoArrange = useCallback(async () => {
    const repacked = masonryPack(widgets, cols, true);
    const saved = await saveWidgetLayout(repacked.map(w => ({ ...w, tab_id: tabId || w.tab_id })));
    setWidgets(saved.map(w => ({ ...w, widget_config: typeof w.widget_config === 'string' ? JSON.parse(w.widget_config) : w.widget_config })));
  }, [widgets, tabId, cols]);

  return { widgets, layout, loading, onLayoutChange, addWidget, removeWidget, autoArrange, setCols };
}
