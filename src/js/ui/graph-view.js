
import { createFunctionList } from '../graphing/plot-functions.js';
import {
  defaultViewport,
  zoomAt,
  panBy,
  ZOOM_STEP,
} from '../graphing/viewport.js';
import { drawGraph } from '../graphing/plot-renderer.js';
import { escapeHtml } from './render.js';

const STARTER_FUNCTIONS = ['x^2', 'sin(x)'];

export function mountGraphView(root) {
  if (!root) {
    console.error('AiCS Graph: Graph root element was not found.');
    return;
  }

  const stage = root.querySelector('#graph-stage');
  const canvas = root.querySelector('#graph-canvas');
  const form = root.querySelector('#function-form');
  const input = root.querySelector('#function-input');
  const errorText = root.querySelector('#function-error');
  const list = root.querySelector('#function-list');

  if (!stage || !canvas || !form || !input || !errorText || !list) {
    console.error('AiCS Graph: One or more graph elements are missing.');
    return;
  }

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.error('AiCS Graph: Canvas 2D context is unavailable.');
    return;
  }

  const functions = createFunctionList();
  STARTER_FUNCTIONS.forEach((text) => functions.add(text));

  let view = null;
  let size = { width: 0, height: 0 };
  let dragging = null;
  let frame = 0;
  let resizeObserver = null;

  function getCurves() {
    return functions
      .list()
      .filter((item) => item.visible)
      .map((item) => ({
        color: item.color,
        evaluate: item.evaluate,
      }));
  }

  function draw() {
    frame = 0;

    if (!view || size.width <= 0 || size.height <= 0) {
      return;
    }

    drawGraph(
      ctx,
      size.width,
      size.height,
      view,
      getCurves(),
    );
  }

  function requestDraw() {
    if (!frame) {
      frame = requestAnimationFrame(draw);
    }
  }

  function renderList() {
    const items = functions.list();

    if (items.length === 0) {
      list.innerHTML =
        '<li class="empty-state">Add a function to start plotting.</li>';
      return;
    }

    list.innerHTML = items
      .map((item) => {
        const label = escapeHtml(item.label);
        const id = escapeHtml(item.id);
        const color = escapeHtml(item.color);

        return `
          <li class="function-item">
            <span
              class="function-swatch"
              style="background: ${color}"
            ></span>

            <span class="function-label">${label}</span>

            <label class="switch">
              <input
                type="checkbox"
                data-action="toggle-function"
                data-id="${id}"
                ${item.visible ? 'checked' : ''}
                aria-label="Show ${label}"
              />
              <span class="switch-track" aria-hidden="true"></span>
            </label>

            <button
              type="button"
              class="remove-button"
              data-action="remove-function"
              data-id="${id}"
              aria-label="Remove ${label}"
            >×</button>
          </li>
        `;
      })
      .join('');
  }

  function resize() {
    const rect = stage.getBoundingClientRect();

    // A hidden drawer has no usable dimensions.
    // Keep the previous viewport and wait until it becomes visible.
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 3);

    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);

    const dimensionsChanged =
      width !== canvas.width ||
      height !== canvas.height;

    if (!dimensionsChanged) {
      return;
    }

    size = {
      width: rect.width,
      height: rect.height,
    };

    canvas.width = width;
    canvas.height = height;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Initialize only once. Subsequent resizing preserves zoom and pan.
    if (!view) {
      view = defaultViewport(rect.width, rect.height);
    }

    requestDraw();
  }

  function zoomAtCenter(factor) {
    if (!view || size.width <= 0 || size.height <= 0) {
      return;
    }

    view = zoomAt(
      view,
      factor,
      size.width / 2,
      size.height / 2,
      size.width,
      size.height,
    );

    requestDraw();
  }

  // Add a function.
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    try {
      functions.add(input.value);

      input.value = '';
      errorText.textContent = '';

      renderList();
      requestDraw();
    } catch (caught) {
      errorText.textContent =
        caught instanceof Error
          ? caught.message
          : 'Unable to plot this function.';
    }
  });

  // Toolbar and function-list actions.
  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');

    if (!target || !root.contains(target)) {
      return;
    }

    switch (target.dataset.action) {
      case 'zoom-in':
        zoomAtCenter(ZOOM_STEP);
        break;

      case 'zoom-out':
        zoomAtCenter(1 / ZOOM_STEP);
        break;

      case 'reset-view':
        if (size.width <= 0 || size.height <= 0) {
          return;
        }

        view = defaultViewport(size.width, size.height);
        requestDraw();
        break;

      case 'remove-function':
        functions.remove(target.dataset.id);
        renderList();
        requestDraw();
        break;

      default:
        break;
    }
  });

  root.addEventListener('change', (event) => {
    const target = event.target;

    if (target.dataset.action !== 'toggle-function') {
      return;
    }

    functions.toggle(target.dataset.id);
    requestDraw();
  });

  // Pointer-based panning.
  canvas.addEventListener('pointerdown', (event) => {
    if (!view || event.button !== 0) {
      return;
    }

    dragging = {
      x: event.clientX,
      y: event.clientY,
    };

    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('is-dragging');
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!dragging || !view) {
      return;
    }

    const dx = event.clientX - dragging.x;
    const dy = event.clientY - dragging.y;

    view = panBy(view, dx, dy);

    dragging = {
      x: event.clientX,
      y: event.clientY,
    };

    requestDraw();
  });

  function endDrag(event) {
    dragging = null;
    canvas.classList.remove('is-dragging');

    if (
      event.pointerId !== undefined &&
      canvas.hasPointerCapture(event.pointerId)
    ) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);

  // Wheel zoom centered on the pointer.
  canvas.addEventListener(
    'wheel',
    (event) => {
      if (!view || size.width <= 0 || size.height <= 0) {
        return;
      }

      event.preventDefault();

      const rect = canvas.getBoundingClientRect();

      const factor =
        event.deltaY < 0
          ? ZOOM_STEP
          : 1 / ZOOM_STEP;

      view = zoomAt(
        view,
        factor,
        event.clientX - rect.left,
        event.clientY - rect.top,
        size.width,
        size.height,
      );

      requestDraw();
    },
    { passive: false },
  );

  // Observe the stage, including changes caused by the graph drawer.
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
  } else {
    window.addEventListener('resize', resize);
  }

  // Also observe drawer visibility changes.
  // This catches cases where the drawer becomes visible without
  // its dimensions changing immediately.
  const visibilityObserver = new MutationObserver(() => {
    requestAnimationFrame(resize);
  });

  const drawer = root.closest('.graph-drawer');

  if (drawer) {
    visibilityObserver.observe(drawer, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
  }

  // Initial setup.
  renderList();

  // Try immediately; ResizeObserver will retry when the drawer opens.
  resize();

  // Return cleanup and access methods for future integrations.
  return {
    resize,
    redraw: requestDraw,

    getFunctions() {
      return functions.list();
    },

    getViewport() {
      return view ? { ...view } : null;
    },

    destroy() {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }

      resizeObserver?.disconnect();
      visibilityObserver.disconnect();

      window.removeEventListener('resize', resize);
    },
  };
}
