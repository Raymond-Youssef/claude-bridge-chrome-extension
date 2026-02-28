// background.js — service worker that manages WebSocket to MCP server
const WS_PORT = 18925;
let ws = null;
let retryDelay = 1000;
const MAX_RETRY_DELAY = 30000;
let lastPayload = null;

function connectWebSocket() {
  let wasConnected = false;
  ws = new WebSocket(`ws://localhost:${WS_PORT}`);
  ws.onopen = () => {
    wasConnected = true;
    console.log('[claude-bridge] Connected to MCP server');
    retryDelay = 1000;
    if (lastPayload) {
      ws.send(JSON.stringify(lastPayload));
    }
  };
  ws.onclose = () => {
    // Only log if we were previously connected (not on initial connection failures)
    if (wasConnected) console.log('[claude-bridge] Disconnected from MCP server');
    setTimeout(connectWebSocket, retryDelay);
    retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
  };
  ws.onerror = () => ws.close();
}

connectWebSocket();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_MCP_STATUS') {
    sendResponse({ connected: ws?.readyState === WebSocket.OPEN });
    return;
  }

  if (message.type === 'ELEMENT_CAPTURED') {
    lastPayload = message.payload;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message.payload));
      console.log('[claude-bridge] Element sent to MCP server');
    }
  }
});
