
import { niceStep } from './viewport.js';

const BACKGROUND = '#121419';
const GRID = 'rgba(148, 163, 184, 0.12)';
const AXIS = 'rgba(203, 213, 225, 0.6)';
const LABEL = '#9aa3b2';

const LABEL_FONT = '12px system-ui, sans-serif';
const CURVE_WIDTH = 2;

const MAX_PLOT_VALUE = 1e9;
const MAX_TICKS = 300;
const MAX_CURVE_JUMP = 2;

function formatTick(value) {
  if (Math.abs(value) < 1e-12) return '0';

  return String(Number(value.toPrecision(6)));
}

function tickRange(min, max, step) {
  return {
    from: Math.ceil(min / step),
    to: Math.floor(max / step),
  };
}

function drawGrid(f) {
  const {
    ctx,
    width,
    height,
    toX,
    toY,
    step,
    xMin,
    xMax,
    yMin,
    yMax,
  } = f;

  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();

  const xs = tickRange(xMin, xMax, step);
  const ys = tickRange(yMin, yMax, step);

  const xCount = Math.min(MAX_TICKS, Math.max(0, xs.to - xs.from + 1));
  const yCount = Math.min(MAX_TICKS, Math.max(0, ys.to - ys.from + 1));

  for (let i = 0; i < xCount; i++) {
    const value = (xs.from + i) * step;
    const px = toX(value);

    ctx.moveTo(px, 0);
    ctx.lineTo(px, height);
  }

  for (let i = 0; i < yCount; i++) {
    const value = (ys.from + i) * step;
    const py = toY(value);

    ctx.moveTo(0, py);
    ctx.lineTo(width, py);
  }

  ctx.stroke();
}

function drawAxes(ctx, width, height, axisX, axisY) {
  ctx.strokeStyle = AXIS;
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  // Draw the x-axis only when y = 0 is visible.
  if (axisY !== null) {
    ctx.moveTo(0, axisY);
    ctx.lineTo(width, axisY);
  }

  // Draw the y-axis only when x = 0 is visible.
  if (axisX !== null) {
    ctx.moveTo(axisX, 0);
    ctx.lineTo(axisX, height);
  }

  ctx.stroke();
}

function drawLabels(f, axisX, axisY) {
  const {
    ctx,
    toX,
    toY,
    step,
    xMin,
    xMax,
    yMin,
    yMax,
    width,
    height,
  } = f;

  ctx.fillStyle = LABEL;
  ctx.font = LABEL_FONT;

  const xs = tickRange(xMin, xMax, step);
  const ys = tickRange(yMin, yMax, step);

  const xCount = Math.min(MAX_TICKS, Math.max(0, xs.to - xs.from + 1));
  const yCount = Math.min(MAX_TICKS, Math.max(0, ys.to - ys.from + 1));

  // X-axis labels.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const xLabelY = axisY === null
    ? height - 20
    : Math.min(height - 18, axisY + 6);

  for (let i = 0; i < xCount; i++) {
    const value = (xs.from + i) * step;

    if (Math.abs(value) < 1e-12) continue;

    const px = toX(value);

    if (px < 20 || px > width - 20) continue;

    ctx.fillText(formatTick(value), px, xLabelY);
  }

  // Y-axis labels.
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const yLabelX = axisX === null
    ? width - 8
    : Math.max(35, axisX - 6);

  for (let i = 0; i < yCount; i++) {
    const value = (ys.from + i) * step;

    if (Math.abs(value) < 1e-12) continue;

    const py = toY(value);

    if (py < 10 || py > height - 10) continue;

    ctx.fillText(formatTick(value), yLabelX, py);
  }

  // Origin label.
  if (axisX !== null && axisY !== null) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const originX = Math.min(width - 18, Math.max(4, axisX + 5));
    const originY = Math.min(height - 18, Math.max(4, axisY + 5));

    ctx.fillText('0', originX, originY);
  }
}

function drawCurve(f, curve) {
  const {
    ctx,
    width,
    height,
    scale,
    xMin,
    toY,
  } = f;

  const maxJump = height * MAX_CURVE_JUMP;

  ctx.strokeStyle = curve.color;
  ctx.lineWidth = CURVE_WIDTH;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  let previousY = null;

  for (let px = 0; px <= width; px++) {
    const x = xMin + px / scale;
    const y = curve.evaluate(x);

    if (!Number.isFinite(y) || Math.abs(y) > MAX_PLOT_VALUE) {
      previousY = null;
      continue;
    }

    const screenY = toY(y);

    if (!Number.isFinite(screenY) || Math.abs(screenY) > 1e12) {
      previousY = null;
      continue;
    }

    if (
      previousY === null ||
      Math.abs(screenY - previousY) > maxJump
    ) {
      ctx.moveTo(px, screenY);
    } else {
      ctx.lineTo(px, screenY);
    }

    previousY = screenY;
  }

  ctx.stroke();
}

export function drawGraph(ctx, width, height, view, curves) {
  if (
    !ctx ||
    !view ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(view.scale) ||
    view.scale <= 0
  ) {
    return;
  }

  const { cx, cy, scale } = view;

  const toX = (x) => width / 2 + (x - cx) * scale;
  const toY = (y) => height / 2 - (y - cy) * scale;

  const f = {
    ctx,
    width,
    height,
    scale,
    toX,
    toY,
    step: niceStep(scale),

    xMin: cx - width / 2 / scale,
    xMax: cx + width / 2 / scale,

    yMin: cy - height / 2 / scale,
    yMax: cy + height / 2 / scale,
  };

  // Background.
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);

  // Grid.
  drawGrid(f);

  // Only show the real axes if the origin is visible.
  const rawAxisX = toX(0);
  const rawAxisY = toY(0);

  const axisX =
    rawAxisX >= 0 && rawAxisX <= width
      ? rawAxisX
      : null;

  const axisY =
    rawAxisY >= 0 && rawAxisY <= height
      ? rawAxisY
      : null;

  drawAxes(ctx, width, height, axisX, axisY);
  drawLabels(f, axisX, axisY);

  // Function curves.
  for (const curve of curves) {
    drawCurve(f, curve);
  }
}
