# Privacy Policy

## Data collection

Claude Bridge does **not** collect, store, or transmit any personal data to external servers.

## What data is captured

When you explicitly Option+Click an element in inspect mode, the extension captures:
- The HTML tag name, CSS selector, and outer HTML of the clicked element
- React component name, props, and source file information (if available)
- Computed CSS styles of the element
- The page URL and title

## Where data is sent

Captured element data is sent **only** to a local WebSocket server running on `localhost:18925`. This server is the `claude-bridge-mcp` MCP server running on your own machine. No data leaves your computer unless you explicitly share it.

## Permissions

- **activeTab** - Used to inject the element inspection script into the current tab
- **scripting** - Used to inject scripts for element capture

## Third-party services

Claude Bridge does not integrate with any third-party analytics, tracking, or advertising services.

## Contact

If you have questions about this privacy policy, please open an issue on the GitHub repository.
