#!/bin/bash
# Packages the live Typhon Helper Extension as a versioned .zip
# and updates the download link in AnesthesiaWiki.html.
# Run this after promoting WIP → live.

set -e

WIKI_DIR="$(cd "$(dirname "$0")/Anesthesia Wiki" && pwd)"
EXT_DIR="$WIKI_DIR/Typhon Helper/Typhon Helper Extension"
TYPHON_DIR="$WIKI_DIR/Typhon Helper"
WIKI_HTML="$WIKI_DIR/AnesthesiaWiki.html"

# Read version from manifest.json
VERSION=$(python3 -c "import json; print(json.load(open('$EXT_DIR/manifest.json'))['version'])")
ZIP_NAME="TyphonCaseHelperExtension-v${VERSION}.zip"
ZIP_PATH="$TYPHON_DIR/$ZIP_NAME"

echo "Packaging extension v${VERSION}..."

# Remove any existing zip for this version
rm -f "$ZIP_PATH"

# Create zip from extension folder, excluding .DS_Store
cd "$TYPHON_DIR"
zip -r "$ZIP_PATH" "Typhon Helper Extension" \
  --exclude "*/\.*" \
  --exclude "*/__pycache__/*" \
  --exclude "*.py"

echo "Created: $ZIP_NAME"

# Update the download link and version label in AnesthesiaWiki.html
sed -i '' \
  "s|TyphonCaseHelperExtension-v[0-9.]*\.zip|${ZIP_NAME}|g" \
  "$WIKI_HTML"

sed -i '' \
  "s|Download v[0-9.]*\(</span>\)|Download v${VERSION}\1|g" \
  "$WIKI_HTML"

echo "Updated AnesthesiaWiki.html → $ZIP_NAME"
echo "Done. Deploy both AnesthesiaWiki.html and Typhon Helper/$ZIP_NAME to the server."
