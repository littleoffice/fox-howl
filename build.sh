#!/usr/bin/env bash
#
# build.sh — Package Fox Howl into a Firefox-installable .xpi file
#
# Usage:
#   ./build.sh
#
# Output:
#   fox-howl.xpi  (in the project root)
#
# What is an .xpi?
#   It's a ZIP archive with a different extension. Firefox uses this
#   format to install addons. You can install it via:
#     1. Open Firefox → about:addons
#     2. Click the gear icon → "Install Add-on From File..."
#     3. Select the .xpi file
#
#   For unsigned addons, you need Firefox Developer Edition or Nightly
#   with xpinstall.signatures.required set to false in about:config.
#   Alternatively, load it temporarily via about:debugging.
#
# Requirements:
#   - zip (usually pre-installed on Linux/macOS; on Windows use Git Bash)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT="$SCRIPT_DIR/fox-howl.xpi"

# Clean previous build
rm -f "$OUTPUT"

# Package all addon files into the xpi
cd "$SCRIPT_DIR"
zip -r "$OUTPUT" \
  manifest.json \
  background.js \
  content.js \
  popup.html \
  popup.js \
  popup.css \
  options.html \
  options.js \
  options.css \
  icons/

echo ""
echo "Build complete: $OUTPUT"
echo ""
echo "To install:"
echo "  1. Open Firefox → about:addons"
echo "  2. Gear icon → 'Install Add-on From File...'"
echo "  3. Select fox-howl.xpi"
