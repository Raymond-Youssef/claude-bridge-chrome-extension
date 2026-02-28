// pageScript.js — injected into the actual page context
// Has access to __REACT_DEVTOOLS_GLOBAL_HOOK__

let inspectMode = false;
let hoverOverlay = null;
let hoverLabel = null;

function createOverlay() {
  hoverOverlay = document.createElement('div');
  hoverOverlay.id = '__claude_bridge_overlay__';
  Object.assign(hoverOverlay.style, {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: '2147483647',
    border: '2px solid #e07a3a',
    backgroundColor: 'rgba(224, 122, 58, 0.08)',
    borderRadius: '2px',
    transition: 'all 0.05s ease-out',
    display: 'none'
  });

  hoverLabel = document.createElement('div');
  Object.assign(hoverLabel.style, {
    position: 'absolute',
    bottom: '100%',
    left: '-2px',
    backgroundColor: '#e07a3a',
    color: '#fff',
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: '500',
    padding: '2px 6px',
    borderRadius: '3px 3px 0 0',
    whiteSpace: 'nowrap',
    lineHeight: '16px'
  });

  hoverOverlay.appendChild(hoverLabel);
  document.body.appendChild(hoverOverlay);
}

function showOverlay(element) {
  if (!hoverOverlay) createOverlay();

  const rect = element.getBoundingClientRect();
  Object.assign(hoverOverlay.style, {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    display: 'block'
  });

  // Try to get component name for the label
  const reactInfo = getReactComponentInfo(element);
  const compName = reactInfo?.componentChain?.[0]?.componentName;
  const tag = element.tagName.toLowerCase();
  hoverLabel.textContent = compName ? `<${compName}>` : `<${tag}>`;

  // Flip label below if too close to top
  if (rect.y < 24) {
    hoverLabel.style.bottom = 'auto';
    hoverLabel.style.top = '100%';
    hoverLabel.style.borderRadius = '0 0 3px 3px';
  } else {
    hoverLabel.style.bottom = '100%';
    hoverLabel.style.top = 'auto';
    hoverLabel.style.borderRadius = '3px 3px 0 0';
  }
}

function hideOverlay() {
  if (hoverOverlay) hoverOverlay.style.display = 'none';
}

// Listen for toggle from the extension
window.addEventListener('message', (event) => {
  if (event.data?.type === 'ELEMENT_BRIDGE_TOGGLE') {
    inspectMode = event.data.enabled;
    document.body.style.cursor = inspectMode ? 'crosshair' : '';
    if (!inspectMode) hideOverlay();
  }
});

// --- Hover highlight ---
document.addEventListener('mousemove', (event) => {
  if (!inspectMode) return;
  showOverlay(event.target);
}, true);

document.addEventListener('mouseleave', () => {
  if (inspectMode) hideOverlay();
}, true);

// --- Core: extract React component info from a DOM element ---

function getFiberFromDom(domElement) {
  // React attaches fiber directly to DOM nodes via __reactFiber$xxx keys
  const key = Object.keys(domElement).find(
    k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
  );
  if (key) return domElement[key];

  // Fallback: try DevTools hook renderers
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook?.renderers) return null;

  for (const [, renderer] of hook.renderers) {
    if (typeof renderer.findFiberByHostInstance !== 'function') continue;
    try {
      const fiber = renderer.findFiberByHostInstance(domElement);
      if (fiber) return fiber;
    } catch {}
  }

  return null;
}

function getReactComponentInfo(domElement) {
  const fiber = getFiberFromDom(domElement);
  if (!fiber) return null;

  // Walk up the fiber tree to find user components
  // (skip host components like 'div', 'span', etc.)
  let current = fiber;
  const componentChain = [];

  while (current) {
    const isUserComponent =
      typeof current.type === 'function' ||
      typeof current.type === 'object';

    if (isUserComponent) {
      const name = current.type.displayName
                || current.type.name
                || 'Anonymous';
      const source = current._debugSource || null;

      componentChain.push({
        componentName: name,
        fileName: source?.fileName || null,
        lineNumber: source?.lineNumber || null,
        columnNumber: source?.columnNumber || null
      });

      // 3 levels of component ancestry is enough context
      if (componentChain.length >= 3) break;
    }

    current = current.return;
  }

  // Grab props from the nearest user component
  const nearestFiber = findNearestUserFiber(fiber);
  const props = nearestFiber?.memoizedProps
    ? sanitizeProps(nearestFiber.memoizedProps)
    : null;

  return { componentChain, props };
}

function findNearestUserFiber(fiber) {
  let current = fiber;
  while (current) {
    if (typeof current.type === 'function' ||
        typeof current.type === 'object') {
      return current;
    }
    current = current.return;
  }
  return null;
}

function sanitizeProps(props) {
  const clean = {};
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children') continue;
    const t = typeof value;
    if (t === 'function' || t === 'symbol') {
      clean[key] = `[${t}]`;
    } else if (t === 'object' && value !== null) {
      try {
        const str = JSON.stringify(value);
        if (str.length < 500) clean[key] = JSON.parse(str);
        else clean[key] = '[large object]';
      } catch {
        clean[key] = '[circular]';
      }
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

// --- Block follow-up events after element capture to prevent link navigation ---

let blockInteraction = false;

for (const evt of ['mousedown', 'mouseup', 'pointerup', 'click', 'auxclick']) {
  document.addEventListener(evt, (e) => {
    if (!blockInteraction) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    // Reset after click (last in sequence) or pointerup (safety net if
    // preventDefault on pointerdown suppressed click from ever firing)
    if (evt === 'click' || evt === 'pointerup') {
      setTimeout(() => { blockInteraction = false; }, 0);
    }
  }, true);
}

// --- Element capture on pointerdown (earliest event, fires before link navigation) ---

document.addEventListener('pointerdown', (event) => {
  if (!inspectMode) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  blockInteraction = true;

  // Stop inspecting after selection
  inspectMode = false;
  document.body.style.cursor = '';
  hideOverlay();

  const element = event.target;
  const rect = element.getBoundingClientRect();
  const reactInfo = getReactComponentInfo(element);

  const payload = {
    // DOM info
    tagName: element.tagName.toLowerCase(),
    id: element.id || null,
    className: element.className || null,
    selector: generateSelector(element),
    textContent: element.textContent?.slice(0, 200) || null,
    html: element.outerHTML.slice(0, 2000),

    // Computed styles
    computedStyles: getRelevantStyles(element),

    // Bounding box
    boundingBox: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    },

    // React component info (from DevTools hook)
    react: reactInfo,

    // Page context
    pageUrl: window.location.href,
    pageTitle: document.title,
    timestamp: new Date().toISOString()
  };

  // JSON round-trip to strip non-clonable data (Symbols, DOM refs, etc.)
  // that would cause window.postMessage to silently fail.
  let safePayload;
  try {
    safePayload = JSON.parse(JSON.stringify(payload));
  } catch {
    safePayload = { ...payload, react: null, computedStyles: {} };
  }

  window.__claudeBridgeCapture = safePayload;
  window.__claudeBridgeCaptureSeq = (window.__claudeBridgeCaptureSeq || 0) + 1;

  flashElement(element);
}, true);

// --- Helpers ---

function generateSelector(element) {
  const parts = [];
  let el = element;

  while (el && el !== document.body && parts.length < 5) {
    let part = el.tagName.toLowerCase();

    if (el.id) {
      parts.unshift(`#${el.id}`);
      break;
    }

    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/)
        .filter(c => !c.startsWith('css-'))
        .slice(0, 2);
      if (classes.length) part += '.' + classes.join('.');
    }

    parts.unshift(part);
    el = el.parentElement;
  }

  return parts.join(' > ');
}

function getRelevantStyles(element) {
  const computed = window.getComputedStyle(element);
  const relevant = [
    'color', 'backgroundColor', 'fontSize', 'fontWeight', 'fontFamily',
    'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'width', 'height', 'maxWidth', 'minHeight',
    'display', 'flexDirection', 'alignItems', 'justifyContent', 'gap',
    'borderRadius', 'border',
    'position', 'top', 'right', 'bottom', 'left',
    'opacity', 'overflow', 'zIndex',
    'boxShadow', 'textAlign', 'lineHeight', 'letterSpacing'
  ];

  const styles = {};
  for (const prop of relevant) {
    const cssName = prop.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
    const val = computed.getPropertyValue(cssName);
    if (val && val !== 'none' && val !== 'normal' && val !== 'auto'
        && val !== '0px' && val !== 'rgba(0, 0, 0, 0)') {
      styles[prop] = val;
    }
  }
  return styles;
}

function flashElement(element) {
  const rect = element.getBoundingClientRect();
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    border: '2px solid #e07a3a',
    backgroundColor: 'rgba(224, 122, 58, 0.1)',
    pointerEvents: 'none',
    zIndex: '999999',
    transition: 'opacity 0.5s'
  });
  document.body.appendChild(overlay);
  setTimeout(() => { overlay.style.opacity = '0'; }, 300);
  setTimeout(() => { overlay.remove(); }, 800);
}
