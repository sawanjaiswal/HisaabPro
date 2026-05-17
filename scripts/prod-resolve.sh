#!/bin/bash
set -euo pipefail

# HisaabPro — Prod migration resolve helper
#
# Clears a stuck migration row in Neon prod's `_prisma_migrations` table
# so the next Render deploy can retry it.
#
# Usage:
#   ./scripts/prod-resolve.sh rollback <migration-name>   # most common
#   ./scripts/prod-resolve.sh apply    <migration-name>   # mark a manual SQL as done
#
# Setup (one-time):
#   1. Grab the Neon prod connection string from the Render dashboard:
#      hisaabpro-api → Environment → DATABASE_URL
#   2. Add to ~/.zshrc (NOT ~/.zshenv — keep it interactive-shell only):
#        export RENDER_DATABASE_URL='postgresql://...@ep-xxx.aws.neon.tech/neondb?sslmode=require'
#   3. `source ~/.zshrc`
#
# Safety:
#   - Refuses to run if RENDER_DATABASE_URL points to localhost / 127.0.0.1
#   - Always prints the host it's about to hit and asks for confirmation
#   - Never writes to a local .env

MODE="${1:-}"
MIGRATION="${2:-}"

if [ -z "$MODE" ] || [ -z "$MIGRATION" ]; then
  echo "Usage: $0 <rollback|apply> <migration-name>"
  echo ""
  echo "Examples:"
  echo "  $0 rollback 20260507130000_inventory_phase2_reorder"
  echo "  $0 apply    20260101000000_seed_taxonomy"
  exit 1
fi

if [ "$MODE" != "rollback" ] && [ "$MODE" != "apply" ]; then
  echo "ERROR: mode must be 'rollback' or 'apply', got '$MODE'"
  exit 1
fi

if [ -z "${RENDER_DATABASE_URL:-}" ]; then
  echo "ERROR: RENDER_DATABASE_URL is not set."
  echo ""
  echo "Add to ~/.zshrc:"
  echo "  export RENDER_DATABASE_URL='postgresql://...@ep-xxx.aws.neon.tech/neondb?sslmode=require'"
  echo ""
  echo "Then re-run: source ~/.zshrc && $0 $MODE $MIGRATION"
  exit 1
fi

# Safety: never let this run against a local DB by accident
case "$RENDER_DATABASE_URL" in
  *localhost*|*127.0.0.1*|*@host.docker.internal*)
    echo "ERROR: RENDER_DATABASE_URL looks like a local DB:"
    echo "  $RENDER_DATABASE_URL"
    echo ""
    echo "This script is for Neon prod only. Aborting."
    exit 1
    ;;
esac

# Extract host for the confirmation prompt (strip credentials)
HOST=$(echo "$RENDER_DATABASE_URL" | sed -E 's|^[a-z]+://[^@]+@([^/?]+).*|\1|')

FLAG="--rolled-back"
if [ "$MODE" = "apply" ]; then
  FLAG="--applied"
fi

echo "=== Prisma migrate resolve ==="
echo "  Host:      $HOST"
echo "  Mode:      $MODE ($FLAG)"
echo "  Migration: $MIGRATION"
echo ""
read -r -p "Proceed? [y/N] " CONFIRM
case "$CONFIRM" in
  y|Y|yes|YES) ;;
  *) echo "Aborted."; exit 1 ;;
esac

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/server"

DATABASE_URL="$RENDER_DATABASE_URL" \
  npx prisma migrate resolve "$FLAG" "$MIGRATION"

echo ""
echo "Done. Trigger a Render redeploy:"
echo "  - push a new commit, OR"
echo "  - Render dashboard → hisaabpro-api → Manual Deploy → Deploy latest commit"
