// popup.js — status + setup hints

// Show platform-appropriate DevTools shortcut
const isMac = navigator.userAgentData?.platform === 'macOS' || /Mac/.test(navigator.userAgent);
document.getElementById('shortcut-alt').textContent = isMac ? '\u2318\u2325I' : 'Ctrl+Shift+I';

// Check MCP connection status and keep it updated while popup is open
const dot = document.getElementById('status-dot');
const value = document.getElementById('status-value');

function updateStatus() {
  chrome.runtime.sendMessage({ type: 'GET_MCP_STATUS' }, (response) => {
    if (chrome.runtime.lastError) return; // popup closing
    if (response?.connected) {
      dot.className = 'status-dot connected';
      value.className = 'status-value connected';
      value.textContent = 'Connected';
    } else {
      dot.className = 'status-dot disconnected';
      value.className = 'status-value disconnected';
      value.textContent = 'Not connected';
    }
  });
}

updateStatus();
setInterval(updateStatus, 2000);

// Copy MCP setup command
document.getElementById('copy-setup').addEventListener('click', async () => {
  const command = 'claude mcp add claude-bridge -- npx claude-bridge-mcp';
  await navigator.clipboard.writeText(command);
  const feedback = document.getElementById('copy-feedback');
  feedback.style.display = 'block';
  setTimeout(() => { feedback.style.display = 'none'; }, 3000);
});
