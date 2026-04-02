#!/bin/bash
set -euo pipefail

# HisaabPro Release Build Script
# Usage: ./scripts/build-release.sh [apk|aab]
# Default: aab (Play Store preferred format)

FORMAT="${1:-aab}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== HisaabPro Release Build ==="
echo "Format: $FORMAT"
echo ""

# Step 1: Check keystore
if [ ! -f "$ROOT_DIR/android/keystore.properties" ]; then
  echo "ERROR: android/keystore.properties not found!"
  echo ""
  echo "Step 1: Generate keystore (one-time):"
  echo "  keytool -genkey -v -keystore android/hisaabpro-release.keystore \\"
  echo "    -alias hisaabpro -keyalg RSA -keysize 2048 -validity 10000"
  echo ""
  echo "Step 2: Create android/keystore.properties from android/keystore.properties.example"
  exit 1
fi

# Step 2: Build frontend
echo "[1/4] Building frontend..."
cd "$ROOT_DIR"
npm run build
echo "  dist/ ready"

# Step 3: Sync to Android
echo "[2/4] Syncing to Android..."
npx cap sync android
echo "  Android assets synced"

# Step 4: Build release
echo "[3/4] Building release $FORMAT..."
cd "$ROOT_DIR/android"

if [ "$FORMAT" = "apk" ]; then
  ./gradlew assembleRelease
  OUTPUT=$(find app/build/outputs/apk/release -name "*.apk" 2>/dev/null | head -1)
else
  ./gradlew bundleRelease
  OUTPUT=$(find app/build/outputs/bundle/release -name "*.aab" 2>/dev/null | head -1)
fi

if [ -z "$OUTPUT" ]; then
  echo "ERROR: Build output not found!"
  exit 1
fi

# Step 5: Show result
SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "[4/4] Build complete!"
echo ""
echo "  Output: $OUTPUT"
echo "  Size:   $SIZE"
echo ""

if [ "$FORMAT" = "aab" ]; then
  echo "Upload this .aab to Google Play Console:"
  echo "  https://play.google.com/console"
else
  echo "Install on device:"
  echo "  adb install $OUTPUT"
fi
