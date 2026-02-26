// panel.js — Claude Bridge DevTools panel logic
let inspecting = false;
let history = [];
let activeIndex = -1;

const inspectBtn = document.getElementById('inspect-btn');
const clearBtn = document.getElementById('clear-btn');
const mcpDot = document.getElementById('mcp-dot');
const mcpLabel = document.getElementById('mcp-label');
const emptyState = document.getElementById('empty-state');
const elementDetail = document.getElementById('element-detail');
const historyList = document.getElementById('history-list');

// Connect a port to background so it knows the panel is open.
// When this panel is destroyed (DevTools closed), the port disconnects
// and background will disable inspect mode on the tab.
const panelPort = chrome.runtime.connect({ name: 'devtools-panel' });
panelPort.postMessage({ type: 'PANEL_INIT', tabId: chrome.devtools.inspectedWindow.tabId });

// --- MCP status indicator ---
let mcpPollId = null;

function updateMcpStatus() {
  try {
    void chrome.runtime.id; // throws if context is invalidated
  } catch {
    clearInterval(mcpPollId);
    return;
  }
  chrome.runtime.sendMessage({ type: 'GET_MCP_STATUS' }, (response) => {
    try { void chrome.runtime.lastError; } catch { clearInterval(mcpPollId); return; }
    if (response?.connected) {
      mcpDot.className = 'mcp-dot connected';
      mcpDot.title = 'MCP server connected';
      mcpLabel.textContent = 'MCP connected';
      mcpLabel.className = 'mcp-label connected';
    } else {
      mcpDot.className = 'mcp-dot';
      mcpDot.title = 'MCP server not connected';
      mcpLabel.textContent = 'MCP disconnected';
      mcpLabel.className = 'mcp-label';
    }
  });
}
updateMcpStatus();
mcpPollId = setInterval(updateMcpStatus, 3000);

// --- Tab switching helper ---
function switchToTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
  document.getElementById(`tab-${name}`).classList.add('active');
}

// --- Tabs ---
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchToTab(tab.dataset.tab));
});

// --- Inspect toggle ---
inspectBtn.addEventListener('click', () => {
  inspecting = !inspecting;
  inspectBtn.classList.toggle('active', inspecting);
  inspectBtn.textContent = inspecting ? 'Stop Inspecting' : 'Inspect';
  document.getElementById('hint').style.display = inspecting ? '' : 'none';

  chrome.devtools.inspectedWindow.eval(
    `window.postMessage({ type: 'ELEMENT_BRIDGE_TOGGLE', enabled: ${inspecting} }, '*')`,
    (_result, error) => {
      if (error) {
        // Page may have navigated or CSP blocked eval — reset state
        inspecting = false;
        inspectBtn.classList.remove('active');
        inspectBtn.textContent = 'Inspect';
        document.getElementById('hint').style.display = 'none';
        mcpLabel.textContent = 'Error';
        mcpLabel.className = 'mcp-label';
      }
    }
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

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'ELEMENT_CAPTURED_FOR_PANEL') {
    const el = message.payload;
    history.unshift(el);
    if (history.length > 10) history.pop();
    activeIndex = 0;
    renderElement(el);
    renderHistory();
    switchToTab('element');

    // Inspect mode auto-stopped after selection
    inspecting = false;
    inspectBtn.classList.remove('active');
    inspectBtn.textContent = 'Inspect';
    document.getElementById('hint').style.display = 'none';

    mcpLabel.textContent = 'Captured';
    mcpLabel.className = 'mcp-label connected';
    setTimeout(() => updateMcpStatus(), 1500);
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

  // Sample prompt
  const samplePrompt = 'Use claude-bridge MCP to fetch the selected element';
  html += `<div class="element-card">`;
  html += `<div class="section-title">Sample Prompt</div>`;
  html += `<div class="prompt-box">${esc(samplePrompt)}</div>`;
  html += `<button class="copy-prompt-btn" id="copy-prompt-btn">Copy</button>`;
  html += `</div>`;

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

  const copyBtn = document.getElementById('copy-prompt-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(samplePrompt).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      });
    });
  }
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
      switchToTab('element');
    });
  });
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
