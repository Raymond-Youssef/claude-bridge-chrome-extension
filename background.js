// background.js — service worker that manages WebSocket to MCP server
const WS_PORT = 18925;
let ws = null;
let retryDelay = 1000;
const MAX_RETRY_DELAY = 30000;

function connectWebSocket() {
  ws = new WebSocket(`ws://localhost:${WS_PORT}`);
  ws.onopen = () => {
    console.log('[claude-bridge] Connected to MCP server');
    retryDelay = 1000; // reset on successful connection
  };
  ws.onclose = () => {
    console.log(`[claude-bridge] Disconnected, retrying in ${retryDelay / 1000}s...`);
    setTimeout(connectWebSocket, retryDelay);
    retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
  };
  ws.onerror = () => ws.close();
}

connectWebSocket();

// Track which tabs have the DevTools panel open.
// When the panel closes, disable inspect mode on that tab.
const panelTabs = new Map(); // port -> tabId

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'devtools-panel') return;

  port.onMessage.addListener((msg) => {
    if (msg.type === 'PANEL_INIT') {
      panelTabs.set(port, msg.tabId);
    }
  });

  port.onDisconnect.addListener(() => {
    const tabId = panelTabs.get(port);
    panelTabs.delete(port);
    if (tabId != null) {
      // Tell the content script to disable inspect mode
      chrome.tabs.sendMessage(tabId, { type: 'DISABLE_INSPECT' }).catch(() => {});
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_MCP_STATUS') {
    sendResponse({ connected: ws?.readyState === WebSocket.OPEN });
    return;
  }

  if (message.type === 'ELEMENT_CAPTURED') {
    // Send to MCP server
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message.payload));
      console.log('[claude-bridge] Element sent to MCP server');
    }

    // Forward to DevTools panel
    chrome.runtime.sendMessage({
      type: 'ELEMENT_CAPTURED_FOR_PANEL',
      payload: message.payload
    }).catch(() => {});
  }
});
