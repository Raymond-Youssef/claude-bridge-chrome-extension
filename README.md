# Claude Bridge

A Chrome DevTools extension that lets you point at any React element on your page and send its full context to [Claude Code](https://docs.anthropic.com/en/docs/claude-code) via MCP.

## What it does

1. **Inspect mode** - Click "Inspect" in the Claude Bridge DevTools panel, then hover over elements to see their React component names highlighted
2. **Capture** - Option+Click (Alt+Click on Windows/Linux) any element to capture:
   - React component name, props, and file path
   - Component ancestry chain (up to 3 levels)
   - DOM selector, HTML snippet, and computed styles
   - Bounding box and page context
3. **Send to Claude Code** - Captured data is sent over WebSocket to the `claude-bridge-mcp` server, making it available as context in your Claude Code session

## Install

### From the Chrome Web Store

> Coming soon

### Manual install (developer mode)

1. Clone this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select this directory

## Setup

### 1. Add the MCP server to Claude Code

```bash
claude mcp add claude-bridge -- npx claude-bridge-mcp
```

Or click the extension icon in Chrome and use the **Copy MCP setup command** button.

### 2. Open DevTools

Open Chrome DevTools on any localhost page. You'll see a new **Claude Bridge** panel.

### 3. Inspect and capture

1. Click **Inspect** in the Claude Bridge panel
2. Hover over elements to see component highlights
3. **Option+Click** (Alt+Click) an element to capture it
4. The element data is sent to Claude Code and displayed in the panel

## DevTools panel

The panel has two tabs:

- **Element** - Shows details of the last captured element: React component info, props, DOM selector, computed styles, and HTML
- **History** - Lists the last 10 captured elements for quick reference

## How it works

```
Page (pageScript.js)          Content Script (injector.js)        Background (background.js)
       |                              |                                    |
       |  -- window.postMessage -->   |                                    |
       |     ELEMENT_BRIDGE_CAPTURE   |  -- chrome.runtime.sendMessage --> |
       |                              |     ELEMENT_CAPTURED               |
       |                              |                                    | -- WebSocket --> MCP Server
       |                              |                                    |
       |                              |                                    | -- chrome.runtime.sendMessage -->
       |                              |                                    |    ELEMENT_CAPTURED_FOR_PANEL
       |                              |                                    |          |
       |                              |                                    |    DevTools Panel (panel.js)
```

- **pageScript.js** - Injected into the page context. Has access to React fiber internals. Handles hover highlighting and element capture on Option+Click.
- **injector.js** - Content script that injects `pageScript.js` and relays messages to the background.
- **background.js** - Service worker that maintains a WebSocket connection to the MCP server (port 18925) and forwards captured data.
- **panel.js / panel.html** - DevTools panel UI that displays captured element details.
- **devtools.js** - Registers the Claude Bridge panel in Chrome DevTools.
- **popup.html / popup.js** - Extension popup with a button to copy the MCP setup command.

## Supported sites

The extension works on any web page — localhost, staging, production, or any other URL.

## Requirements

- Chrome 88+ (Manifest V3)
- A React application running on localhost
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with the `claude-bridge-mcp` server configured

## Privacy

Claude Bridge runs entirely locally. Element data is only sent to `localhost:18925` (the local MCP server). No data is sent to any external servers. See [PRIVACY.md](PRIVACY.md) for details.

## License

MIT
