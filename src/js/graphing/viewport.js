
// Coordinate math for the graph.
// The viewport stores the world coordinates at the canvas center
// and the number of pixels represented by one world unit.

export const ZOOM_STEP = 1.25;

const MIN_SCALE = 1e-4;
const MAX_SCALE = 1e6;
const TARGET_GRID_PX = 90;
const INITIAL_VISIBLE_UNITS = 20;

export function defaultViewport(width, height = width) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);

  // Fit a useful initial range in both dimensions.
  const scale = Math.min(
    safeWidth / INITIAL_VISIBLE_UNITS,
    safeHeight / INITIAL_VISIBLE_UNITS,
  );

  return {
    cx: 0,
    cy: 0,
    scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)),
  };
}

export function zoomAt(view, factor, px, py, width, height) {
  if (!view || !Number.isFinite(factor) || factor <= 0) return view;

  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, view.scale * factor),
  );

  // Preserve the world coordinate beneath the pointer.
  const worldX = view.cx + (px - width / 2) / view.scale;
  const worldY = view.cy - (py - height / 2) / view.scale;

  return {
    cx: worldX - (px - width / 2) / scale,
    cy: worldY + (py - height / 2) / scale,
    scale,
  };
}

export function panBy(view, dxPx, dyPx) {
  if (!view || !Number.isFinite(dxPx) || !Number.isFinite(dyPx)) {
    return view;
  }

  return {
    ...view,
    cx: view.cx - dxPx / view.scale,
    cy: view.cy + dyPx / view.scale,
  };
}

export function niceStep(scale) {
  if (!Number.isFinite(scale) || scale <= 0) return 1;

  const raw = TARGET_GRID_PX / scale;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;

  const base =
    normalized < 1.5 ? 1 :
    normalized < 3.5 ? 2 :
    normalized < 7.5 ? 5 : 10;

  return base * magnitude;
}
