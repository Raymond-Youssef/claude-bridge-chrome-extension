# Chrome Web Store Listing

Use this as reference when filling out the Chrome Web Store listing form.

## Short description (132 chars max)

Inspect any element on a page and send its full context — React components, props, styles, HTML — to Claude Code via MCP.

## Detailed description

Claude Bridge adds a panel to Chrome DevTools that lets you inspect any element on a web page and send its full context to Claude Code.

HOW IT WORKS

1. Open DevTools and go to the "Claude Bridge" panel
2. Click "Inspect" to enter inspection mode
3. Hover over elements to see component names highlighted
4. Click an element to capture it (inspect mode stops automatically)
5. The element data is instantly available in your Claude Code session

WHAT GETS CAPTURED

- React component name and source file path
- Component props (sanitized, functions and large objects excluded)
- Component ancestry chain (up to 3 levels)
- CSS selector and outer HTML
- Computed styles (layout, typography, colors, spacing)
- Bounding box and page URL

SETUP

1. Install the extension
2. Run: claude mcp add claude-bridge -- npx claude-bridge-mcp
3. Open DevTools on any page — look for the "Claude Bridge" tab

Works on any website. React component info is available on React sites; DOM and style capture works everywhere.

PRIVACY

Everything runs locally. Captured data is sent only to a local MCP server on your machine (localhost:18925). No data is collected or transmitted to external servers.

## Single purpose description

Captures element context from web pages and sends it to a local MCP server for use in Claude Code.

## Category

Developer Tools

## Language

English
