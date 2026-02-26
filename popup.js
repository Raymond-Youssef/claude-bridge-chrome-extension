// popup.js — copy MCP setup command
document.getElementById('copy-setup').addEventListener('click', async () => {
  const command = 'claude mcp add claude-bridge -- npx claude-bridge-mcp';
  await navigator.clipboard.writeText(command);
  const status = document.getElementById('copy-status');
  status.style.display = 'block';
  setTimeout(() => { status.style.display = 'none'; }, 3000);
});
