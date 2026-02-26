// panel.js — Claude Bridge DevTools panel logic
let inspecting = false;
let history = [];
let activeIndex = -1;

const inspectBtn = document.getElementById('inspect-btn');
const clearBtn = document.getElementById('clear-btn');
const statusEl = document.getElementById('status');
const emptyState = document.getElementById('empty-state');
const elementDetail = document.getElementById('element-detail');
const historyList = document.getElementById('history-list');

// --- Tabs ---
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// --- Inspect toggle ---
inspectBtn.addEventListener('click', () => {
  inspecting = !inspecting;
  inspectBtn.classList.toggle('active', inspecting);
  inspectBtn.textContent = inspecting ? 'Stop Inspecting' : 'Inspect';
  document.getElementById('hint').style.display = inspecting ? '' : 'none';

  chrome.devtools.inspectedWindow.eval(
    `window.postMessage({ type: 'ELEMENT_BRIDGE_TOGGLE', enabled: ${inspecting} }, '*')`
  );
});

// --- Clear ---
clearBtn.addEventListener('click', () => {
  history = [];
  activeIndex = -1;
  renderElement(null);
  renderHistory();
});

// --- Listen for captured elements from content script ---
// We poll via a shared background message since DevTools panels
// can't directly receive window.postMessage from the page.

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'ELEMENT_CAPTURED_FOR_PANEL') {
    const el = message.payload;
    history.unshift(el);
    if (history.length > 10) history.pop();
    activeIndex = 0;
    renderElement(el);
    renderHistory();

    // Switch to element tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="element"]').classList.add('active');
    document.getElementById('tab-element').classList.add('active');

    statusEl.textContent = 'Captured';
    statusEl.className = 'status connected';
    setTimeout(() => {
      statusEl.textContent = 'Ready';
      statusEl.className = 'status connected';
    }, 1500);
  }
});

// --- Render element detail ---
function renderElement(el) {
  if (!el) {
    emptyState.style.display = '';
    elementDetail.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  elementDetail.style.display = '';

  let html = '';

  // React component info
  if (el.react?.componentChain?.length) {
    const comp = el.react.componentChain[0];
    html += `<div class="element-card">`;
    html += `<div class="section-title">React Component</div>`;
    html += `<div class="component-name">&lt;${esc(comp.componentName)}&gt;</div>`;
    if (comp.fileName) {
      const short = comp.fileName.replace(/^.*\/src\//, 'src/');
      html += `<div class="file-path">${esc(short)}${comp.lineNumber ? ':' + comp.lineNumber : ''}</div>`;
    }
    if (el.react.componentChain.length > 1) {
      html += `<div class="parent-chain">${el.react.componentChain.map(c => esc(c.componentName)).join(' → ')}</div>`;
    }
    html += `</div>`;
  }

  // Props
  if (el.react?.props && Object.keys(el.react.props).length) {
    html += `<div class="element-card">`;
    html += `<div class="section-title">Props</div>`;
    html += `<div class="prop-list">`;
    for (const [key, val] of Object.entries(el.react.props)) {
      const display = typeof val === 'string' ? `"${esc(val)}"` : esc(JSON.stringify(val));
      html += `<div><span class="prop-key">${esc(key)}</span>: <span class="prop-value">${display}</span></div>`;
    }
    html += `</div></div>`;
  }

  // DOM
  html += `<div class="element-card">`;
  html += `<div class="section-title">DOM</div>`;
  html += `<div class="selector">${esc(el.selector)}</div>`;
  if (el.textContent) {
    html += `<div style="color:#a1a1aa;margin-top:4px;">"${esc(el.textContent.slice(0, 80))}"</div>`;
  }
  html += `</div>`;

  // Styles
  if (el.computedStyles && Object.keys(el.computedStyles).length) {
    html += `<div class="element-card">`;
    html += `<div class="section-title">Computed Styles</div>`;
    html += `<div class="style-list">`;
    for (const [prop, val] of Object.entries(el.computedStyles)) {
      html += `<div><span class="style-key">${esc(prop)}</span>: <span class="style-value">${esc(val)}</span></div>`;
    }
    html += `</div></div>`;
  }

  // HTML
  html += `<div class="element-card">`;
  html += `<div class="section-title">HTML</div>`;
  html += `<div class="html-snippet">${esc(el.html)}</div>`;
  html += `</div>`;

  elementDetail.innerHTML = html;
}

// --- Render history ---
function renderHistory() {
  if (!history.length) {
    historyList.innerHTML = '<div class="empty">No elements captured yet.</div>';
    return;
  }

  let html = '';
  history.forEach((el, i) => {
    const comp = el.react?.componentChain?.[0];
    const name = comp?.componentName || el.tagName;
    const file = comp?.fileName?.split('/').pop() || '';
    html += `<div class="history-item ${i === activeIndex ? 'active' : ''}" data-index="${i}">`;
    html += `<span class="history-index">${i}</span>`;
    html += `<span class="history-name">&lt;${esc(name)}&gt;</span>`;
    html += `<span class="history-file">${esc(file)}</span>`;
    html += `</div>`;
  });
  historyList.innerHTML = html;

  historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      activeIndex = parseInt(item.dataset.index);
      renderElement(history[activeIndex]);
      renderHistory();

      // Switch to element tab
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.querySelector('[data-tab="element"]').classList.add('active');
      document.getElementById('tab-element').classList.add('active');
    });
  });
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
