#!/bin/bash
set -euo pipefail

# Version bump script for HisaabPro
# Usage: ./scripts/bump-version.sh [patch|minor|major]
# Updates: package.json + android versionCode/versionName

BUMP_TYPE="${1:-patch}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
GRADLE="$ROOT_DIR/android/app/build.gradle"
PKG="$ROOT_DIR/package.json"

# Read current version from package.json
CURRENT=$(grep '"version"' "$PKG" | sed 's/.*"\([0-9]*\.[0-9]*\.[0-9]*\)".*/\1/')
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP_TYPE" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *) echo "Usage: $0 [patch|minor|major]"; exit 1 ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

# Read current versionCode from build.gradle
CURRENT_CODE=$(grep 'versionCode' "$GRADLE" | head -1 | sed 's/.*versionCode \([0-9]*\).*/\1/')
NEW_CODE=$((CURRENT_CODE + 1))

echo "Version: $CURRENT → $NEW_VERSION"
echo "Code:    $CURRENT_CODE → $NEW_CODE"

# Update package.json
sed -i '' "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW_VERSION\"/" "$PKG"

# Update build.gradle
sed -i '' "s/versionCode $CURRENT_CODE/versionCode $NEW_CODE/" "$GRADLE"
sed -i '' "s/versionName \".*\"/versionName \"$NEW_VERSION\"/" "$GRADLE"

echo "Updated package.json + android/app/build.gradle"
