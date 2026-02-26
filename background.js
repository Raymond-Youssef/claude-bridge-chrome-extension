// background.js — service worker that manages WebSocket to MCP server
const WS_PORT = 18925;
let ws = null;

function connectWebSocket() {
  ws = new WebSocket(`ws://localhost:${WS_PORT}`);
  ws.onopen = () => console.log('[claude-bridge] Connected to MCP server');
  ws.onclose = () => {
    console.log('[claude-bridge] Disconnected, retrying in 3s...');
    setTimeout(connectWebSocket, 3000);
  };
  ws.onerror = () => ws.close();
}

connectWebSocket();

chrome.runtime.onMessage.addListener((message, sender) => {
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
