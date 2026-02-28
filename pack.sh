#!/bin/bash
# Pack the extension for Chrome Web Store upload
set -e

VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')
OUTFILE="claude-bridge-v${VERSION}.zip"

rm -f "$OUTFILE"

zip -r "$OUTFILE" \
  manifest.json \
  background.js \
  devtools.html \
  devtools.js \
  pageScript.js \
  panel.html \
  panel.js \
  popup.html \
  popup.js \
  icons/

echo "Packed: $OUTFILE"
